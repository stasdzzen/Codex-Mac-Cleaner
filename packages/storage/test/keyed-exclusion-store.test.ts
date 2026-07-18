import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import {
  InstallationKeyStore,
  JsonStore,
  JsonStoreError,
  KeyedExclusionStateStore,
  type RawUserExclusionIdentity,
} from "../src/index.js";

const now = () => new Date("2026-07-18T00:00:00.000Z");
const syntheticValue = (domain: string) => createHash("sha256")
  .update(`keyed-exclusion-test\u0000${domain}`)
  .digest("hex")
  .slice(0, 24);
const rawIdentity: RawUserExclusionIdentity = {
  targetIdentity: `target-${syntheticValue("target")}`,
  bundleIdentifier: `org.synthetic.${syntheticValue("bundle")}`,
  packageIdentifier: `package.synthetic.${syntheticValue("package")}`,
  signingRequirement: `designated-${syntheticValue("signing")}`,
  ownerTypeFingerprint: `owner-type-${syntheticValue("owner")}`,
};
const metadata = {
  exclusionId: "exclusion-synthetic-a",
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory",
  createdAt: "2026-07-18T00:00:00.000Z",
  reasonCategory: "user_choice",
} as const;

async function tempStateRoot(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "cmc-keyed-exclusions-")), "state");
}

function expectNoRawIdentity(serialized: string): void {
  expect(
    Object.values(rawIdentity).some(
      (value) => typeof value === "string" && serialized.includes(value),
    ),
  ).toBe(false);
}

describe("installation-local HMAC и keyed exclusion store", () => {
  it("создаёт случайный 256-bit key отдельно с 0600 и разделяет domains", async () => {
    const stateRoot = await tempStateRoot();
    const keyStore = new InstallationKeyStore({ stateRoot });
    const key = await keyStore.loadOrCreate();

    expect((await stat(join(stateRoot, "keys", "exclusion-hmac-key.json"))).mode & 0o777).toBe(0o600);
    expect(key.derive("subject", "target", "same-value")).not.toBe(
      key.derive("claim", "target", "same-value"),
    );
    expect(key.derive("claim", "target", "same-value")).not.toBe(
      key.derive("claim", "bundle", "same-value"),
    );
    expect(key.derive("claim", "bundle", "e\u0301")).toBe(
      key.derive("claim", "bundle", "é"),
    );
    expect(() => JSON.stringify(key)).toThrowError(
      "Installation key нельзя сериализовать",
    );
  });

  it("не сохраняет plaintext и не совпадает с plain/public-salt hash", async () => {
    const stateRoot = await tempStateRoot();
    const store = new KeyedExclusionStateStore({ stateRoot, now });
    const created = await store.createFromIdentity(metadata, rawIdentity);
    const persisted = await readFile(join(stateRoot, "exclusions.json"), "utf8");
    const plain = createHash("sha256")
      .update(rawIdentity.bundleIdentifier!)
      .digest("hex");
    const publicSalt = createHash("sha256")
      .update(`public-salt:${rawIdentity.bundleIdentifier}`)
      .digest("hex");

    expect(created.schemaVersion).toBe(2);
    expect(created.subjectDigest).toMatch(/^hmac-sha256:v1:[a-f0-9]{64}$/u);
    expectNoRawIdentity(persisted);
    expect(persisted).not.toContain(plain);
    expect(persisted).not.toContain(publicSalt);
    expect((await new KeyedExclusionStateStore({ stateRoot, now }).list()).exclusions).toEqual([created]);
  });

  it.each([1, 2] as const)("атомарно мигрирует known legacy schema v%s", async (version) => {
    const stateRoot = await tempStateRoot();
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    const legacyDigest = "a".repeat(64);
    const legacy = {
      schemaVersion: 1,
      exclusionId: metadata.exclusionId,
      ruleId: metadata.ruleId,
      artifactKind: metadata.artifactKind,
      normalizedTargetIdentity: `target:v1:${legacyDigest}`,
      bundleId: rawIdentity.bundleIdentifier,
      packageId: rawIdentity.packageIdentifier,
      signingIdentity: `signing:v1:${legacyDigest}`,
      ownerTypeFingerprint: `owner-type:v1:${legacyDigest}`,
      createdAt: metadata.createdAt,
      reasonCategory: metadata.reasonCategory,
    };
    const payload = version === 1
      ? { schemaVersion: 1, exclusions: [legacy] }
      : {
          schemaVersion: 2,
          stateVersion: 4,
          updatedAt: metadata.createdAt,
          exclusions: [legacy],
        };
    await writeFile(join(stateRoot, "exclusions.json"), JSON.stringify(payload), { mode: 0o600 });

    const loaded = await new KeyedExclusionStateStore({ stateRoot, now }).list();
    const persisted = await readFile(join(stateRoot, "exclusions.json"), "utf8");

    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.exclusions[0]?.schemaVersion).toBe(2);
    expectNoRawIdentity(persisted);
    expect(JSON.parse(persisted).schemaVersion).toBe(3);
    expect((await readdir(stateRoot)).filter((name) => name.includes(".tmp-"))).toEqual([]);
  });

  it.each([
    ["unknown", JSON.stringify({ schemaVersion: 99, exclusions: [] }), "CORRELATION_SCHEMA_UNSUPPORTED"],
    ["corrupt", "{not-json", "CORRELATION_SCHEMA_UNSUPPORTED"],
    [
      "ambiguous migration",
      JSON.stringify({
        schemaVersion: 1,
        exclusions: [{ ...metadata, schemaVersion: 1 }],
      }),
      "CORRELATION_MIGRATION_REQUIRED",
    ],
  ] as const)("%s оставляет findings видимыми и блокирует tokens", async (_case, payload, errorCode) => {
    const stateRoot = await tempStateRoot();
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    await writeFile(join(stateRoot, "exclusions.json"), payload, { mode: 0o600 });

    await expect(
      new KeyedExclusionStateStore({ stateRoot, now }).readForAudit(),
    ).resolves.toEqual({
      status: "invalid",
      errorCode,
      findingsVisibility: "visible",
      tokenIssuance: "blocked",
    });
  });

  it("thrown recovery error не раскрывает raw corrupt payload через cause chain", async () => {
    const stateRoot = await tempStateRoot();
    const canary = `raw-${syntheticValue("corrupt-error")}`;
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    await writeFile(join(stateRoot, "exclusions.json"), canary, { mode: 0o600 });

    const error = await new KeyedExclusionStateStore({ stateRoot, now })
      .list()
      .catch((caught: unknown) => caught);

    expect(inspect(error, { depth: 10 }).includes(canary)).toBe(false);
  });

  it("missing key у current state fail closed", async () => {
    const stateRoot = await tempStateRoot();
    const store = new KeyedExclusionStateStore({ stateRoot, now });
    await store.createFromIdentity(metadata, rawIdentity);
    await unlink(join(stateRoot, "keys", "exclusion-hmac-key.json"));

    await expect(
      new KeyedExclusionStateStore({ stateRoot, now }).readForAudit(),
    ).resolves.toMatchObject({
      status: "invalid",
      errorCode: "CORRELATION_KEY_UNAVAILABLE",
      findingsVisibility: "visible",
      tokenIssuance: "blocked",
    });
  });

  it("явно восстанавливает installation key из plugin-owned backup без silent reset", async () => {
    const stateRoot = await tempStateRoot();
    const backup = Buffer.alloc(32, 19);
    const keyStore = new InstallationKeyStore({
      stateRoot,
      randomKey: () => backup,
    });
    const store = new KeyedExclusionStateStore({ stateRoot, now, keyStore });
    const created = await store.createFromIdentity(metadata, rawIdentity);
    await unlink(join(stateRoot, "keys", "exclusion-hmac-key.json"));

    await expect(store.readForAudit()).resolves.toMatchObject({
      status: "invalid",
      errorCode: "CORRELATION_KEY_UNAVAILABLE",
      tokenIssuance: "blocked",
    });
    await keyStore.restoreFromBackup(backup);
    await expect(store.list()).resolves.toMatchObject({ exclusions: [created] });
  });

  it.each(["before", "after"] as const)(
    "migration crash %s rename остаётся fail closed и восстанавливается атомарно",
    async (phase) => {
      const stateRoot = await tempStateRoot();
      await mkdir(stateRoot, { recursive: true, mode: 0o700 });
      const legacyDigest = "b".repeat(64);
      await writeFile(
        join(stateRoot, "exclusions.json"),
        JSON.stringify({
          schemaVersion: 1,
          exclusions: [{
            schemaVersion: 1,
            exclusionId: metadata.exclusionId,
            ruleId: metadata.ruleId,
            artifactKind: metadata.artifactKind,
            normalizedTargetIdentity: `target:v1:${legacyDigest}`,
            bundleId: rawIdentity.bundleIdentifier,
            packageId: rawIdentity.packageIdentifier,
            signingIdentity: `signing:v1:${legacyDigest}`,
            ownerTypeFingerprint: `owner-type:v1:${legacyDigest}`,
            createdAt: metadata.createdAt,
            reasonCategory: metadata.reasonCategory,
          }],
        }),
        { mode: 0o600 },
      );
      class CrashStore extends JsonStore {
        override async writeJsonAtomic(path: string, value: unknown): Promise<void> {
          if (phase === "after") await super.writeJsonAtomic(path, value);
          throw new JsonStoreError("STORE_IO_FAILURE");
        }
      }
      const crashing = new KeyedExclusionStateStore({
        stateRoot,
        now,
        jsonStore: new CrashStore(stateRoot),
      });

      await expect(crashing.readForAudit()).resolves.toMatchObject({
        status: "invalid",
        findingsVisibility: "visible",
        tokenIssuance: "blocked",
      });
      const recovered = await new KeyedExclusionStateStore({ stateRoot, now }).list();
      expect(recovered.schemaVersion).toBe(3);
    },
  );

  it("rekey меняет namespace/digests и переживает restart", async () => {
    const stateRoot = await tempStateRoot();
    const store = new KeyedExclusionStateStore({ stateRoot, now });
    const before = await store.createFromIdentity(metadata, rawIdentity);
    const afterState = await store.rekey([
      { exclusionId: before.exclusionId, identity: rawIdentity },
    ]);
    const after = afterState.exclusions[0]!;

    expect(after.keyId).not.toBe(before.keyId);
    expect(after.subjectDigest).not.toBe(before.subjectDigest);
    expect(await new KeyedExclusionStateStore({ stateRoot, now }).list()).toEqual(afterState);
  });
});

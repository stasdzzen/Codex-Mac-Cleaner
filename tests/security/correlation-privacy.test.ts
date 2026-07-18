import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildSyntheticCorrelationInput } from "../../packages/adapters/src/index.js";
import { resolveCorrelation } from "../../packages/evidence/src/index.js";
import {
  InstallationKeyStore,
  KeyedExclusionStateStore,
} from "../../packages/storage/src/index.js";

const fixedNow = "2026-07-18T00:00:00.000Z";

function rawValue(seed: string, domain: string): string {
  return createHash("sha256")
    .update(`${domain}\u0000${seed}`)
    .digest("hex")
    .slice(0, 24);
}

async function stateRoot(prefix: string): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), prefix)), "state");
}

describe("security: correlation privacy и fail-closed evidence", () => {
  it("ephemeral boundary и safe resolver output не раскрывают raw canaries", async () => {
    const seed = "privacy-canary-seed";
    const tempRoot = await stateRoot("cmc-privacy-raw-");
    const key = await new InstallationKeyStore({
      stateRoot: await stateRoot("cmc-privacy-key-"),
      randomKey: () => Buffer.alloc(32, 7),
    }).loadOrCreate();
    const rawInput = buildSyntheticCorrelationInput({
      seed,
      tempRoot,
      installedVariant: "resolved",
      positiveFacts: [
        "activity",
        "openFile",
        "startupTarget",
        "receipt",
        "officialUninstaller",
        "dependency",
      ],
      deriver: key,
    });

    expect(() => JSON.stringify(rawInput)).toThrowError(
      "Raw correlation input нельзя сериализовать",
    );
    expect(String(rawInput)).toBe("[EphemeralCorrelationInput redacted]");

    const result = resolveCorrelation({
      auditId: "audit-security-synthetic",
      auditRevision: 1,
      findingId: "finding-security-synthetic",
      exclusionStateVersion: 1,
      ruleSetVersion: 2,
      policyVersion: 2,
      now: fixedNow,
      deriver: key,
      rawInput,
    });
    const serialized = JSON.stringify(result);
    const rawCanaries = [
      tempRoot,
      `org.synthetic.${rawValue(seed, "bundle")}`,
      `package.synthetic.${rawValue(seed, "package")}`,
      `designated-${rawValue(seed, "signing")}`,
      `team-${rawValue(seed, "team")}`,
      rawValue(seed, "basename"),
      rawValue(seed, "display"),
    ];
    expect(rawCanaries.some((canary) => serialized.includes(canary))).toBe(false);
    expect(result.safeView.allowedActions).toEqual(["inspect"]);
  });

  it("incomplete coverage не выпускает absent certificate, а race инвалидирует их все", async () => {
    const key = await new InstallationKeyStore({
      stateRoot: await stateRoot("cmc-coverage-key-"),
      randomKey: () => Buffer.alloc(32, 8),
    }).loadOrCreate();
    const run = async (suffix: string, options: Parameters<typeof buildSyntheticCorrelationInput>[0]) =>
      resolveCorrelation({
        auditId: `audit-${suffix}`,
        auditRevision: 1,
        findingId: `finding-${suffix}`,
        exclusionStateVersion: 1,
        ruleSetVersion: 2,
        policyVersion: 2,
        now: fixedNow,
        deriver: key,
        rawInput: buildSyntheticCorrelationInput(options),
      });
    const incomplete = await run("incomplete", {
      seed: "coverage-canary",
      tempRoot: await stateRoot("cmc-coverage-raw-"),
      queryStates: { installed_apps: "permission_denied" },
    });
    const stale = await run("stale", {
      seed: "race-canary",
      tempRoot: await stateRoot("cmc-race-raw-"),
      mutateSnapshotB: true,
    });

    expect(incomplete.safeView.facts.ownerApplication.state).toBe("unknown");
    expect(incomplete.certificates).not.toContainEqual(
      expect.objectContaining({ queryScope: "installed_apps" }),
    );
    expect(stale.revision.staleDuringAudit).toBe(true);
    expect(stale.certificates).toEqual([]);
    expect(Object.values(stale.safeView.facts)).not.toContainEqual(
      expect.objectContaining({ state: "absent" }),
    );
  });

  it("keyed persistence противостоит low-entropy dictionary и не хранит raw identity", async () => {
    const roots = await Promise.all([
      stateRoot("cmc-dictionary-a-"),
      stateRoot("cmc-dictionary-b-"),
    ]);
    const identity = {
      targetIdentity: ["l", "o", "w"].join(""),
      bundleIdentifier: ["com", "a"].join("."),
      packageIdentifier: ["pkg", "a"].join("."),
      signingRequirement: ["req", "a"].join("."),
      ownerTypeFingerprint: [501, 20, "directory"].join(":"),
    } as const;
    const metadata = {
      exclusionId: "exclusion-security-keyed",
      ruleId: "RULE_SYNTHETIC_CACHE",
      artifactKind: "directory",
      createdAt: fixedNow,
      reasonCategory: "user_choice",
    } as const;
    const stores = roots.map((root, index) => {
      const keyStore = new InstallationKeyStore({
        stateRoot: root,
        randomKey: () => Buffer.alloc(32, index + 11),
      });
      return new KeyedExclusionStateStore({ stateRoot: root, keyStore });
    });
    const [first, second] = await Promise.all(
      stores.map((store) => store.createFromIdentity(metadata, identity)),
    );
    const persisted = await readFile(join(roots[0]!, "exclusions.json"), "utf8");
    const publicDigest = createHash("sha256")
      .update(identity.bundleIdentifier)
      .digest("hex");
    const publicSaltDigest = createHash("sha256")
      .update(`public-salt:${identity.bundleIdentifier}`)
      .digest("hex");

    expect(first.subjectDigest).not.toBe(second.subjectDigest);
    expect(Object.values(identity).some((value) => persisted.includes(value))).toBe(false);
    expect(persisted).not.toContain(publicDigest);
    expect(persisted).not.toContain(publicSaltDigest);
  });
});

import { mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  ExclusionStateStore,
  defaultExclusionStateRoot,
} from "../src/index.js";

const identity = "a".repeat(64);
const exclusion = {
  schemaVersion: 1,
  exclusionId: "exclusion-synthetic-a",
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory",
  normalizedTargetIdentity: `target:v1:${identity}`,
  bundleId: "org.example.synthetic",
  packageId: null,
  signingIdentity: `signing:v1:${identity}`,
  ownerTypeFingerprint: `owner-type:v1:${identity}`,
  createdAt: "2026-07-18T00:00:00.000Z",
  reasonCategory: "user_choice",
} as const;

const now = () => new Date("2026-07-18T01:00:00.000Z");

async function tempStateRoot(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "cmc-exclusions-")), "state");
}

describe("ExclusionStateStore", () => {
  it("сохраняет исключение после перезапуска с правами 0700/0600 и atomic cleanup", async () => {
    const stateRoot = await tempStateRoot();
    const first = new ExclusionStateStore({ stateRoot, now });
    await first.create(exclusion);

    const second = new ExclusionStateStore({ stateRoot, now });
    expect((await second.list()).exclusions).toEqual([exclusion]);
    expect((await stat(stateRoot)).mode & 0o777).toBe(0o700);
    expect((await stat(join(stateRoot, "exclusions.json"))).mode & 0o777).toBe(0o600);
    expect((await readdir(stateRoot)).filter((name) => name.includes(".tmp-"))).toEqual([]);
  });

  it.each([
    [
      1,
      { schemaVersion: 1, exclusions: [exclusion] },
    ],
    [
      2,
      {
        schemaVersion: 2,
        stateVersion: 4,
        updatedAt: "2026-07-18T00:30:00.000Z",
        exclusions: [exclusion],
      },
    ],
  ] as const)("читает поддержанную schema v%s и возвращает current v2", async (_version, state) => {
    const stateRoot = await tempStateRoot();
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    await writeFile(join(stateRoot, "exclusions.json"), `${JSON.stringify(state)}\n`, {
      mode: 0o600,
    });

    const loaded = await new ExclusionStateStore({ stateRoot, now }).list();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.exclusions).toEqual([exclusion]);
  });

  it.each([
    ["unknown", JSON.stringify({ schemaVersion: 99, exclusions: [] })],
    ["corrupt", "{not-json"],
  ])("не скрывает invalid state %s и помечает token issuance как blocked", async (_case, payload) => {
    const stateRoot = await tempStateRoot();
    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    await writeFile(join(stateRoot, "exclusions.json"), payload, { mode: 0o600 });

    const store = new ExclusionStateStore({ stateRoot, now });
    await expect(store.list()).rejects.toMatchObject({
      code: "EXCLUSION_STATE_INVALID",
      failClosed: true,
    });
    await expect(store.readForAudit()).resolves.toEqual({
      status: "invalid",
      errorCode: "EXCLUSION_STATE_INVALID",
      tokenIssuance: "blocked",
    });
  });

  it("блокирует чтение через symlink и не затрагивает внешний файл", async () => {
    const parent = await mkdtemp(join(tmpdir(), "cmc-exclusions-symlink-"));
    const stateRoot = join(parent, "state");
    const external = join(parent, "external.json");
    await mkdir(stateRoot, { mode: 0o700 });
    await writeFile(external, '{"schemaVersion":99}\n', { mode: 0o600 });
    await symlink(external, join(stateRoot, "exclusions.json"));

    const store = new ExclusionStateStore({ stateRoot, now });
    await expect(store.list()).rejects.toMatchObject({ code: "SYMLINK_BOUNDARY" });
    expect(await readFile(external, "utf8")).toBe('{"schemaVersion":99}\n');
  });

  it("строит default root только под injected home/Application Support", () => {
    expect(defaultExclusionStateRoot("/synthetic-home")).toBe(
      "/synthetic-home/Library/Application Support/Codex Mac Cleaner/state",
    );
    expect(defaultExclusionStateRoot("/synthetic-home")).not.toContain("/.codex");
  });
});

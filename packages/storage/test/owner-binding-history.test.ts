import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  InstallationKey,
  KeyedOwnerBindingHistoryStore,
  JsonStoreError,
  type KeyedOwnerBindingHistoryRecord,
} from "../src/index.js";

const rawCanary = "PRIVATE-OWNER-BINDING-HISTORY-CANARY";

function record(key: InstallationKey): KeyedOwnerBindingHistoryRecord {
  const derive = (kind: string) => key.derive("cmc:owner-history-test:v1", kind, `${rawCanary}-${kind}`);
  return {
    keyId: key.keyId,
    derivationVersion: key.derivationVersion,
    artifactDigest: derive("artifact"),
    ownerTypeDigest: derive("owner-type"),
    rootDigest: derive("root"),
    ownerBundleDigest: derive("bundle"),
    ownerSigningDigest: derive("signing"),
    ownerExecutableDigest: derive("executable"),
    bindingFingerprint: "binding-fingerprint-a",
    provenanceClass: "signed_process_open_file_history",
    lastValidatedAt: "2026-07-18T00:00:00.000Z",
  };
}

describe("KeyedOwnerBindingHistoryStore", () => {
  it("атомарно сохраняет только installation-keyed digests", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "cmc-binding-history-"));
    const key = new InstallationKey(new Uint8Array(32).fill(3));
    const store = new KeyedOwnerBindingHistoryStore(stateRoot);

    await store.replace([record(key), record(key)]);

    expect(await store.list()).toEqual([record(key)]);
    const persisted = await readFile(join(stateRoot, "correlation", "owner-binding-history.json"), "utf8");
    expect(persisted).not.toContain(rawCanary);
    expect(persisted).not.toMatch(/canonicalPath|bundleIdentifier|packageIdentifier|designatedRequirement/u);
  });

  it("rekey не совпадает с ранее сохранённой installation identity", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "cmc-binding-rekey-"));
    const oldKey = new InstallationKey(new Uint8Array(32).fill(4));
    const newKey = new InstallationKey(new Uint8Array(32).fill(5));
    const store = new KeyedOwnerBindingHistoryStore(stateRoot);
    await store.replace([record(oldKey)]);

    const loaded = await store.list();
    expect(loaded[0]?.keyId).not.toBe(newKey.keyId);
    expect(loaded[0]?.artifactDigest).not.toBe(record(newKey).artifactDigest);
  });

  it("corrupt schema восстанавливается только fail closed", async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), "cmc-binding-corrupt-"));
    const store = new KeyedOwnerBindingHistoryStore(stateRoot);
    await store.replace([record(new InstallationKey(new Uint8Array(32).fill(6)))]);
    await writeFile(
      join(stateRoot, "correlation", "owner-binding-history.json"),
      JSON.stringify({ schemaVersion: 2, records: [{ rawPath: rawCanary }] }),
      "utf8",
    );

    await expect(store.list()).rejects.toBeInstanceOf(JsonStoreError);
  });
});

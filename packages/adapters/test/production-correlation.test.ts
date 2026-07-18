import { describe, expect, it, vi } from "vitest";

import {
  buildProductionCorrelationInput,
  consumeEphemeralCorrelationInput,
  type ProductionCorrelationCommandBoundary,
  type ProductionCorrelationFilesystemBoundary,
  type ProductionCorrelationSnapshotRecord,
  type ProductionSourceCapture,
  type RawQueryState,
} from "../src/index.js";

const now = "2026-07-18T00:00:00.000Z";
const rawCanary = "PRIVATE-PRODUCTION-CORRELATION-CANARY";

const snapshot: ProductionCorrelationSnapshotRecord = {
  candidateFingerprint: "candidate-fingerprint",
  parentFingerprint: "parent-fingerprint",
  ownerTypeFingerprint: "owner-type-fingerprint",
  executableFingerprint: "executable-fingerprint",
  processFingerprint: "process-fingerprint",
  openFileFingerprint: "open-file-fingerprint",
  receiptFingerprint: "receipt-fingerprint",
  dependencyFingerprint: "dependency-fingerprint",
};

function capture<T>(
  records: readonly T[],
  state: RawQueryState = "complete",
): ProductionSourceCapture<T> {
  return {
    state,
    startedAt: now,
    completedAt: now,
    records,
  };
}

describe("production server-only correlation bridge", () => {
  it("строит все mandatory raw queries через injectable boundaries и сохраняет A/B", async () => {
    const commandBoundary: ProductionCorrelationCommandBoundary = {
      installedApps: vi.fn(async () => capture([{
        localId: "installed-a",
        bundle: {
          bundleIdentifier: `org.canary.${rawCanary}`,
          metadataFingerprint: "installed-metadata",
        },
        signing: {
          designatedRequirement: "installed-requirement",
          teamIdentifier: "installed-team",
          executableFingerprint: "installed-executable",
        },
        executableFingerprint: "installed-executable",
      }], "partial_inventory")),
      processes: vi.fn(async () => capture([{
        localId: "process-a",
        executableFingerprint: "executable-fingerprint",
        pidGeneration: "pid-generation",
      }])),
      openFiles: vi.fn(async () => capture([{
        localId: "open-file-a",
        targetFilesystemFingerprint: "candidate-fingerprint",
        processGeneration: "process-generation",
      }])),
    };
    const filesystemBoundary: ProductionCorrelationFilesystemBoundary = {
      captureCandidate: vi.fn(async (_candidateRef, phase) => ({
        candidate: {
          localId: "candidate-a",
          filesystem: {
            canonicalPath: `/private/${rawCanary}`,
            device: "device-a",
            inode: "inode-a",
            fileType: "directory" as const,
            uid: 501,
            gid: 20,
            fingerprint: "candidate-fingerprint",
          },
          bundle: {
            bundleIdentifier: `org.canary.${rawCanary}`,
            metadataFingerprint: "candidate-metadata",
          },
          packageIdentifier: `package.${rawCanary}`,
          signing: {
            designatedRequirement: "candidate-requirement",
            teamIdentifier: "candidate-team",
            executableFingerprint: "executable-fingerprint",
          },
          owner: { uid: 501, gid: 20 },
          executableFingerprint: "executable-fingerprint",
        },
        snapshot: phase === "A"
          ? snapshot
          : { ...snapshot, processFingerprint: "process-fingerprint-b" },
      })),
      startupTargets: vi.fn(async () => capture([{
        localId: "startup-a",
        executableFingerprint: "executable-fingerprint",
      }])),
      targetExecutables: vi.fn(async () => capture([{
        localId: "target-executable-a",
        executableFingerprint: "executable-fingerprint",
      }])),
      receipts: vi.fn(async () => capture([{
        localId: "receipt-a",
        packageIdentifier: `package.${rawCanary}`,
        targetFilesystemFingerprint: "candidate-fingerprint",
      }])),
      officialUninstallers: vi.fn(async () => capture([{
        localId: "uninstaller-a",
        bundleIdentifier: `org.canary.${rawCanary}`,
        designatedRequirement: "candidate-requirement",
        executableFingerprint: "executable-fingerprint",
      }])),
      dependencies: vi.fn(async () => capture([{
        localId: "dependency-a",
        dependeeExecutableFingerprint: "executable-fingerprint",
        relationFingerprint: "dependency-relation",
      }])),
    };
    const signal = new AbortController().signal;

    const input = await buildProductionCorrelationInput({
      candidateRef: "candidate-ref-a",
      snapshotId: "snapshot-production-a",
      signal,
      commandBoundary,
      filesystemBoundary,
    });

    expect(input.describe()).toEqual({
      schemaVersion: 1,
      snapshotId: "snapshot-production-a",
      queryCount: 8,
    });
    expect(JSON.stringify(input.describe())).not.toContain(rawCanary);
    expect(() => JSON.stringify(input)).toThrowError(
      "Raw correlation input нельзя сериализовать",
    );

    consumeEphemeralCorrelationInput(input, (payload) => {
      expect(payload.queries.map(({ queryScope }) => queryScope)).toEqual([
        "installed_apps",
        "processes",
        "open_files",
        "startup_targets",
        "target_executables",
        "receipts",
        "official_uninstallers",
        "dependencies",
      ]);
      expect(payload.queries[0]).toMatchObject({
        sourceAdapter: "production-installed-apps",
        state: "partial_inventory",
      });
      expect(payload.queries.every(({ queryId }, index, queries) =>
        queries.findIndex((query) => query.queryId === queryId) === index
      )).toBe(true);
      expect(payload.snapshotA.processFingerprint).toBe("process-fingerprint");
      expect(payload.snapshotB.processFingerprint).toBe("process-fingerprint-b");
      expect(payload.candidate.claims.map(({ kind }) => kind)).toEqual([
        "filesystem",
        "bundle",
        "package",
        "signing",
        "owner",
        "executable",
      ]);
    });

    expect(filesystemBoundary.captureCandidate).toHaveBeenNthCalledWith(
      1,
      "candidate-ref-a",
      "A",
      signal,
    );
    expect(filesystemBoundary.captureCandidate).toHaveBeenNthCalledWith(
      2,
      "candidate-ref-a",
      "B",
      signal,
    );
    expect(commandBoundary.installedApps).toHaveBeenCalledWith(
      "candidate-ref-a",
      signal,
    );
    expect(filesystemBoundary.dependencies).toHaveBeenCalledWith(
      "candidate-ref-a",
      signal,
    );
  });
});

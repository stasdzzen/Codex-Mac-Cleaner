import { createHash } from "node:crypto";

import {
  createProductionCorrelationAdapter,
  type ProductionCorrelationCommandBoundary,
  type ProductionCorrelationFilesystemBoundary,
  type ProductionCorrelationSnapshotRecord,
  type ProductionSourceCapture,
} from "@codex-mac-cleaner/adapters";
import { resolveCorrelation } from "@codex-mac-cleaner/evidence";
import { describe, expect, it } from "vitest";

import { runSafeCoreIntegrationHarness } from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const now = "2026-07-18T00:00:00.000Z";
const rawCanary = "PRIVATE-BRIDGE-INTEGRATION-CANARY";

function complete<T>(records: readonly T[]): ProductionSourceCapture<T> {
  return { state: "complete", startedAt: now, completedAt: now, records };
}

const snapshot: ProductionCorrelationSnapshotRecord = {
  candidateFingerprint: "candidate-production-fingerprint",
  parentFingerprint: "parent-production-fingerprint",
  ownerTypeFingerprint: "owner-production-fingerprint",
  executableFingerprint: "executable-production-fingerprint",
  processFingerprint: "process-production-fingerprint",
  openFileFingerprint: "open-production-fingerprint",
  receiptFingerprint: "receipt-production-fingerprint",
  dependencyFingerprint: "dependency-production-fingerprint",
};

const deriver = {
  keyId: "production-bridge-test-key",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    return `hmac-sha256:v1:${createHash("sha256")
      .update(`${domain}\u0000${kind}\u0000${value}`)
      .digest("hex")}` as const;
  },
};

describe("production correlation bridge safe core integration", () => {
  it("будущий CMC-09 собирает ephemeral input без identity discovery в app/core", async () => {
    const commands: ProductionCorrelationCommandBoundary = {
      installedApps: async () => complete([]),
      processes: async () => complete([]),
      openFiles: async () => complete([]),
    };
    const filesystem: ProductionCorrelationFilesystemBoundary = {
      captureCandidate: async () => ({
        candidate: {
          localId: "candidate-production-a",
          filesystem: {
            canonicalPath: `/private/${rawCanary}`,
            device: "device-production-a",
            inode: "inode-production-a",
            fileType: "directory",
            uid: 501,
            gid: 20,
            fingerprint: snapshot.candidateFingerprint,
          },
          bundle: {
            bundleIdentifier: `org.private.${rawCanary}`,
            metadataFingerprint: "metadata-production-a",
          },
          packageIdentifier: `package.private.${rawCanary}`,
          signing: {
            designatedRequirement: `requirement-${rawCanary}`,
            teamIdentifier: "team-production-a",
            executableFingerprint: snapshot.executableFingerprint,
          },
          owner: { uid: 501, gid: 20 },
          executableFingerprint: snapshot.executableFingerprint,
        },
        snapshot,
      }),
      startupTargets: async () => complete([]),
      targetExecutables: async () => complete([{
        localId: "target-executable-production-a",
        executableFingerprint: snapshot.executableFingerprint,
      }]),
      receipts: async () => complete([]),
      officialUninstallers: async () => complete([]),
      dependencies: async () => complete([]),
    };
    const correlationAdapter = createProductionCorrelationAdapter({
      commandBoundary: commands,
      filesystemBoundary: filesystem,
    });
    const rawInput = await correlationAdapter.buildInput({
      candidateRef: "candidate-production-ref-a",
      snapshotId: "snapshot-production-integration-a",
      signal: new AbortController().signal,
    });
    const resolverResult = resolveCorrelation({
      auditId: "audit-production-integration-a",
      auditRevision: 1,
      findingId: "finding-production-integration-a",
      exclusionStateVersion: 1,
      ruleSetVersion: 1,
      policyVersion: 1,
      now,
      deriver,
      rawInput,
    });
    const {
      classification: _classification,
      evidenceSet: _evidenceSet,
      correlationRevision: _revision,
      ...policyContext
    } = safeFinding;
    const harness = runSafeCoreIntegrationHarness({
      resolverResult,
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext,
    });

    expect(resolverResult.provenance).toHaveLength(8);
    expect(resolverResult.safeView.facts.targetExecutable.state).toBe("present");
    expect(harness.classification.label).toBe("orphaned");
    expect(harness.decision.allowedActions).toContain("prepare_move");
    const serializedSafeCore = JSON.stringify({
      safeInput: harness.safeInput,
      evidenceSet: harness.evidenceSet,
      classification: harness.classification,
      decision: harness.decision,
    });
    expect(serializedSafeCore).not.toContain(rawCanary);
    expect(serializedSafeCore).not.toMatch(
      /canonicalPath|bundleIdentifier|packageIdentifier|designatedRequirement/u,
    );
  });
});

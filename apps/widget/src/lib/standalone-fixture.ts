import type { DashboardSnapshot } from "@/lib/dashboard-types";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const standaloneFixture = deepFreeze<DashboardSnapshot>({
  auditId: "audit-public-synthetic",
  revision: 1,
  state: "completed_with_warnings",
  stateVersion: 1,
  progress: {
    phase: "completed",
    completedSteps: 8,
    totalSteps: 8,
    processedCandidates: 6,
    totalCandidates: 6,
  },
  coverage: {
    checkedSourceCount: 7,
    skippedSourceCount: 1,
    warnings: ["Часть областей не проверена: synthetic permission gap."],
  },
  storageSummary: {
    candidateLogicalBytes: 1_572_864,
    candidatePhysicalBytes: 1_048_576,
    quarantinePhysicalBytes: 524_288,
    purgedPhysicalBytes: 262_144,
    stateVersion: 1,
  },
  diskObservation: {
    availableBytes: 80_000_000_000,
    totalBytes: 500_000_000_000,
    observedAt: "2026-07-18T10:05:00.000Z",
    source: "statfs",
  },
  excludedCount: 1,
  findings: [
    {
      findingId: "finding-public-synthetic",
      displayName: "Synthetic Cache",
      componentDisplayName: "Example Studio",
      category: "cache",
      supportLevel: "candidate",
      logicalSize: 1_572_864,
      physicalSize: 1_048_576,
      label: "orphaned",
      confidence: "high",
      risk: "low",
      allowedActions: ["inspect", "exclude", "prepare_move"],
      findingFacts: {
        lastObservedAt: "2026-07-18T09:58:00.000Z",
        temporalKind: "current",
        mainBundleState: "absent",
        activityState: "absent",
        openFileState: "absent",
        startupKinds: [],
        targetExecutableState: "unknown",
        receiptState: "absent",
        dependencyState: "absent",
        sensitivityFlags: [],
        recommendedRemovalMethod: "quarantine",
        blockingReasons: [],
      },
      reclaimEstimate: {
        estimatedPhysicalBytes: 1_048_576,
        confidence: "high",
        basis: "allocated_blocks",
        limitations: ["snapshot_estimate", "apfs_shared_blocks"],
        observedAt: "2026-07-18T09:58:00.000Z",
      },
      evidence: [
        {
          evidenceId: "evidence-public-synthetic",
          ruleInputType: "owner",
          sourceAdapter: "application_inventory",
          outcome: "confirmed",
          observedAt: "2026-07-18T09:58:00.000Z",
          summary: "Основной synthetic bundle не найден.",
        },
      ],
      blockingReasons: [],
    },
  ],
  quarantineEntries: [
    {
      entryId: "quarantine-public-synthetic",
      displayName: "Synthetic Old Cache",
      physicalBytes: 524_288,
      movedAt: "2026-07-17T08:00:00.000Z",
      state: "moved",
    },
  ],
});

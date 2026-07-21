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

const baseSnapshot: DashboardSnapshot = {
  auditId: "audit-synthetic-001",
  revision: 7,
  state: "completed_with_warnings",
  stateVersion: 12,
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
    warnings: ["Часть областей не проверена: защищённые контейнеры недоступны."],
  },
  storageSummary: {
    candidateLogicalBytes: 1_572_864,
    candidatePhysicalBytes: 1_048_576,
    quarantinePhysicalBytes: 524_288,
    purgedPhysicalBytes: 262_144,
    stateVersion: 12,
  },
  diskObservation: {
    availableBytes: 80_000_000_000,
    totalBytes: 500_000_000_000,
    observedAt: "2026-07-18T10:05:00.000Z",
    source: "statfs",
  },
  excludedCount: 2,
  findings: [
    {
      findingId: "finding-synthetic-cache",
      displayName: "Synthetic Cache",
      componentDisplayName: "Example Studio",
      category: "cache",
      supportLevel: "candidate",
      logicalSize: 1_048_576,
      physicalSize: 786_432,
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
        estimatedPhysicalBytes: 786_432,
        confidence: "high",
        basis: "allocated_blocks",
        limitations: ["snapshot_estimate", "apfs_shared_blocks"],
        observedAt: "2026-07-18T09:58:00.000Z",
      },
      evidence: [
        {
          evidenceId: "evidence-synthetic-owner",
          ruleInputType: "owner",
          sourceAdapter: "application_inventory",
          outcome: "confirmed",
          observedAt: "2026-07-18T09:58:00.000Z",
          summary: "Основной пакет приложения не найден.",
        },
      ],
      blockingReasons: [],
    },
    {
      findingId: "finding-synthetic-database",
      displayName: "Synthetic Database",
      componentDisplayName: "Example Notes",
      category: "database",
      supportLevel: "analysis_only",
      logicalSize: 524_288,
      physicalSize: 262_144,
      label: "unknown",
      confidence: "low",
      risk: "high",
      allowedActions: ["inspect"],
      findingFacts: {
        lastObservedAt: "2026-07-18T09:59:00.000Z",
        temporalKind: "current",
        mainBundleState: "unknown",
        activityState: "unknown",
        openFileState: "unknown",
        startupKinds: [],
        targetExecutableState: "unknown",
        receiptState: "unknown",
        dependencyState: "unknown",
        sensitivityFlags: ["database", "personal_data"],
        recommendedRemovalMethod: "inspect_only",
        blockingReasons: ["POLICY_RISK_CATEGORY"],
      },
      reclaimEstimate: {
        estimatedPhysicalBytes: 262_144,
        confidence: "low",
        basis: "observed_physical_size",
        limitations: ["snapshot_estimate"],
        observedAt: "2026-07-18T09:59:00.000Z",
      },
      evidence: [
        {
          evidenceId: "evidence-synthetic-data-kind",
          ruleInputType: "data_kind",
          sourceAdapter: "filesystem_metadata",
          outcome: "contradicted",
          observedAt: "2026-07-18T09:59:00.000Z",
          summary: "Обнаружены признаки пользовательской базы данных.",
        },
      ],
      blockingReasons: ["POLICY_RISK_CATEGORY"],
    },
    {
      findingId: "finding-synthetic-system-helper",
      displayName: "Synthetic Shared Helper",
      componentDisplayName: "Example Network Tool",
      category: "autostart",
      supportLevel: "unsupported_manual",
      logicalSize: 4_096,
      physicalSize: 4_096,
      label: "unknown",
      confidence: "medium",
      risk: "high",
      allowedActions: ["inspect"],
      findingFacts: {
        lastObservedAt: "2026-07-18T10:00:00.000Z",
        temporalKind: "current",
        mainBundleState: "absent",
        activityState: "absent",
        openFileState: "absent",
        startupKinds: ["launch_daemon"],
        targetExecutableState: "absent",
        receiptState: "unknown",
        dependencyState: "unknown",
        sensitivityFlags: [],
        recommendedRemovalMethod: "advanced_mode",
        blockingReasons: ["SYSTEM_SCOPE_UNSUPPORTED"],
      },
      reclaimEstimate: {
        estimatedPhysicalBytes: 0,
        confidence: "low",
        basis: "metadata_only",
        limitations: ["metadata_only"],
        observedAt: "2026-07-18T10:00:00.000Z",
      },
      evidence: [
        {
          evidenceId: "evidence-synthetic-startup",
          ruleInputType: "capability",
          sourceAdapter: "startup_items",
          outcome: "confirmed",
          observedAt: "2026-07-18T10:00:00.000Z",
          summary: "Системный объект доступен только для безопасной инспекции.",
        },
      ],
      blockingReasons: ["SYSTEM_SCOPE_UNSUPPORTED"],
    },
  ],
  quarantineEntries: [
    {
      entryId: "quarantine-synthetic-001",
      displayName: "Synthetic Old Cache",
      physicalBytes: 524_288,
      movedAt: "2026-07-17T08:00:00.000Z",
      state: "moved",
    },
  ],
};

export const dashboardFixture = deepFreeze(baseSnapshot);

export const runningFixture = deepFreeze({
  ...baseSnapshot,
  revision: null,
  state: "running" as const,
  stateVersion: 13,
  progress: {
    phase: "correlating_candidates" as const,
    completedSteps: 3,
    totalSteps: 8,
    processedCandidates: 2,
    totalCandidates: 6,
  },
  findings: [],
});

export const cancellingFixture = deepFreeze({
  ...runningFixture,
  state: "cancelling" as const,
  stateVersion: 14,
});

export const cancelledFixture = deepFreeze({
  ...baseSnapshot,
  revision: null,
  state: "cancelled" as const,
  stateVersion: 15,
  findings: baseSnapshot.findings.map((finding) => ({
    ...finding,
    allowedActions: [],
  })),
});

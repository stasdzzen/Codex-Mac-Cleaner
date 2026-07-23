import type {
  AuditRun,
  DiskObservation,
  Finding,
  StorageSummary,
} from "@codex-mac-cleaner/contracts";

export type AuditState = AuditRun["state"];
export type DashboardFindingFacts = Finding["widget"]["findingFacts"];
export type DashboardReclaimEstimate = Finding["widget"]["reclaimEstimate"];
export type DashboardEvidence = Omit<
  Finding["widget"]["evidence"][number],
  "details"
>;

export interface DashboardFinding {
  readonly findingId: Finding["model"]["findingId"];
  readonly displayName: Finding["model"]["displayName"];
  readonly componentDisplayName: Finding["widget"]["componentDisplayName"];
  readonly category: Finding["model"]["category"];
  readonly supportLevel: Finding["model"]["supportLevel"];
  readonly logicalSize: Finding["model"]["logicalSize"];
  readonly physicalSize: Finding["model"]["physicalSize"];
  readonly label: Finding["model"]["label"];
  readonly confidence: Finding["model"]["confidence"];
  readonly risk: Finding["model"]["risk"];
  readonly allowedActions: Finding["model"]["allowedActions"];
  readonly findingFacts: DashboardFindingFacts;
  readonly reclaimEstimate: DashboardReclaimEstimate;
  readonly evidence: readonly DashboardEvidence[];
  readonly blockingReasons: readonly string[];
}

export interface QuarantineEntry {
  readonly entryId: string;
  readonly displayName: string;
  readonly physicalBytes: number;
  readonly movedAt: string;
  readonly state: "moved";
}

export interface FindingSummary {
  readonly totalCount: number;
  readonly matchingCount: number;
  readonly supportLevelCounts: {
    readonly candidate: number;
    readonly analysisOnly: number;
    readonly unsupportedManual: number;
  };
}

export interface DashboardSnapshot {
  readonly auditId: string;
  readonly revision: number | null;
  readonly state: AuditState;
  readonly stateVersion: number;
  readonly progress: {
    readonly phase:
      | "queued"
      | "discovering_candidates"
      | "collecting_global_evidence"
      | "correlating_candidates"
      | "finalizing"
      | "completed"
      | "cancelled"
      | "failed";
    readonly completedSteps: number;
    readonly totalSteps: number;
    readonly processedCandidates: number;
    readonly totalCandidates: number;
  };
  readonly coverage: {
    readonly checkedSourceCount: number;
    readonly skippedSourceCount: number;
    readonly warnings: readonly string[];
  };
  readonly storageSummary: StorageSummary;
  readonly diskObservation: DiskObservation;
  readonly excludedCount: number;
  readonly findingSummary: FindingSummary;
  readonly findings: readonly DashboardFinding[];
  readonly nextCursor: string | null;
  readonly quarantineEntries: readonly QuarantineEntry[];
}

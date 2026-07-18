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

export interface DashboardSnapshot {
  readonly auditId: string;
  readonly revision: number | null;
  readonly state: AuditState;
  readonly stateVersion: number;
  readonly progress: {
    readonly completedSteps: number;
    readonly totalSteps: number;
  };
  readonly coverage: {
    readonly checkedSourceCount: number;
    readonly skippedSourceCount: number;
    readonly warnings: readonly string[];
  };
  readonly storageSummary: StorageSummary;
  readonly diskObservation: DiskObservation;
  readonly findings: readonly DashboardFinding[];
  readonly quarantineEntries: readonly QuarantineEntry[];
}

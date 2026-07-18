export type RuleInputType =
  | "owner_identity"
  | "installed_state"
  | "activity"
  | "open_file_state"
  | "target_existence"
  | "receipt"
  | "dependency"
  | "temporal"
  | "data_kind"
  | "capability"
  | "removal_method"
  | "duplicate_identity"
  | "name_match";

export type EvidenceOutcome = "confirmed" | "contradicted" | "unknown";

export interface EvidenceItem {
  readonly evidenceId: string;
  readonly ruleInputType: RuleInputType;
  readonly sourceAdapter: string;
  readonly outcome: EvidenceOutcome;
  readonly observedAt: string;
  readonly summary: string;
  readonly fingerprint: string;
}

export interface EvidenceSet {
  readonly schemaVersion: 1;
  readonly targetIdentity: string;
  readonly snapshotFingerprint: string;
  readonly supportLevel: "candidate" | "analysis_only" | "unsupported_manual";
  readonly sensitivityFlags: readonly (
    | "credentials"
    | "tokens"
    | "subscription_url"
    | "personal_data"
    | "database"
    | "local_project"
  )[];
  readonly recommendedRemovalMethod:
    | "quarantine"
    | "official_uninstaller"
    | "advanced_mode"
    | "inspect_only";
  readonly stale: boolean;
  readonly items: readonly EvidenceItem[];
}

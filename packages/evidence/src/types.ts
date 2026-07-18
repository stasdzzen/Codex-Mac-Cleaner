export type RuleInputType =
  | "owner_binding"
  | "artifact_existence"
  | "owner_application"
  | "owner_executable"
  | "activity"
  | "open_file_state"
  | "startup_target"
  | "receipt_lifecycle"
  | "official_uninstaller"
  | "dependency"
  | "temporal"
  | "data_kind"
  | "capability"
  | "requirement_profile"
  /** Legacy v1 inputs remain analysis-only and never create v2 authority. */
  | "owner_identity"
  | "installed_state"
  | "target_existence"
  | "receipt"
  | "removal_method"
  | "duplicate_identity"
  | "name_match";

export type EvidenceOutcome = "confirmed" | "contradicted" | "unknown";

export interface CorrelationStateByInput {
  readonly owner_identity: "confirmed" | "mismatch" | "unknown";
  readonly installed_state: "present" | "absent" | "unknown";
  readonly activity: "present" | "absent" | "unknown";
  readonly open_file_state: "present" | "absent" | "unknown";
  readonly target_existence: "present" | "absent" | "unknown";
  readonly receipt: "present" | "absent" | "unknown";
  readonly dependency: "present" | "absent" | "unknown";
  readonly temporal: "current" | "stale" | "unknown";
  readonly data_kind: "known" | "unsafe" | "unknown";
  readonly capability: "available" | "missing" | "unknown";
}

export type CorrelationRuleInputType = keyof CorrelationStateByInput;

interface ServerCorrelationSignalBase {
  readonly schemaVersion: 1;
  readonly targetRef: string;
  readonly observedAt: string;
  readonly fingerprint: string;
}

export type ServerCorrelationSignal = {
  [Input in CorrelationRuleInputType]: Readonly<
    ServerCorrelationSignalBase & {
      readonly ruleInputType: Input;
      readonly state: CorrelationStateByInput[Input];
    }
  >;
}[CorrelationRuleInputType];

export type ServerCorrelationSignalInput<Input extends CorrelationRuleInputType> =
  Readonly<
    ServerCorrelationSignalBase & {
      readonly ruleInputType: Input;
      readonly state: CorrelationStateByInput[Input];
    }
  >;

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
  readonly schemaVersion: 1 | 2;
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
  readonly authority?:
    | Readonly<{ mode: "legacy_non_actionable" }>
    | Readonly<{
        mode: "correlation_revision" | "correlation_revision_v2";
        correlationRevisionId: string;
        auditRevision: number;
        snapshotBFingerprint: string;
        edgeSetDigest: string;
        coverageReportDigest: string;
        ownerBindingFingerprint?: string;
        requirementProfileId?: "private_regenerable_remnant_v1" | "inspection_only_v1";
        requirementProfileFingerprint?: string;
        ruleSetVersion: number;
        policyVersion: number;
        derivationVersion: number;
        exclusionStateVersion: number;
      }>;
  readonly items: readonly EvidenceItem[];
}

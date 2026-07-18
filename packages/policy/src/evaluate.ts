import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import type {
  EvidenceOutcome,
  EvidenceSet,
  RuleInputType,
} from "@codex-mac-cleaner/evidence";

import { protectedRuleId } from "./protected-scopes.js";
import type {
  AllowedAction,
  PolicyDecision,
  PolicyInput,
  RecommendedRemovalMethod,
  SnapshotFingerprint,
} from "./types.js";

const ANALYSIS_ONLY_CATEGORIES = new Set<PolicyInput["category"]>([
  "group_container",
  "preference",
  "database",
  "sync_data",
  "vpn_data",
  "personal_file",
  "unknown",
]);

function fingerprintsEqual(
  expected: SnapshotFingerprint,
  current: SnapshotFingerprint,
): boolean {
  return (
    expected.device === current.device &&
    expected.inode === current.inode &&
    expected.mode === current.mode &&
    expected.uid === current.uid &&
    expected.gid === current.gid &&
    expected.size === current.size &&
    expected.mtimeNs === current.mtimeNs &&
    expected.ctimeNs === current.ctimeNs &&
    expected.fileType === current.fileType &&
    expected.mountId === current.mountId &&
    expected.symbolicLink === current.symbolicLink &&
    expected.linkCount === current.linkCount
  );
}

function outcomeFor(
  evidence: EvidenceSet,
  ruleInputType: RuleInputType,
): EvidenceOutcome | undefined {
  const outcomes = new Set(
    evidence.items
      .filter((item) => item.ruleInputType === ruleInputType)
      .map((item) => item.outcome),
  );
  if (outcomes.size !== 1) return outcomes.size === 0 ? undefined : "unknown";
  return [...outcomes][0];
}

function classificationsEqual(
  provided: Classification,
  canonical: Classification,
): boolean {
  return (
    provided.label === canonical.label &&
    provided.confidence === canonical.confidence &&
    provided.explanation === canonical.explanation &&
    provided.ruleIds.length === canonical.ruleIds.length &&
    provided.ruleIds.every((value, index) => value === canonical.ruleIds[index]) &&
    provided.counterEvidence.length === canonical.counterEvidence.length &&
    provided.counterEvidence.every(
      (value, index) => value === canonical.counterEvidence[index],
    ) &&
    provided.missingEvidence.length === canonical.missingEvidence.length &&
    provided.missingEvidence.every(
      (value, index) => value === canonical.missingEvidence[index],
    )
  );
}

function isActionableClassification(classification: Classification): boolean {
  return (
    classification.label === "orphaned" &&
    classification.confidence === "high" &&
    classification.ruleIds.length === 1 &&
    classification.ruleIds[0] ===
      "CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE" &&
    classification.counterEvidence.length === 0 &&
    classification.missingEvidence.length === 0
  );
}

export function selectRecommendedRemovalMethod(
  officialUninstallerApplicable: boolean,
  current: RecommendedRemovalMethod,
): RecommendedRemovalMethod {
  return officialUninstallerApplicable ? "official_uninstaller" : current;
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const blockingRuleIds: string[] = [];
  const warnings: string[] = [];
  const block = (ruleId: string): void => {
    if (!blockingRuleIds.includes(ruleId)) blockingRuleIds.push(ruleId);
  };

  const canonicalClassification = classifyEvidence(input.evidenceSet);
  const authority = input.evidenceSet.authority;
  if (
    authority?.mode !== "correlation_revision" ||
    input.correlationRevision === undefined
  ) {
    block("POLICY_CORRELATION_REVISION_REQUIRED");
  } else {
    const revision = input.correlationRevision;
    if (
      authority.correlationRevisionId !== revision.correlationRevisionId ||
      authority.auditRevision !== revision.auditRevision ||
      authority.snapshotBFingerprint !== revision.snapshotBFingerprint ||
      authority.edgeSetDigest !== revision.edgeSetDigest ||
      authority.coverageReportDigest !== revision.coverageReportDigest ||
      authority.ruleSetVersion !== revision.ruleSetVersion ||
      authority.policyVersion !== revision.policyVersion ||
      authority.derivationVersion !== revision.derivationVersion ||
      authority.exclusionStateVersion !== revision.exclusionStateVersion
    ) {
      block("POLICY_CORRELATION_BINDING_MISMATCH");
    }
    if (revision.staleDuringAudit) {
      block("POLICY_CORRELATION_SNAPSHOT_STALE");
    }
  }
  if (!classificationsEqual(input.classification, canonicalClassification)) {
    block("POLICY_CLASSIFICATION_EVIDENCE_MISMATCH");
  }
  if (
    input.supportLevel !== input.evidenceSet.supportLevel
  ) {
    block("POLICY_SUPPORT_LEVEL_MISMATCH");
  }
  if (
    input.supportLevel !== "candidate" ||
    input.evidenceSet.supportLevel !== "candidate"
  ) {
    block("POLICY_SUPPORT_LEVEL");
  }
  if (ANALYSIS_ONLY_CATEGORIES.has(input.category)) {
    block("POLICY_ANALYSIS_ONLY_CATEGORY");
  }
  if (input.category === "unknown") block("POLICY_UNKNOWN_CATEGORY");
  if (
    input.sensitivityFlags.length > 0 ||
    input.evidenceSet.sensitivityFlags.length > 0
  ) {
    block("POLICY_SENSITIVE_DATA");
  }

  if (
    !isActionableClassification(canonicalClassification) ||
    !isActionableClassification(input.classification)
  ) {
    block("POLICY_CLASSIFICATION_NOT_ACTIONABLE");
  }

  const ownerIdentity = outcomeFor(input.evidenceSet, "owner_identity");
  const installedState = outcomeFor(input.evidenceSet, "installed_state");
  const activityState = outcomeFor(input.evidenceSet, "activity");
  const openFileState = outcomeFor(input.evidenceSet, "open_file_state");
  const startupTargetState = outcomeFor(input.evidenceSet, "startup_target");
  const targetExistence = outcomeFor(input.evidenceSet, "target_existence");
  const receiptState = outcomeFor(input.evidenceSet, "receipt");
  const officialUninstallerState = outcomeFor(
    input.evidenceSet,
    "official_uninstaller",
  );
  const dependencyState = outcomeFor(input.evidenceSet, "dependency");
  const temporalState = outcomeFor(input.evidenceSet, "temporal");
  const dataKindState = outcomeFor(input.evidenceSet, "data_kind");
  const capabilityState = outcomeFor(input.evidenceSet, "capability");

  if (ownerIdentity === undefined || ownerIdentity === "unknown") {
    block("POLICY_OWNER_IDENTITY_MISSING");
  }
  if (ownerIdentity === "contradicted") block("POLICY_OWNER_MISMATCH");
  if (installedState === "confirmed") block("POLICY_INSTALLED_OWNER_PRESENT");
  if (installedState === undefined || installedState === "unknown") {
    block("POLICY_INSTALLED_STATE_UNKNOWN");
  }
  if (activityState === "confirmed") block("POLICY_ACTIVE_PROCESS");
  if (activityState === undefined || activityState === "unknown") {
    block("POLICY_ACTIVITY_UNKNOWN");
  }
  if (openFileState === "confirmed") block("POLICY_OPEN_FILE");
  if (openFileState === undefined || openFileState === "unknown") {
    block("POLICY_OPEN_FILE_UNKNOWN");
  }
  if (startupTargetState === "confirmed") block("POLICY_STARTUP_TARGET_PRESENT");
  if (startupTargetState === undefined || startupTargetState === "unknown") {
    block("POLICY_STARTUP_TARGET_UNKNOWN");
  }
  if (targetExistence === "contradicted") block("POLICY_TARGET_MISSING");
  if (targetExistence === undefined || targetExistence === "unknown") {
    block("POLICY_TARGET_EXISTENCE_UNKNOWN");
  }
  if (receiptState === "confirmed") block("POLICY_RECEIPT_PRESENT");
  if (receiptState === undefined || receiptState === "unknown") {
    block("POLICY_RECEIPT_UNKNOWN");
  }
  if (officialUninstallerState === "confirmed") {
    block("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
  }
  if (
    officialUninstallerState === undefined ||
    officialUninstallerState === "unknown"
  ) {
    block("POLICY_OFFICIAL_UNINSTALLER_UNKNOWN");
  }
  if (dependencyState === "confirmed") block("POLICY_DEPENDENCY_PRESENT");
  if (dependencyState === undefined || dependencyState === "unknown") {
    block("POLICY_DEPENDENCY_UNKNOWN");
  }
  if (temporalState === "contradicted" || input.evidenceSet.stale) {
    block("POLICY_STALE_EVIDENCE");
  }
  if (temporalState === undefined || temporalState === "unknown") {
    block("POLICY_TEMPORAL_UNKNOWN");
  }
  if (dataKindState !== "confirmed") block("POLICY_DATA_KIND_UNKNOWN");
  if (capabilityState !== "confirmed") block("POLICY_CAPABILITY_MISSING");

  for (const kind of input.protectedScopeKinds) block(protectedRuleId(kind));

  if (input.exclusionMatch.status === "matched") {
    block("POLICY_USER_EXCLUSION_MATCHED");
  } else if (input.exclusionMatch.status === "invalid") {
    block("POLICY_EXCLUSION_STATE_INVALID");
  } else if (input.exclusionMatch.status === "identity_mismatch") {
    warnings.push(input.exclusionMatch.errorCode);
  }

  if (
    input.officialUninstallerApplicable ||
    input.evidenceSet.recommendedRemovalMethod === "official_uninstaller"
  ) {
    block("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
  } else if (input.evidenceSet.recommendedRemovalMethod !== "quarantine") {
    block("POLICY_NON_QUARANTINE_REMOVAL_METHOD");
  }
  if (!fingerprintsEqual(input.snapshotFingerprint, input.currentFingerprint)) {
    block("POLICY_STALE_FINGERPRINT");
  }
  if (!input.pathValidation.ok) block(input.pathValidation.errorCode);

  const analysisOnly =
    input.supportLevel !== "candidate" ||
    input.evidenceSet.supportLevel !== "candidate" ||
    ANALYSIS_ONLY_CATEGORIES.has(input.category);
  const allowedActions: AllowedAction[] = analysisOnly
    ? ["inspect", "exclude"]
    : blockingRuleIds.length === 0
      ? ["inspect", "reveal", "exclude", "prepare_move"]
      : ["inspect", "reveal", "exclude"];

  return {
    allowedActions,
    blockingRuleIds,
    warnings,
    evaluatedFingerprint: Object.freeze({ ...input.snapshotFingerprint }),
  };
}

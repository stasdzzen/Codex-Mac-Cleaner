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

  if (input.supportLevel !== "candidate") block("POLICY_SUPPORT_LEVEL");
  if (ANALYSIS_ONLY_CATEGORIES.has(input.category)) {
    block("POLICY_ANALYSIS_ONLY_CATEGORY");
  }
  if (input.sensitivityFlags.length > 0) block("POLICY_SENSITIVE_DATA");

  if (
    input.classification.label !== "orphaned" ||
    input.classification.confidence !== "high" ||
    input.classification.ruleIds.length === 0 ||
    input.classification.missingEvidence.length > 0
  ) {
    block("POLICY_CLASSIFICATION_NOT_ACTIONABLE");
  }

  if (input.ownerIdentityState === "unknown") block("POLICY_OWNER_IDENTITY_MISSING");
  if (input.ownerIdentityState === "mismatch") block("POLICY_OWNER_MISMATCH");
  if (input.installedState === "present") block("POLICY_INSTALLED_OWNER_PRESENT");
  if (input.installedState === "unknown") block("POLICY_INSTALLED_STATE_UNKNOWN");
  if (input.activityState === "present") block("POLICY_ACTIVE_PROCESS");
  if (input.activityState === "unknown") block("POLICY_ACTIVITY_UNKNOWN");
  if (input.openFileState === "present") block("POLICY_OPEN_FILE");
  if (input.openFileState === "unknown") block("POLICY_OPEN_FILE_UNKNOWN");
  if (input.targetExistenceState === "absent") block("POLICY_TARGET_MISSING");
  if (input.targetExistenceState === "unknown") {
    block("POLICY_TARGET_EXISTENCE_UNKNOWN");
  }
  if (input.receiptState === "present") block("POLICY_RECEIPT_PRESENT");
  if (input.receiptState === "unknown") block("POLICY_RECEIPT_UNKNOWN");
  if (input.dependencyState === "present") block("POLICY_DEPENDENCY_PRESENT");
  if (input.dependencyState === "unknown") block("POLICY_DEPENDENCY_UNKNOWN");
  if (input.temporalState === "stale") block("POLICY_STALE_EVIDENCE");
  if (input.temporalState === "unknown") block("POLICY_TEMPORAL_UNKNOWN");
  if (input.dataKindState === "unknown") block("POLICY_DATA_KIND_UNKNOWN");
  if (input.capabilityState !== "available") block("POLICY_CAPABILITY_MISSING");

  for (const kind of input.protectedScopeKinds) block(protectedRuleId(kind));

  if (input.exclusionMatch.status === "matched") {
    block("POLICY_USER_EXCLUSION_MATCHED");
  } else if (input.exclusionMatch.status === "invalid") {
    block("POLICY_EXCLUSION_STATE_INVALID");
  } else if (input.exclusionMatch.status === "identity_mismatch") {
    warnings.push(input.exclusionMatch.errorCode);
  }

  if (input.officialUninstallerApplicable) {
    block("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
  }
  if (!fingerprintsEqual(input.snapshotFingerprint, input.currentFingerprint)) {
    block("POLICY_STALE_FINGERPRINT");
  }
  if (!input.pathValidation.ok) block(input.pathValidation.errorCode);

  const analysisOnly =
    input.supportLevel !== "candidate" || ANALYSIS_ONLY_CATEGORIES.has(input.category);
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

import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import type { EvidenceOutcome, EvidenceSet, RuleInputType } from "@codex-mac-cleaner/evidence";

import { protectedRuleId } from "./protected-scopes.js";
import type {
  AllowedAction,
  PolicyDecision,
  PolicyInput,
  RecommendedRemovalMethod,
  SnapshotFingerprint,
} from "./types.js";

const ACTIONABLE_CATEGORIES = new Set<PolicyInput["category"]>(["cache", "log"]);

function fingerprintsEqual(expected: SnapshotFingerprint, current: SnapshotFingerprint): boolean {
  return expected.device === current.device &&
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
    expected.linkCount === current.linkCount;
}

function outcomeFor(evidence: EvidenceSet, ruleInputType: RuleInputType): EvidenceOutcome | undefined {
  const outcomes = new Set(evidence.items
    .filter((item) => item.ruleInputType === ruleInputType)
    .map((item) => item.outcome));
  return outcomes.size === 1 ? [...outcomes][0] : outcomes.size === 0 ? undefined : "unknown";
}

function classificationsEqual(provided: Classification, canonical: Classification): boolean {
  return provided.label === canonical.label &&
    provided.confidence === canonical.confidence &&
    provided.explanation === canonical.explanation &&
    provided.ruleIds.length === canonical.ruleIds.length &&
    provided.ruleIds.every((value, index) => value === canonical.ruleIds[index]) &&
    provided.counterEvidence.length === canonical.counterEvidence.length &&
    provided.counterEvidence.every((value, index) => value === canonical.counterEvidence[index]) &&
    provided.missingEvidence.length === canonical.missingEvidence.length &&
    provided.missingEvidence.every((value, index) => value === canonical.missingEvidence[index]);
}

function isActionableClassification(classification: Classification): boolean {
  return classification.label === "orphaned" &&
    classification.confidence === "high" &&
    classification.ruleIds.length === 1 &&
    classification.ruleIds[0] === "CLASSIFIER_V2_ORPHANED_LIBRARY_REMNANT" &&
    classification.counterEvidence.length === 0 &&
    classification.missingEvidence.length === 0;
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
  const revision = input.correlationRevision;
  if (
    input.evidenceSet.schemaVersion !== 2 ||
    authority?.mode !== "correlation_revision_v2" ||
    revision === undefined ||
    revision.schemaVersion !== 2
  ) {
    block("POLICY_CORRELATION_REVISION_REQUIRED");
  } else {
    if (
      authority.correlationRevisionId !== revision.correlationRevisionId ||
      authority.auditRevision !== revision.auditRevision ||
      authority.snapshotBFingerprint !== revision.snapshotBFingerprint ||
      authority.edgeSetDigest !== revision.edgeSetDigest ||
      authority.coverageReportDigest !== revision.coverageReportDigest ||
      authority.ownerBindingFingerprint !== revision.ownerBindingFingerprint ||
      authority.requirementProfileId !== revision.requirementProfileId ||
      authority.requirementProfileFingerprint !== revision.requirementProfileFingerprint ||
      authority.ruleSetVersion !== revision.ruleSetVersion ||
      authority.policyVersion !== revision.policyVersion ||
      authority.derivationVersion !== revision.derivationVersion ||
      authority.exclusionStateVersion !== revision.exclusionStateVersion
    ) block("POLICY_CORRELATION_BINDING_MISMATCH");
    if (revision.requirementProfileId !== "private_regenerable_remnant_v1") {
      block("POLICY_REQUIREMENT_PROFILE_UNSUPPORTED");
    }
    if (revision.staleDuringAudit) block("POLICY_CORRELATION_SNAPSHOT_STALE");
  }
  if (!classificationsEqual(input.classification, canonicalClassification)) {
    block("POLICY_CLASSIFICATION_EVIDENCE_MISMATCH");
  }
  if (input.supportLevel !== input.evidenceSet.supportLevel) block("POLICY_SUPPORT_LEVEL_MISMATCH");
  if (input.supportLevel !== "candidate" || input.evidenceSet.supportLevel !== "candidate") block("POLICY_SUPPORT_LEVEL");
  if (!ACTIONABLE_CATEGORIES.has(input.category)) {
    block(input.category === "unknown" ? "POLICY_UNKNOWN_CATEGORY" : "POLICY_ANALYSIS_ONLY_CATEGORY");
  }
  if (input.sensitivityFlags.length > 0 || input.evidenceSet.sensitivityFlags.length > 0) {
    block("POLICY_SENSITIVE_DATA");
  }
  if (!isActionableClassification(canonicalClassification) || !isActionableClassification(input.classification)) {
    block("POLICY_CLASSIFICATION_NOT_ACTIONABLE");
  }

  const ownerBinding = outcomeFor(input.evidenceSet, "owner_binding") ?? outcomeFor(input.evidenceSet, "owner_identity");
  const artifactExistence = outcomeFor(input.evidenceSet, "artifact_existence") ?? outcomeFor(input.evidenceSet, "target_existence");
  const ownerApplication = outcomeFor(input.evidenceSet, "owner_application") ?? outcomeFor(input.evidenceSet, "installed_state");
  const ownerExecutable = outcomeFor(input.evidenceSet, "owner_executable");
  const activity = outcomeFor(input.evidenceSet, "activity");
  const openFile = outcomeFor(input.evidenceSet, "open_file_state");
  const startup = outcomeFor(input.evidenceSet, "startup_target");
  const receipt = outcomeFor(input.evidenceSet, "receipt_lifecycle") ?? outcomeFor(input.evidenceSet, "receipt");
  const uninstaller = outcomeFor(input.evidenceSet, "official_uninstaller");
  const dependency = outcomeFor(input.evidenceSet, "dependency");
  const temporal = outcomeFor(input.evidenceSet, "temporal");
  const dataKind = outcomeFor(input.evidenceSet, "data_kind");
  const capability = outcomeFor(input.evidenceSet, "capability");
  const profile = outcomeFor(input.evidenceSet, "requirement_profile");

  if (ownerBinding === undefined || ownerBinding === "unknown") block("POLICY_OWNER_IDENTITY_MISSING");
  if (ownerBinding === "contradicted") block("POLICY_OWNER_MISMATCH");
  if (artifactExistence === "contradicted") block("POLICY_TARGET_MISSING");
  if (artifactExistence === undefined || artifactExistence === "unknown") block("POLICY_TARGET_EXISTENCE_UNKNOWN");
  if (ownerApplication === "confirmed") block("POLICY_INSTALLED_OWNER_PRESENT");
  if (ownerApplication === undefined || ownerApplication === "unknown") block("POLICY_INSTALLED_STATE_UNKNOWN");
  if (ownerExecutable === "confirmed") block("POLICY_OWNER_EXECUTABLE_PRESENT");
  if (ownerExecutable === undefined || ownerExecutable === "unknown") block("POLICY_OWNER_EXECUTABLE_UNKNOWN");
  if (activity === "confirmed") block("POLICY_ACTIVE_PROCESS");
  if (activity === undefined || activity === "unknown") block("POLICY_ACTIVITY_UNKNOWN");
  if (openFile === "confirmed") block("POLICY_OPEN_FILE");
  if (openFile === undefined || openFile === "unknown") block("POLICY_OPEN_FILE_UNKNOWN");
  if (startup === "confirmed") block("POLICY_STARTUP_TARGET_PRESENT");
  if (startup === undefined || startup === "unknown") block("POLICY_STARTUP_TARGET_UNKNOWN");
  if (receipt === "confirmed") block("POLICY_RECEIPT_PRESENT");
  if (receipt === undefined || receipt === "unknown") block("POLICY_RECEIPT_UNKNOWN");
  if (uninstaller === "confirmed") block("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
  if (uninstaller === undefined || uninstaller === "unknown") block("POLICY_OFFICIAL_UNINSTALLER_UNKNOWN");
  if (dependency === "confirmed") block("POLICY_DEPENDENCY_PRESENT");
  if (dependency === undefined || dependency === "unknown") block("POLICY_DEPENDENCY_UNKNOWN");
  if (temporal === "contradicted" || input.evidenceSet.stale) block("POLICY_STALE_EVIDENCE");
  if (temporal === undefined || temporal === "unknown") block("POLICY_TEMPORAL_UNKNOWN");
  if (dataKind !== "confirmed") block("POLICY_DATA_KIND_UNKNOWN");
  if (capability !== "confirmed") block("POLICY_CAPABILITY_MISSING");
  if (profile !== "confirmed") block("POLICY_REQUIREMENT_PROFILE_UNSUPPORTED");

  for (const kind of input.protectedScopeKinds) block(protectedRuleId(kind));
  if (input.exclusionMatch.status === "matched") block("POLICY_USER_EXCLUSION_MATCHED");
  else if (input.exclusionMatch.status === "invalid") block("POLICY_EXCLUSION_STATE_INVALID");
  else if (input.exclusionMatch.status === "identity_mismatch") warnings.push(input.exclusionMatch.errorCode);

  if (input.officialUninstallerApplicable || input.evidenceSet.recommendedRemovalMethod === "official_uninstaller") {
    block("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
  } else if (input.evidenceSet.recommendedRemovalMethod !== "quarantine") {
    block("POLICY_NON_QUARANTINE_REMOVAL_METHOD");
  }
  if (!fingerprintsEqual(input.snapshotFingerprint, input.currentFingerprint)) block("POLICY_STALE_FINGERPRINT");
  if (!input.pathValidation.ok) block(input.pathValidation.errorCode);

  const analysisOnly = input.supportLevel !== "candidate" ||
    input.evidenceSet.supportLevel !== "candidate" ||
    !ACTIONABLE_CATEGORIES.has(input.category);
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

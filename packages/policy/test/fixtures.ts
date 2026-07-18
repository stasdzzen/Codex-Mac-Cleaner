import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import type {
  EvidenceOutcome,
  EvidenceSet,
  RuleInputType,
} from "@codex-mac-cleaner/evidence";

import type {
  PathGuardInput,
  PolicyInput,
  SnapshotFingerprint,
} from "../src/index.js";

export const syntheticRoot = "/synthetic/Library/Caches";
export const syntheticCandidate = `${syntheticRoot}/artifact-a`;

const safeOutcomes: Readonly<Record<RuleInputType, EvidenceOutcome>> = {
  owner_binding: "confirmed",
  artifact_existence: "confirmed",
  owner_application: "contradicted",
  owner_executable: "contradicted",
  owner_identity: "confirmed",
  installed_state: "contradicted",
  activity: "contradicted",
  open_file_state: "contradicted",
  startup_target: "contradicted",
  target_existence: "confirmed",
  receipt: "contradicted",
  official_uninstaller: "contradicted",
  dependency: "contradicted",
  temporal: "confirmed",
  data_kind: "confirmed",
  capability: "confirmed",
  requirement_profile: "confirmed",
  receipt_lifecycle: "contradicted",
  removal_method: "contradicted",
  duplicate_identity: "contradicted",
  name_match: "contradicted",
};

export const safeEvidenceSet: EvidenceSet = {
  schemaVersion: 2,
  targetIdentity: `target:v1:${"a".repeat(64)}`,
  snapshotFingerprint: `snapshot:v1:${"b".repeat(64)}`,
  supportLevel: "candidate",
  sensitivityFlags: [],
  recommendedRemovalMethod: "quarantine",
  stale: false,
  authority: {
    mode: "correlation_revision_v2",
    correlationRevisionId: "correlation-revision-synthetic-a",
    auditRevision: 1,
    snapshotBFingerprint: `sha256:v1:${"2".repeat(64)}`,
    edgeSetDigest: `sha256:v1:${"3".repeat(64)}`,
    coverageReportDigest: `sha256:v1:${"4".repeat(64)}`,
    ownerBindingFingerprint: `sha256:v1:${"6".repeat(64)}`,
    requirementProfileId: "private_regenerable_remnant_v1",
    requirementProfileFingerprint: `sha256:v1:${"7".repeat(64)}`,
    ruleSetVersion: 2,
    policyVersion: 2,
    derivationVersion: 1,
    exclusionStateVersion: 1,
  },
  items: [
    "owner_binding",
    "artifact_existence",
    "owner_application",
    "owner_executable",
    "activity",
    "open_file_state",
    "startup_target",
    "receipt_lifecycle",
    "official_uninstaller",
    "dependency",
    "temporal",
    "data_kind",
    "capability",
    "requirement_profile",
  ].map((ruleInputType) => ({
    evidenceId: `evidence-${ruleInputType.replaceAll("_", "-")}`,
    ruleInputType: ruleInputType as RuleInputType,
    sourceAdapter: "server_correlation",
    outcome: safeOutcomes[ruleInputType as RuleInputType],
    observedAt: "2026-07-18T00:00:00.000Z",
    summary: "Синтетическое нормализованное доказательство",
    fingerprint: `evidence:v1:${ruleInputType.replaceAll("_", "-")}`,
  })),
};

export const orphanedClassification: Classification = classifyEvidence(safeEvidenceSet);

export const snapshotFingerprint: SnapshotFingerprint = {
  device: "device-a",
  inode: "inode-a",
  mode: 0o700,
  uid: 501,
  gid: 20,
  size: 84,
  mtimeNs: "1000000",
  ctimeNs: "1000000",
  fileType: "directory",
  mountId: "mount-a",
  symbolicLink: false,
  linkCount: 2,
};

export const safePathGuardInput: PathGuardInput = {
  root: syntheticRoot,
  candidate: syntheticCandidate,
  expectedOwnerUid: 501,
  expectedDevice: "device-a",
  expectedMountId: "mount-a",
  expectedFileType: "directory",
  ancestry: [
    {
      canonicalPath: syntheticRoot,
      uid: 501,
      device: "device-a",
      mountId: "mount-a",
      fileType: "directory",
      symbolicLink: false,
      mountPoint: false,
      linkCount: 2,
      gitMarker: null,
    },
    {
      canonicalPath: syntheticCandidate,
      uid: 501,
      device: "device-a",
      mountId: "mount-a",
      fileType: "directory",
      symbolicLink: false,
      mountPoint: false,
      linkCount: 2,
      gitMarker: null,
    },
  ],
};

export const safeFinding: PolicyInput = {
  classification: orphanedClassification,
  evidenceSet: safeEvidenceSet,
  correlationRevision: {
    schemaVersion: 2,
    derivationVersion: 1,
    correlationRevisionId: "correlation-revision-synthetic-a",
    auditId: "audit-synthetic-a",
    auditRevision: 1,
    snapshotId: "snapshot-synthetic-a",
    snapshotAFingerprint: `sha256:v1:${"2".repeat(64)}`,
    snapshotBFingerprint: `sha256:v1:${"2".repeat(64)}`,
    subjectSetDigest: `sha256:v1:${"5".repeat(64)}`,
    edgeSetDigest: `sha256:v1:${"3".repeat(64)}`,
    coverageReportDigest: `sha256:v1:${"4".repeat(64)}`,
    ownerBindingFingerprint: `sha256:v1:${"6".repeat(64)}`,
    requirementProfileId: "private_regenerable_remnant_v1",
    requirementProfileVersion: 1,
    requirementProfileFingerprint: `sha256:v1:${"7".repeat(64)}`,
    ruleSetVersion: 2,
    policyVersion: 2,
    exclusionStateVersion: 1,
    staleDuringAudit: false,
    createdAt: "2026-07-18T00:00:00.000Z",
  },
  supportLevel: "candidate",
  category: "cache",
  sensitivityFlags: [],
  protectedScopeKinds: [],
  exclusionMatch: { status: "none" },
  officialUninstallerApplicable: false,
  snapshotFingerprint,
  currentFingerprint: snapshotFingerprint,
  pathValidation: {
    ok: true,
    canonicalPath: syntheticCandidate,
  },
};

export function withEvidenceOutcome(
  input: PolicyInput,
  ruleInputType: RuleInputType,
  outcome: EvidenceOutcome,
): PolicyInput {
  const aliases: Partial<Record<RuleInputType, RuleInputType>> = {
    owner_identity: "owner_binding",
    installed_state: "owner_application",
    target_existence: "artifact_existence",
    receipt: "receipt_lifecycle",
  };
  const effectiveType = aliases[ruleInputType] ?? ruleInputType;
  const evidenceSet: EvidenceSet = {
    ...input.evidenceSet,
    items: input.evidenceSet.items.map((item) =>
      item.ruleInputType === effectiveType ? { ...item, outcome } : item,
    ),
  };
  return {
    ...input,
    evidenceSet,
    classification: classifyEvidence(evidenceSet),
  };
}

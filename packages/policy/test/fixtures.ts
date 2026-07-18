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
  owner_identity: "confirmed",
  installed_state: "contradicted",
  activity: "contradicted",
  open_file_state: "contradicted",
  target_existence: "confirmed",
  receipt: "contradicted",
  dependency: "contradicted",
  temporal: "confirmed",
  data_kind: "confirmed",
  capability: "confirmed",
  removal_method: "contradicted",
  duplicate_identity: "contradicted",
  name_match: "contradicted",
};

export const safeEvidenceSet: EvidenceSet = {
  schemaVersion: 1,
  targetIdentity: `target:v1:${"a".repeat(64)}`,
  snapshotFingerprint: `snapshot:v1:${"b".repeat(64)}`,
  supportLevel: "candidate",
  sensitivityFlags: [],
  recommendedRemovalMethod: "quarantine",
  stale: false,
  items: [
    "owner_identity",
    "installed_state",
    "activity",
    "open_file_state",
    "target_existence",
    "receipt",
    "dependency",
    "temporal",
    "data_kind",
    "capability",
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
  const evidenceSet: EvidenceSet = {
    ...input.evidenceSet,
    items: input.evidenceSet.items.map((item) =>
      item.ruleInputType === ruleInputType ? { ...item, outcome } : item,
    ),
  };
  return {
    ...input,
    evidenceSet,
    classification: classifyEvidence(evidenceSet),
  };
}

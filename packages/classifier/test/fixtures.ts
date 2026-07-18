import type {
  EvidenceItem,
  EvidenceSet,
  RuleInputType,
} from "@codex-mac-cleaner/evidence";

const observedAt = "2026-07-18T00:00:00.000Z";

const outcomes: Readonly<Record<RuleInputType, EvidenceItem["outcome"]>> = {
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
  name_match: "confirmed",
};

function item(ruleInputType: RuleInputType): EvidenceItem {
  return {
    evidenceId: `evidence-${ruleInputType.replaceAll("_", "-")}`,
    ruleInputType,
    sourceAdapter: "synthetic_adapter",
    outcome: outcomes[ruleInputType],
    observedAt,
    summary: "Синтетическое нормализованное доказательство",
    fingerprint: `evidence:v1:${ruleInputType.replaceAll("_", "-")}`,
  };
}

export const completeOrphanEvidence: EvidenceSet = {
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
    "removal_method",
    "duplicate_identity",
  ].map((input) => item(input as RuleInputType)),
};

export function withOutcome(
  evidence: EvidenceSet,
  ruleInputType: RuleInputType,
  outcome: EvidenceItem["outcome"],
): EvidenceSet {
  return {
    ...evidence,
    items: evidence.items.map((entry) =>
      entry.ruleInputType === ruleInputType ? { ...entry, outcome } : entry,
    ),
  };
}

export const nameOnlyEvidence: EvidenceSet = {
  ...completeOrphanEvidence,
  items: [item("name_match")],
};

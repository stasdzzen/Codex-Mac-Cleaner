import type { RuleInputType } from "@codex-mac-cleaner/evidence";

export type ClassificationLabel =
  | "active_required"
  | "idle_reproducible"
  | "orphaned"
  | "duplicate"
  | "unknown";

export interface Classification {
  readonly label: ClassificationLabel;
  readonly confidence: "high" | "medium" | "low";
  readonly ruleIds: readonly string[];
  readonly explanation: string;
  readonly counterEvidence: readonly RuleInputType[];
  readonly missingEvidence: readonly RuleInputType[];
}

export interface ClassifierRule {
  readonly ruleId: string;
  readonly version: 1;
  readonly label: ClassificationLabel;
}

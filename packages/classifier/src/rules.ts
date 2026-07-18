import type {
  EvidenceOutcome,
  EvidenceSet,
  RuleInputType,
} from "@codex-mac-cleaner/evidence";

import type { Classification, ClassifierRule } from "./types.js";

const REQUIRED_EVIDENCE: readonly RuleInputType[] = [
  "owner_identity",
  "installed_state",
  "activity",
  "open_file_state",
  "startup_target",
  "target_existence",
  "receipt",
  "official_uninstaller",
  "dependency",
  "temporal",
  "data_kind",
];

export const CLASSIFIER_RULES: readonly ClassifierRule[] = Object.freeze(
  [
    {
      ruleId: "CLASSIFIER_V1_ACTIVE_OR_OPEN",
      version: 1 as const,
      label: "active_required" as const,
    },
    {
      ruleId: "CLASSIFIER_V1_DUPLICATE_IDENTITY",
      version: 1 as const,
      label: "duplicate" as const,
    },
    {
      ruleId: "CLASSIFIER_V1_IDLE_REPRODUCIBLE",
      version: 1 as const,
      label: "idle_reproducible" as const,
    },
    {
      ruleId: "CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE",
      version: 1 as const,
      label: "orphaned" as const,
    },
    {
      ruleId: "CLASSIFIER_V1_UNKNOWN_INCOMPLETE_EVIDENCE",
      version: 1 as const,
      label: "unknown" as const,
    },
  ].map((rule) => Object.freeze(rule)),
);

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

function unknown(
  evidence: EvidenceSet,
  additionalCounterEvidence: readonly RuleInputType[] = [],
): Classification {
  const missingEvidence = REQUIRED_EVIDENCE.filter((input) => {
    const outcome = outcomeFor(evidence, input);
    return outcome === undefined || outcome === "unknown";
  });
  const directionalCounterEvidence = [
    ["owner_identity", "confirmed"],
    ["target_existence", "confirmed"],
    ["temporal", "confirmed"],
    ["data_kind", "confirmed"],
  ]
    .filter(([input, expected]) => outcomeFor(evidence, input as RuleInputType) !== expected)
    .map(([input]) => input as RuleInputType)
    .filter((input) => !missingEvidence.includes(input));
  const counterEvidence = [...new Set([...additionalCounterEvidence, ...directionalCounterEvidence])]
    .sort((left, right) => REQUIRED_EVIDENCE.indexOf(left) - REQUIRED_EVIDENCE.indexOf(right));

  return {
    label: "unknown",
    confidence: "low",
    ruleIds: ["CLASSIFIER_V1_UNKNOWN_INCOMPLETE_EVIDENCE"],
    explanation: "Независимых доказательств недостаточно для безопасной классификации",
    counterEvidence,
    missingEvidence,
  };
}

export function classifyEvidence(evidence: EvidenceSet): Classification {
  const activity = outcomeFor(evidence, "activity");
  const openFile = outcomeFor(evidence, "open_file_state");
  if (activity === "confirmed" || openFile === "confirmed") {
    const counterEvidence = [
      ...(activity === "confirmed" ? (["activity"] as const) : []),
      ...(openFile === "confirmed" ? (["open_file_state"] as const) : []),
    ];
    return {
      label: "active_required",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_ACTIVE_OR_OPEN"],
      explanation: "Активность или открытый файл требуют сохранения объекта",
      counterEvidence,
      missingEvidence: [],
    };
  }

  if (outcomeFor(evidence, "duplicate_identity") === "confirmed") {
    return {
      label: "duplicate",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_DUPLICATE_IDENTITY"],
      explanation: "Устойчивая идентичность подтверждает дубликат",
      counterEvidence: [],
      missingEvidence: [],
    };
  }

  const missing = REQUIRED_EVIDENCE.filter((input) => {
    const outcome = outcomeFor(evidence, input);
    return outcome === undefined || outcome === "unknown";
  });
  if (missing.length > 0) return unknown(evidence);

  const stableCommon =
    outcomeFor(evidence, "owner_identity") === "confirmed" &&
    activity === "contradicted" &&
    openFile === "contradicted" &&
    outcomeFor(evidence, "startup_target") === "contradicted" &&
    outcomeFor(evidence, "target_existence") === "confirmed" &&
    outcomeFor(evidence, "receipt") === "contradicted" &&
    outcomeFor(evidence, "official_uninstaller") === "contradicted" &&
    outcomeFor(evidence, "dependency") === "contradicted" &&
    outcomeFor(evidence, "temporal") === "confirmed" &&
    outcomeFor(evidence, "data_kind") === "confirmed";

  if (stableCommon && outcomeFor(evidence, "installed_state") === "confirmed") {
    return {
      label: "idle_reproducible",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_IDLE_REPRODUCIBLE"],
      explanation: "Владелец установлен, а воспроизводимые данные сейчас не активны",
      counterEvidence: [],
      missingEvidence: [],
    };
  }

  if (stableCommon && outcomeFor(evidence, "installed_state") === "contradicted") {
    return {
      label: "orphaned",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE"],
      explanation: "Полный независимый набор доказательств указывает на остаток",
      counterEvidence: [],
      missingEvidence: [],
    };
  }

  const counterEvidence = REQUIRED_EVIDENCE.filter((input) => {
    const outcome = outcomeFor(evidence, input);
    if (input === "installed_state" || input === "activity" || input === "open_file_state") {
      return false;
    }
    if (
      input === "startup_target" ||
      input === "receipt" ||
      input === "official_uninstaller" ||
      input === "dependency"
    ) return outcome === "confirmed";
    return outcome === "contradicted";
  });
  return unknown(evidence, counterEvidence);
}

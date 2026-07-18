import { createHash } from "node:crypto";

import type { Observation } from "@codex-mac-cleaner/adapters";

import { createServerCorrelationSignal } from "./correlation.js";

import type {
  EvidenceItem,
  EvidenceOutcome,
  EvidenceSet,
  RuleInputType,
  ServerCorrelationSignal,
} from "./types.js";

const EPOCH = "1970-01-01T00:00:00.000Z";

const summaries: Readonly<Record<RuleInputType, string>> = {
  owner_identity: "Идентичность владельца проверена структурированным источником",
  installed_state: "Состояние установки проверено структурированным источником",
  activity: "Состояние процесса проверено структурированным источником",
  open_file_state: "Состояние открытых файлов проверено структурированным источником",
  startup_target: "Состояние startup target проверено структурированным источником",
  target_existence: "Существование цели проверено структурированным источником",
  receipt: "Состояние receipt проверено структурированным источником",
  official_uninstaller: "Наличие официального uninstaller проверено структурированным источником",
  dependency: "Зависимости проверены структурированным источником",
  temporal: "Актуальность наблюдения проверена структурированным источником",
  data_kind: "Тип данных проверен структурированным источником",
  capability: "Доступность источника проверена структурированным источником",
  removal_method: "Способ удаления подтверждён структурированным источником",
  duplicate_identity: "Дубликат проверен по устойчивой идентичности",
  name_match: "Совпадение имени учтено только как слабое доказательство",
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeObservedAt(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && value.includes("T") ? value : EPOCH;
}

function signalsFor(
  observation: Observation,
): readonly [RuleInputType, EvidenceOutcome][] {
  switch (observation.evidenceKind) {
    case "installed_app":
      return [
        ["installed_state", "confirmed"],
        ["owner_identity", "confirmed"],
      ];
    case "library_artifact":
      return [
        ["data_kind", "confirmed"],
        ["target_existence", "confirmed"],
      ];
    case "process_activity":
      return [["activity", "confirmed"]];
    case "open_file":
      return [["open_file_state", "confirmed"]];
    case "startup_item":
      return [["startup_target", "confirmed"]];
    case "missing_executable":
      return [["target_existence", "contradicted"]];
    case "receipt":
      return [["receipt", "confirmed"]];
    case "stale_receipt":
      return [
        ["receipt", "confirmed"],
        ["temporal", "contradicted"],
      ];
    case "official_uninstaller":
      return [
        ["official_uninstaller", "confirmed"],
        ["removal_method", "confirmed"],
      ];
    case "filesystem_metadata":
      return [["data_kind", "confirmed"]];
    case "apfs_observation":
    case "time_machine_observation":
      return [["capability", "confirmed"]];
    case "protected_container_metadata":
    case "system_inspection":
      return [["data_kind", "contradicted"]];
    case "tcp_listener":
      return [["activity", "confirmed"]];
  }
}

function correlationOutcome(signal: ServerCorrelationSignal): EvidenceOutcome {
  switch (signal.ruleInputType) {
    case "owner_identity":
      return signal.state === "confirmed"
        ? "confirmed"
        : signal.state === "mismatch"
          ? "contradicted"
          : "unknown";
    case "installed_state":
    case "activity":
    case "open_file_state":
    case "target_existence":
    case "receipt":
    case "dependency":
      return signal.state === "present"
        ? "confirmed"
        : signal.state === "absent"
          ? "contradicted"
          : "unknown";
    case "temporal":
      return signal.state === "current"
        ? "confirmed"
        : signal.state === "stale"
          ? "contradicted"
          : "unknown";
    case "data_kind":
      return signal.state === "known"
        ? "confirmed"
        : signal.state === "unsafe"
          ? "contradicted"
          : "unknown";
    case "capability":
      return signal.state === "available"
        ? "confirmed"
        : signal.state === "missing"
          ? "contradicted"
          : "unknown";
  }
}

function supportLevel(observations: readonly Observation[]): EvidenceSet["supportLevel"] {
  if (observations.some((item) => item.supportLevel === "unsupported_manual")) {
    return "unsupported_manual";
  }
  if (observations.some((item) => item.supportLevel === "analysis_only")) {
    return "analysis_only";
  }
  return "candidate";
}

function removalMethod(
  observations: readonly Observation[],
): EvidenceSet["recommendedRemovalMethod"] {
  if (observations.some((item) => item.recommendedMethod === "official_uninstaller")) {
    return "official_uninstaller";
  }
  if (observations.some((item) => item.recommendedMethod === "advanced_mode")) {
    return "advanced_mode";
  }
  if (observations.some((item) => item.recommendedMethod === "inspect_only")) {
    return "inspect_only";
  }
  return "quarantine";
}

function normalizeGroup(
  rawTarget: string,
  observations: readonly Observation[],
  correlations: readonly ServerCorrelationSignal[],
): EvidenceSet {
  const sorted = [...observations].sort((left, right) =>
    [left.source, left.evidenceKind, left.fingerprint, left.observationId]
      .join(":")
      .localeCompare(
        [right.source, right.evidenceKind, right.fingerprint, right.observationId].join(":"),
      ),
  );
  const items = new Map<string, EvidenceItem>();

  for (const observation of sorted) {
    for (const [ruleInputType, outcome] of signalsFor(observation)) {
      const material = [
        observation.source,
        observation.evidenceKind,
        observation.fingerprint,
        ruleInputType,
        outcome,
      ].join("\u0000");
      const fingerprint = `evidence:v1:${sha256(material)}`;
      const key = `${ruleInputType}:${outcome}:${fingerprint}`;
      items.set(key, {
        evidenceId: `evidence-${sha256(key).slice(0, 24)}`,
        ruleInputType,
        sourceAdapter: observation.source,
        outcome,
        observedAt: safeObservedAt(observation.observedAt),
        summary: summaries[ruleInputType],
        fingerprint,
      });
    }
  }

  for (const signal of correlations) {
    const outcome = correlationOutcome(signal);
    const material = [
      "server_correlation",
      signal.ruleInputType,
      signal.state,
      signal.fingerprint,
    ].join("\u0000");
    const fingerprint = `evidence:v1:${sha256(material)}`;
    const key = `${signal.ruleInputType}:${outcome}:${fingerprint}`;
    items.set(key, {
      evidenceId: `evidence-${sha256(key).slice(0, 24)}`,
      ruleInputType: signal.ruleInputType,
      sourceAdapter: "server_correlation",
      outcome,
      observedAt: safeObservedAt(signal.observedAt),
      summary: summaries[signal.ruleInputType],
      fingerprint,
    });
  }

  const normalizedItems = [...items.values()].sort((left, right) =>
    [left.ruleInputType, left.outcome, left.fingerprint]
      .join(":")
      .localeCompare([right.ruleInputType, right.outcome, right.fingerprint].join(":")),
  );
  const snapshotMaterial = [
    ...new Set([
      ...sorted.map((item) => item.fingerprint),
      ...correlations.map((signal) =>
        [signal.ruleInputType, signal.state, signal.fingerprint].join(":"),
      ),
    ]),
  ]
    .sort()
    .join("\u0000");
  const sensitivityFlags = [...new Set(sorted.flatMap((item) => item.sensitivityFlags))].sort();

  return {
    schemaVersion: 1,
    targetIdentity: `target:v1:${sha256(rawTarget)}`,
    snapshotFingerprint: `snapshot:v1:${sha256(snapshotMaterial)}`,
    supportLevel: supportLevel(sorted),
    sensitivityFlags,
    recommendedRemovalMethod: removalMethod(sorted),
    stale: sorted.some((item) => item.staleDuringAudit),
    authority: { mode: "legacy_non_actionable" },
    items: normalizedItems,
  };
}

export function normalizeObservations(
  observations: readonly Observation[],
): readonly EvidenceSet[] {
  return normalizeEvidence(observations, []);
}

export function normalizeEvidence(
  observations: readonly Observation[],
  rawCorrelations: readonly ServerCorrelationSignal[],
): readonly EvidenceSet[] {
  const grouped = new Map<string, Observation[]>();
  for (const observation of observations) {
    const existing = grouped.get(observation.targetRef) ?? [];
    existing.push(observation);
    grouped.set(observation.targetRef, existing);
  }

  const correlations = rawCorrelations.map((signal) =>
    createServerCorrelationSignal(signal),
  );
  const correlationsByTarget = new Map<string, ServerCorrelationSignal[]>();
  for (const signal of correlations) {
    if (!grouped.has(signal.targetRef)) {
      throw new TypeError("Correlation signal не связан с candidate observation");
    }
    const existing = correlationsByTarget.get(signal.targetRef) ?? [];
    existing.push(signal);
    correlationsByTarget.set(signal.targetRef, existing);
  }

  return [...grouped.entries()]
    .map(([target, group]) =>
      normalizeGroup(target, group, correlationsByTarget.get(target) ?? []),
    )
    .sort((left, right) => left.targetIdentity.localeCompare(right.targetIdentity));
}

import { describe, expect, it } from "vitest";

import { classifyEvidence } from "@codex-mac-cleaner/classifier";
import {
  createServerCorrelationSignal,
  normalizeEvidence,
  normalizeObservations,
  type CorrelationRuleInputType,
  type CorrelationStateByInput,
  type EvidenceSet,
  type ServerCorrelationSignal,
} from "@codex-mac-cleaner/evidence";

import { evaluatePolicy, type PolicyInput } from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const targetRef = "synthetic-target-a";
const observedAt = "2026-07-18T00:00:00.000Z";

const candidateObservations = [
  {
    observationId: "observation-library-a",
    targetRef,
    source: "user_library_artifacts",
    evidenceKind: "library_artifact",
    displayName: "Synthetic Artifact",
    supportLevel: "candidate",
    allowedActions: [],
    staleDuringAudit: false,
    observedAt,
    fingerprint: "fingerprint-library-a",
    logicalSize: 84,
    physicalSize: 42,
    sensitivityFlags: [],
    safeExplanation: "Синтетическое наблюдение",
  },
] as const satisfies Parameters<typeof normalizeEvidence>[0];

function signal<T extends CorrelationRuleInputType>(
  ruleInputType: T,
  state: CorrelationStateByInput[T],
): ServerCorrelationSignal {
  return createServerCorrelationSignal({
    schemaVersion: 1,
    targetRef,
    ruleInputType,
    state,
    observedAt,
    fingerprint: `correlation:v1:${"c".repeat(64)}`,
  });
}

function completeSafeSignals(): readonly ServerCorrelationSignal[] {
  return [
    signal("owner_identity", "confirmed"),
    signal("installed_state", "absent"),
    signal("activity", "absent"),
    signal("open_file_state", "absent"),
    signal("target_existence", "present"),
    signal("receipt", "absent"),
    signal("dependency", "absent"),
    signal("temporal", "current"),
    signal("data_kind", "known"),
    signal("capability", "available"),
  ];
}

function replaceSignal<T extends CorrelationRuleInputType>(
  signals: readonly ServerCorrelationSignal[],
  ruleInputType: T,
  state: CorrelationStateByInput[T],
): readonly ServerCorrelationSignal[] {
  return signals.map((entry) =>
    entry.ruleInputType === ruleInputType
      ? signal(ruleInputType, state)
      : entry,
  );
}

function policyInput(evidenceSet: EvidenceSet): PolicyInput {
  return {
    classification: classifyEvidence(evidenceSet),
    evidenceSet,
    supportLevel: evidenceSet.supportLevel,
    category: "cache",
    sensitivityFlags: evidenceSet.sensitivityFlags,
    protectedScopeKinds: [],
    exclusionMatch: { status: "none" },
    officialUninstallerApplicable: false,
    snapshotFingerprint: safeFinding.snapshotFingerprint,
    currentFingerprint: safeFinding.currentFingerprint,
    pathValidation: safeFinding.pathValidation,
  };
}

function runPipeline(signals: readonly ServerCorrelationSignal[]) {
  const evidenceSet = normalizeEvidence(candidateObservations, signals)[0]!;
  const classification = classifyEvidence(evidenceSet);
  const decision = evaluatePolicy({ ...policyInput(evidenceSet), classification });
  return { evidenceSet, classification, decision };
}

describe("public evidence → classifier → policy pipeline", () => {
  it("legacy correlation signals остаются non-actionable", () => {
    const result = runPipeline(completeSafeSignals());

    expect(result.classification.label).toBe("unknown");
    expect(result.classification.missingEvidence).toEqual(
      expect.arrayContaining(["startup_target", "official_uninstaller"]),
    );
    expect(result.decision.allowedActions).not.toContain("prepare_move");
    expect(result.decision.blockingRuleIds).toContain(
      "POLICY_CORRELATION_REVISION_REQUIRED",
    );
  });

  it("Observation-only API остаётся fail closed", () => {
    const evidenceSet = normalizeObservations(candidateObservations)[0]!;
    const classification = classifyEvidence(evidenceSet);
    const decision = evaluatePolicy({ ...policyInput(evidenceSet), classification });

    expect(classification.label).toBe("unknown");
    expect(classification.missingEvidence).toContain("owner_identity");
    expect(decision.allowedActions).not.toContain("prepare_move");
  });

  it("missing и unknown signals остаются non-actionable", () => {
    const missing = completeSafeSignals().filter(
      (entry) => entry.ruleInputType !== "installed_state",
    );
    const unknown = replaceSignal(
      completeSafeSignals(),
      "installed_state",
      "unknown",
    );

    for (const signals of [missing, unknown]) {
      const result = runPipeline(signals);
      expect(result.classification.label).toBe("unknown");
      expect(result.decision.allowedActions).not.toContain("prepare_move");
    }
  });

  it.each([
    ["active", replaceSignal(completeSafeSignals(), "activity", "present"), "POLICY_ACTIVE_PROCESS"],
    ["open", replaceSignal(completeSafeSignals(), "open_file_state", "present"), "POLICY_OPEN_FILE"],
    ["installed", replaceSignal(completeSafeSignals(), "installed_state", "present"), "POLICY_INSTALLED_OWNER_PRESENT"],
    ["receipt", replaceSignal(completeSafeSignals(), "receipt", "present"), "POLICY_RECEIPT_PRESENT"],
    ["dependency", replaceSignal(completeSafeSignals(), "dependency", "present"), "POLICY_DEPENDENCY_PRESENT"],
  ] as const)("counter-case %s блокирует mutation", (_name, signals, ruleId) => {
    const result = runPipeline(signals);

    expect(result.decision.allowedActions).not.toContain("prepare_move");
    expect(result.decision.blockingRuleIds).toContain(ruleId);
  });

  it("противоречивая classification не может разрешить mutation", () => {
    const active = runPipeline(
      replaceSignal(completeSafeSignals(), "activity", "present"),
    );
    const forgedInput = {
      ...policyInput(active.evidenceSet),
      classification: classifyEvidence(
        normalizeEvidence(candidateObservations, completeSafeSignals())[0]!,
      ),
    };
    const decision = evaluatePolicy(forgedInput);

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(
      "POLICY_CLASSIFICATION_EVIDENCE_MISMATCH",
    );
  });
});

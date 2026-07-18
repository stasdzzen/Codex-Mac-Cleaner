import { describe, expect, it } from "vitest";

import { evaluatePolicy } from "../src/index.js";
import { safeFinding, withEvidenceOutcome } from "./fixtures.js";

describe("fail-closed policy matrix", () => {
  it("разрешает prepare_move только для полностью подтверждённого safe candidate", () => {
    const decision = evaluatePolicy(safeFinding);

    expect(decision).toEqual({
      allowedActions: ["inspect", "reveal", "exclude", "prepare_move"],
      blockingRuleIds: [],
      warnings: [],
      evaluatedFingerprint: safeFinding.snapshotFingerprint,
    });
  });

  it.each([
    "group_container",
    "preference",
    "database",
    "sync_data",
    "vpn_data",
    "personal_file",
  ] as const)("оставляет категорию %s в analysis-only", (category) => {
    const decision = evaluatePolicy({ ...safeFinding, category });

    expect(decision.allowedActions).toEqual(["inspect", "exclude"]);
    expect(decision.blockingRuleIds).toContain("POLICY_ANALYSIS_ONLY_CATEGORY");
  });

  it("блокирует mutation для unknown category", () => {
    const decision = evaluatePolicy({ ...safeFinding, category: "unknown" });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain("POLICY_UNKNOWN_CATEGORY");
  });

  it.each(["analysis_only", "unsupported_manual"] as const)(
    "%s допускает inspect/exclude, но не prepare_move",
    (supportLevel) => {
      const decision = evaluatePolicy({ ...safeFinding, supportLevel });

      expect(decision.allowedActions).toEqual(["inspect", "exclude"]);
      expect(decision.allowedActions).not.toContain("prepare_move");
      expect(decision.blockingRuleIds).toContain("POLICY_SUPPORT_LEVEL");
    },
  );

  it("orphaned с открытым файлом блокируется", () => {
    const decision = evaluatePolicy(
      withEvidenceOutcome(safeFinding, "open_file_state", "confirmed"),
    );

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain("POLICY_OPEN_FILE");
  });

  it("кэш активного приложения блокируется", () => {
    const decision = evaluatePolicy(
      withEvidenceOutcome(safeFinding, "activity", "confirmed"),
    );

    expect(decision.blockingRuleIds).toContain("POLICY_ACTIVE_PROCESS");
  });

  it.each([
    "credentials",
    "tokens",
    "subscription_url",
    "personal_data",
    "database",
    "local_project",
  ] as const)("sensitivity %s блокирует mutation", (flag) => {
    const decision = evaluatePolicy({ ...safeFinding, sensitivityFlags: [flag] });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain("POLICY_SENSITIVE_DATA");
  });

  it.each([
    ["owner_identity", "unknown", "POLICY_OWNER_IDENTITY_MISSING"],
    ["owner_identity", "contradicted", "POLICY_OWNER_MISMATCH"],
    ["installed_state", "unknown", "POLICY_INSTALLED_STATE_UNKNOWN"],
    ["activity", "unknown", "POLICY_ACTIVITY_UNKNOWN"],
    ["open_file_state", "unknown", "POLICY_OPEN_FILE_UNKNOWN"],
    ["target_existence", "unknown", "POLICY_TARGET_EXISTENCE_UNKNOWN"],
    ["receipt", "unknown", "POLICY_RECEIPT_UNKNOWN"],
    ["dependency", "unknown", "POLICY_DEPENDENCY_UNKNOWN"],
    ["temporal", "unknown", "POLICY_TEMPORAL_UNKNOWN"],
    ["data_kind", "unknown", "POLICY_DATA_KIND_UNKNOWN"],
    ["capability", "contradicted", "POLICY_CAPABILITY_MISSING"],
  ] as const)("fail closed для %s=%s", (inputType, outcome, ruleId) => {
    const decision = evaluatePolicy(
      withEvidenceOutcome(safeFinding, inputType, outcome),
    );

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(ruleId);
  });

  it.each([
    ["installed_state", "confirmed", "POLICY_INSTALLED_OWNER_PRESENT"],
    ["target_existence", "contradicted", "POLICY_TARGET_MISSING"],
    ["receipt", "confirmed", "POLICY_RECEIPT_PRESENT"],
    ["dependency", "confirmed", "POLICY_DEPENDENCY_PRESENT"],
    ["temporal", "contradicted", "POLICY_STALE_EVIDENCE"],
    ["capability", "unknown", "POLICY_CAPABILITY_MISSING"],
  ] as const)(
    "owner/evidence matrix блокирует %s=%s",
    (inputType, outcome, ruleId) => {
      const decision = evaluatePolicy(
        withEvidenceOutcome(safeFinding, inputType, outcome),
      );

      expect(decision.allowedActions).not.toContain("prepare_move");
      expect(decision.blockingRuleIds).toContain(ruleId);
    },
  );

  it("блокирует stale fingerprint", () => {
    const decision = evaluatePolicy({
      ...safeFinding,
      currentFingerprint: { ...safeFinding.currentFingerprint, inode: "inode-b" },
    });

    expect(decision.blockingRuleIds).toContain("POLICY_STALE_FINGERPRINT");
  });

  it("classification не разрешает mutation сама по себе", () => {
    const decision = evaluatePolicy({
      ...safeFinding,
      classification: { ...safeFinding.classification, label: "unknown" },
    });

    expect(decision.blockingRuleIds).toContain("POLICY_CLASSIFICATION_NOT_ACTIONABLE");
    expect(decision.allowedActions).not.toContain("prepare_move");
  });
});

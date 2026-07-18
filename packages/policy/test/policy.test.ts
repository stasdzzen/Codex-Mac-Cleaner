import { describe, expect, it } from "vitest";

import { evaluatePolicy } from "../src/index.js";
import { safeFinding } from "./fixtures.js";

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
    const decision = evaluatePolicy({ ...safeFinding, openFileState: "present" });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain("POLICY_OPEN_FILE");
  });

  it("кэш активного приложения блокируется", () => {
    const decision = evaluatePolicy({ ...safeFinding, activityState: "present" });

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
    ["ownerIdentityState", "unknown", "POLICY_OWNER_IDENTITY_MISSING"],
    ["ownerIdentityState", "mismatch", "POLICY_OWNER_MISMATCH"],
    ["installedState", "unknown", "POLICY_INSTALLED_STATE_UNKNOWN"],
    ["activityState", "unknown", "POLICY_ACTIVITY_UNKNOWN"],
    ["openFileState", "unknown", "POLICY_OPEN_FILE_UNKNOWN"],
    ["targetExistenceState", "unknown", "POLICY_TARGET_EXISTENCE_UNKNOWN"],
    ["receiptState", "unknown", "POLICY_RECEIPT_UNKNOWN"],
    ["dependencyState", "unknown", "POLICY_DEPENDENCY_UNKNOWN"],
    ["temporalState", "unknown", "POLICY_TEMPORAL_UNKNOWN"],
    ["dataKindState", "unknown", "POLICY_DATA_KIND_UNKNOWN"],
    ["capabilityState", "missing", "POLICY_CAPABILITY_MISSING"],
  ] as const)("fail closed для %s=%s", (field, state, ruleId) => {
    const decision = evaluatePolicy({ ...safeFinding, [field]: state });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(ruleId);
  });

  it.each([
    ["installedState", "present", "POLICY_INSTALLED_OWNER_PRESENT"],
    ["targetExistenceState", "absent", "POLICY_TARGET_MISSING"],
    ["receiptState", "present", "POLICY_RECEIPT_PRESENT"],
    ["dependencyState", "present", "POLICY_DEPENDENCY_PRESENT"],
    ["temporalState", "stale", "POLICY_STALE_EVIDENCE"],
    ["capabilityState", "unknown", "POLICY_CAPABILITY_MISSING"],
  ] as const)("owner/evidence matrix блокирует %s=%s", (field, state, ruleId) => {
    const decision = evaluatePolicy({ ...safeFinding, [field]: state });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(ruleId);
  });

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

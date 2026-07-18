import { describe, expect, it } from "vitest";

import type { UserExclusion } from "@codex-mac-cleaner/contracts";

import {
  PROTECTED_SCOPE_REGISTRY,
  evaluatePolicy,
  matchUserExclusion,
  selectRecommendedRemovalMethod,
} from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const identityA = "a".repeat(64);
const identityB = "b".repeat(64);

const exclusion: UserExclusion = {
  schemaVersion: 1,
  exclusionId: "exclusion-a",
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory",
  normalizedTargetIdentity: `target:v1:${identityA}`,
  bundleId: "org.example.synthetic",
  packageId: null,
  signingIdentity: `signing:v1:${identityA}`,
  ownerTypeFingerprint: `owner-type:v1:${identityA}`,
  createdAt: "2026-07-18T00:00:00.000Z",
  reasonCategory: "user_choice",
};

const candidateIdentity = {
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory" as const,
  normalizedTargetIdentity: `target:v1:${identityA}`,
  bundleId: "org.example.synthetic",
  packageId: null,
  signingIdentity: `signing:v1:${identityA}`,
  ownerTypeFingerprint: `owner-type:v1:${identityA}`,
};

describe("immutable universal Protected Scope Registry", () => {
  const expected = [
    ["system_scope", "PROTECT_SYSTEM_SCOPE"],
    ["credential_store", "PROTECT_CREDENTIAL_STORE"],
    ["browser_profile", "PROTECT_BROWSER_PROFILE"],
    ["personal_data", "PROTECT_PERSONAL_DATA"],
    ["current_project_root", "PROTECT_CURRENT_PROJECT_ROOT"],
    ["plugin_owned_state", "PROTECT_PLUGIN_OWNED_STATE"],
    ["codex_state", "PROTECT_CODEX_STATE"],
    ["local_git_repository", "PROTECT_LOCAL_GIT_REPOSITORY"],
  ] as const;

  it("содержит только универсальные server-only классы", () => {
    expect(PROTECTED_SCOPE_REGISTRY.map((rule) => rule.kind)).toEqual(
      expected.map(([kind]) => kind),
    );
    expect(Object.isFrozen(PROTECTED_SCOPE_REGISTRY)).toBe(true);
    expect(PROTECTED_SCOPE_REGISTRY.every(Object.isFrozen)).toBe(true);

    const serialized = JSON.stringify(PROTECTED_SCOPE_REGISTRY);
    for (const forbidden of ["appName", "ownerPath", "bypass", "override", "/Users/"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each(expected)("блокирует universal class %s", (kind, ruleId) => {
    const decision = evaluatePolicy({ ...safeFinding, protectedScopeKinds: [kind] });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(ruleId);
  });
});

describe("UserExclusion pre-token guard", () => {
  it("точное identity совпадение блокирует preview", () => {
    const match = matchUserExclusion(exclusion, candidateIdentity);
    const decision = evaluatePolicy({ ...safeFinding, exclusionMatch: match });

    expect(match).toEqual({ status: "matched", exclusionId: "exclusion-a" });
    expect(decision.blockingRuleIds).toContain("POLICY_USER_EXCLUSION_MATCHED");
    expect(decision.allowedActions).not.toContain("prepare_move");
  });

  it("отклоняет path-only match", () => {
    const match = matchUserExclusion(
      { path: "/synthetic/Library/Caches/artifact-a" },
      candidateIdentity,
    );
    const decision = evaluatePolicy({ ...safeFinding, exclusionMatch: match });

    expect(match).toEqual({ status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" });
    expect(decision.blockingRuleIds).toContain("POLICY_EXCLUSION_STATE_INVALID");
  });

  it("identity mismatch снова показывает finding и не применяет exclusion", () => {
    const match = matchUserExclusion(exclusion, {
      ...candidateIdentity,
      ownerTypeFingerprint: `owner-type:v1:${identityB}`,
    });
    const decision = evaluatePolicy({ ...safeFinding, exclusionMatch: match });

    expect(match).toEqual({
      status: "identity_mismatch",
      errorCode: "EXCLUSION_IDENTITY_MISMATCH",
    });
    expect(decision.allowedActions).toContain("prepare_move");
    expect(decision.warnings).toContain("EXCLUSION_IDENTITY_MISMATCH");
  });
});

describe("official uninstaller precedence", () => {
  it("блокирует manual quarantine и становится recommended method", () => {
    const decision = evaluatePolicy({
      ...safeFinding,
      officialUninstallerApplicable: true,
    });

    expect(decision.blockingRuleIds).toContain("POLICY_OFFICIAL_UNINSTALLER_REQUIRED");
    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(selectRecommendedRemovalMethod(true, "quarantine")).toBe(
      "official_uninstaller",
    );
  });

  it.each([
    [false, "quarantine", "quarantine"],
    [false, "inspect_only", "inspect_only"],
    [true, "quarantine", "official_uninstaller"],
    [true, "advanced_mode", "official_uninstaller"],
  ] as const)(
    "removal-method matrix official=%s исходный=%s",
    (official, current, expected) => {
      expect(selectRecommendedRemovalMethod(official, current)).toBe(expected);
    },
  );

  it.each(["advanced_mode", "inspect_only"] as const)(
    "%s из EvidenceSet блокирует prepare_move",
    (recommendedRemovalMethod) => {
      const decision = evaluatePolicy({
        ...safeFinding,
        evidenceSet: {
          ...safeFinding.evidenceSet,
          recommendedRemovalMethod,
        },
      });

      expect(decision.allowedActions).not.toContain("prepare_move");
      expect(decision.blockingRuleIds).toContain(
        "POLICY_NON_QUARANTINE_REMOVAL_METHOD",
      );
    },
  );

  it("quarantine остаётся единственным actionable recommended method", () => {
    const decision = evaluatePolicy({
      ...safeFinding,
      evidenceSet: {
        ...safeFinding.evidenceSet,
        recommendedRemovalMethod: "quarantine",
      },
    });

    expect(decision.blockingRuleIds).not.toContain(
      "POLICY_NON_QUARANTINE_REMOVAL_METHOD",
    );
    expect(decision.allowedActions).toContain("prepare_move");
  });
});

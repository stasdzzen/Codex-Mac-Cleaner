import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PROTECTED_SCOPE_RULES,
  ProtectedScopeRuleSchema,
  ScheduleIntentSchema,
  ScheduleStateSchema,
  UserExclusionSchema,
} from "../src/index.js";

const identity = "a".repeat(64);

describe("универсальные protected scopes", () => {
  const canonicalKinds = [
    "system_scope",
    "credential_store",
    "browser_profile",
    "personal_data",
    "current_project_root",
    "plugin_owned_state",
    "codex_state",
    "local_git_repository",
  ];

  it("содержит только полный канонический набор immutable rules", () => {
    expect(BUILT_IN_PROTECTED_SCOPE_RULES.map((rule) => rule.kind)).toEqual(
      canonicalKinds,
    );
    expect(BUILT_IN_PROTECTED_SCOPE_RULES.every(Object.isFrozen)).toBe(true);
    expect(
      BUILT_IN_PROTECTED_SCOPE_RULES.every((rule) => Object.isFrozen(rule.effects)),
    ).toBe(true);
  });

  it("отклоняет устаревшие и персональные поля", () => {
    expect(() =>
      ProtectedScopeRuleSchema.parse({
        ruleId: "PROTECT_PREFIX",
        kind: "canonical_prefix",
        effects: ["exclude_from_candidates", "block_mutation"],
        safeReason: "Защищённая область",
      }),
    ).toThrow();
    expect(() =>
      ProtectedScopeRuleSchema.parse({
        ruleId: "PROTECT_PERSONAL_APP",
        kind: "personal_data",
        effects: ["exclude_from_candidates", "block_mutation"],
        safeReason: "Защищённая область",
        appName: "Private App",
        path: "/synthetic/private-app",
      }),
    ).toThrow();
  });
});

describe("UserExclusion и schedule", () => {
  const exclusion = {
    schemaVersion: 1,
    exclusionId: "exclusion-1",
    ruleId: "RULE_SYNTHETIC_CACHE",
    artifactKind: "directory",
    normalizedTargetIdentity: `target:v1:${identity}`,
    bundleId: "org.example.synthetic",
    packageId: null,
    signingIdentity: `signing:v1:${identity}`,
    ownerTypeFingerprint: `owner-type:v1:${identity}`,
    createdAt: "2026-07-17T00:00:00.000Z",
    reasonCategory: "user_choice",
  };

  it("запрещает path-only exclusion identity и mutation grants", () => {
    expect(UserExclusionSchema.parse(exclusion).exclusionId).toBe("exclusion-1");
    expect(() =>
      UserExclusionSchema.parse({
        ...exclusion,
        normalizedTargetIdentity: "/synthetic/Library/Caches/example",
      }),
    ).toThrow();
    expect(() => UserExclusionSchema.parse({ ...exclusion, path: "/synthetic/a" })).toThrow();
    expect(() =>
      UserExclusionSchema.parse({ ...exclusion, allowedActions: ["prepare_move"] }),
    ).toThrow();
  });

  it("не принимает raw RRULE, cron и shell поля", () => {
    const intent = {
      intentId: "intent-1",
      action: "enable",
      dayOfMonth: 7,
      localTime: "10:30",
      requestId: "request-1",
      createdAt: "2026-07-17T00:00:00.000Z",
      state: "requested",
    };

    expect(ScheduleIntentSchema.parse(intent).action).toBe("enable");
    for (const forbidden of ["rrule", "cron", "shell"] as const) {
      expect(() =>
        ScheduleIntentSchema.parse({ ...intent, [forbidden]: "synthetic-input" }),
      ).toThrow();
    }
  });

  it("не принимает неизвестную версию schedule state", () => {
    const state = {
      schemaVersion: 1,
      enabled: false,
      automationId: null,
      dayOfMonth: null,
      localTime: null,
      nextRunAt: null,
      lastRunAt: null,
      updatedAt: "2026-07-17T00:00:00.000Z",
      capabilityState: "unknown",
    };

    expect(ScheduleStateSchema.parse(state).enabled).toBe(false);
    expect(() => ScheduleStateSchema.parse({ ...state, schemaVersion: 99 })).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import {
  deriveRuntimeDataKind,
  evaluateRuntimeProtectedScopes,
  type ProtectedScopeEvaluation,
  type RuntimeRegenerabilityProof,
} from "../../apps/mcp-server/src/runtime.js";

const roots = {
  homeDirectory: "/private/cmc-synthetic-home",
  stateRoot:
    "/private/cmc-synthetic-home/Library/Application Support/Codex Mac Cleaner/plugin",
  currentProjectRoot: "/private/cmc-synthetic-home/Projects/current",
} as const;

const neutral = {
  ...roots,
  path: `${roots.homeDirectory}/Library/Caches/neutral-artifact`,
  name: "neutral-artifact",
  gitMarker: false,
  sensitivityFlags: [],
  metadataProtectionKinds: [],
  structuralChecksComplete: true,
  gitTraversalComplete: true,
  contentSemanticChecksComplete: true,
} as const;

function evaluate(
  overrides: Partial<Parameters<typeof evaluateRuntimeProtectedScopes>[0]>,
): ProtectedScopeEvaluation {
  return evaluateRuntimeProtectedScopes({ ...neutral, ...overrides });
}

describe("CMC-10: server-owned protected-scope evaluation", () => {
  it.each([
    ["system_scope", { path: "/System/Library/Caches/neutral-artifact" }],
    ["credential_store", { metadataProtectionKinds: ["credential_store"] }],
    ["browser_profile", { metadataProtectionKinds: ["browser_profile"] }],
    ["personal_data", { metadataProtectionKinds: ["personal_data"] }],
    ["current_project_root", { path: roots.currentProjectRoot }],
    ["plugin_owned_state", { path: roots.stateRoot }],
    ["codex_state", { path: `${roots.homeDirectory}/.codex/neutral-artifact` }],
    ["local_git_repository", { gitMarker: true }],
  ] as const)("классифицирует neutral-name universal scope %s", (expected, input) => {
    expect(evaluate(input).kinds).toContain(expected);
  });

  it.each([
    roots.currentProjectRoot,
    `${roots.currentProjectRoot}/descendant`,
    `${roots.homeDirectory}/Projects`,
  ])("защищает current-project equal/descendant/ancestor: %s", (path) => {
    expect(evaluate({ path }).kinds).toContain("current_project_root");
  });

  it.each([
    { structuralChecksComplete: false },
    { gitTraversalComplete: false },
    { contentSemanticChecksComplete: false },
    { currentProjectRoot: "" },
  ])("fail-closed отмечает incomplete evaluation %#", (input) => {
    expect(evaluate(input).complete).toBe(false);
  });

  it("считает complete только safe empty non-protected control", () => {
    expect(evaluate({})).toEqual({ complete: true, kinds: [] });
  });
});

describe("CMC-10: candidate-specific regenerability proof", () => {
  const targetFingerprint = `sha256:v1:${"c".repeat(64)}`;
  const correlationRevisionId = "correlation-revision-synthetic-proof";
  const correlation = {
    ownerBindingState: "resolved" as const,
    requirementProfileId: "private_regenerable_remnant_v1" as const,
    requirementProfileVersion: 1,
    requirementProfileFingerprint: `sha256:v1:${"a".repeat(64)}`,
    staleDuringAudit: false,
    correlationRevisionId,
  };
  const proof: RuntimeRegenerabilityProof = {
    schemaVersion: 1,
    ruleId: "BOUNDED_CACHE_LOG_REGENERABILITY_V2",
    ruleVersion: 2,
    targetFingerprint,
    correlationRevisionId,
  };

  it("не выводит known data kind из category/profile/пустых flags без proof", () => {
    expect(
      deriveRuntimeDataKind({
        category: "cache",
        sensitivityFlags: [],
        correlation,
        proof: null,
        targetFingerprint,
      }),
    ).toBe("unknown");
  });

  it("принимает только current versioned candidate-specific proof", () => {
    expect(
      deriveRuntimeDataKind({
        category: "cache",
        sensitivityFlags: [],
        correlation,
        proof,
        targetFingerprint,
      }),
    ).toBe("known");
    expect(
      deriveRuntimeDataKind({
        category: "cache",
        sensitivityFlags: [],
        correlation,
        proof: { ...proof, targetFingerprint: `sha256:v1:${"d".repeat(64)}` },
        targetFingerprint,
      }),
    ).toBe("unknown");
    expect(
      deriveRuntimeDataKind({
        category: "cache",
        sensitivityFlags: [],
        correlation,
        proof: { ...proof, correlationRevisionId: "correlation-revision-stale" },
        targetFingerprint,
      }),
    ).toBe("unknown");
  });
});

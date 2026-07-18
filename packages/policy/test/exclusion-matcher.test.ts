import { describe, expect, it, vi } from "vitest";

import type { UserExclusion } from "@codex-mac-cleaner/contracts";

import {
  assertDestructiveTokenAllowed,
  matchUserExclusions,
  prefilterExcludedFindings,
} from "../src/index.js";

const identityA = "a".repeat(64);
const identityB = "b".repeat(64);

const exclusion: UserExclusion = {
  schemaVersion: 1,
  exclusionId: "exclusion-synthetic-a",
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

const candidate = {
  ruleId: exclusion.ruleId,
  artifactKind: exclusion.artifactKind,
  normalizedTargetIdentity: exclusion.normalizedTargetIdentity,
  bundleId: exclusion.bundleId,
  packageId: exclusion.packageId,
  signingIdentity: exclusion.signingIdentity,
  ownerTypeFingerprint: exclusion.ownerTypeFingerprint,
};

describe("identity matcher и audit prefilter", () => {
  it("совпадает только по полной identity", () => {
    expect(matchUserExclusions([exclusion], candidate)).toEqual({
      status: "matched",
      exclusionId: exclusion.exclusionId,
    });
  });

  it.each([
    [
      "artifact kind",
      { artifactKind: "file" },
      {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      },
    ],
    [
      "bundle ID",
      { bundleId: "org.example.replaced" },
      {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      },
    ],
    [
      "package ID",
      { packageId: "package-replaced" },
      {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      },
    ],
    [
      "signing identity",
      { signingIdentity: `signing:v1:${identityB}` },
      {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      },
    ],
    [
      "owner/type fingerprint",
      { ownerTypeFingerprint: `owner-type:v1:${identityB}` },
      {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      },
    ],
    [
      "normalized target",
      { normalizedTargetIdentity: `target:v1:${identityB}` },
      { status: "none" },
    ],
  ] as const)("снова показывает finding при mismatch: %s", (_field, patch, expected) => {
    expect(
      matchUserExclusions([exclusion], {
        ...candidate,
        ...patch,
      }),
    ).toEqual(expected);
  });

  it("фильтрует после minimal identity и до дорогого adapter", async () => {
    const events: string[] = [];
    const result = await prefilterExcludedFindings({
      candidates: ["excluded", "visible"],
      exclusionState: { status: "ready", exclusions: [exclusion] },
      discoverIdentity: async (item) => {
        events.push(`identity:${item}`);
        return item === "excluded"
          ? candidate
          : { ...candidate, normalizedTargetIdentity: `target:v1:${identityB}` };
      },
      analyze: async (item) => {
        events.push(`analyze:${item}`);
        return `analyzed:${item}`;
      },
    });

    expect(result).toEqual({
      findings: ["analyzed:visible"],
      excludedCount: 1,
      tokenIssuance: "allowed",
    });
    expect(events).toEqual([
      "identity:excluded",
      "identity:visible",
      "analyze:visible",
    ]);
  });

  it("invalid schema не скрывает findings и блокирует tokens", async () => {
    const analyze = vi.fn(async (item: string) => `analyzed:${item}`);
    const discoverIdentity = vi.fn(async () => candidate);
    const result = await prefilterExcludedFindings({
      candidates: ["visible"],
      exclusionState: {
        status: "invalid",
        errorCode: "EXCLUSION_STATE_INVALID",
        tokenIssuance: "blocked",
      },
      discoverIdentity,
      analyze,
    });

    expect(result).toEqual({
      findings: ["analyzed:visible"],
      excludedCount: 0,
      tokenIssuance: "blocked",
    });
    expect(discoverIdentity).not.toHaveBeenCalled();
  });

  it("перед token issuance перечитывает store и возвращает EXCLUDED_FINDING", async () => {
    const load = vi.fn(async () => ({
      status: "ready" as const,
      exclusions: [exclusion],
    }));

    await expect(assertDestructiveTokenAllowed(candidate, load)).rejects.toMatchObject({
      errorCode: "EXCLUDED_FINDING",
      severity: "blocking",
    });
    expect(load).toHaveBeenCalledOnce();
  });
});

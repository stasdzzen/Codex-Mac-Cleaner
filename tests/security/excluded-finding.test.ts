import { describe, expect, it, vi } from "vitest";

import type { UserExclusion } from "../../packages/contracts/src/index.js";
import {
  assertDestructiveTokenAllowed,
  prefilterExcludedFindings,
} from "../../packages/policy/src/index.js";

const identity = "a".repeat(64);
const exclusion: UserExclusion = {
  schemaVersion: 1,
  exclusionId: "exclusion-security-synthetic",
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory",
  normalizedTargetIdentity: `target:v1:${identity}`,
  bundleId: "org.example.synthetic",
  packageId: null,
  signingIdentity: `signing:v1:${identity}`,
  ownerTypeFingerprint: `owner-type:v1:${identity}`,
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

describe("security: excluded finding", () => {
  it("не запускает дорогой adapter для matched exclusion и раскрывает только count", async () => {
    const analyze = vi.fn(async () => ({ findingId: "forbidden" }));
    const result = await prefilterExcludedFindings({
      candidates: ["synthetic-candidate"],
      exclusionState: { status: "ready", exclusions: [exclusion] },
      discoverIdentity: async () => candidate,
      analyze,
    });

    expect(result).toEqual({
      findings: [],
      excludedCount: 1,
      tokenIssuance: "allowed",
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/exclusion-security|target:v1|owner-type|signing/i);
  });

  it("не выдаёт destructive token после повторной проверки", async () => {
    const issueToken = vi.fn(() => "destructive-token-forbidden");

    await expect(
      assertDestructiveTokenAllowed(candidate, async () => ({
        status: "ready",
        exclusions: [exclusion],
      })),
    ).rejects.toMatchObject({ errorCode: "EXCLUDED_FINDING" });
    expect(issueToken).not.toHaveBeenCalled();
  });

  it("unknown schema оставляет finding видимым и блокирует token issuance", async () => {
    const result = await prefilterExcludedFindings({
      candidates: ["synthetic-candidate"],
      exclusionState: {
        status: "invalid",
        errorCode: "EXCLUSION_STATE_INVALID",
        tokenIssuance: "blocked",
      },
      discoverIdentity: async () => candidate,
      analyze: async () => ({ findingId: "finding-visible" }),
    });

    expect(result.findings).toEqual([{ findingId: "finding-visible" }]);
    expect(result.excludedCount).toBe(0);
    expect(result.tokenIssuance).toBe("blocked");
  });
});

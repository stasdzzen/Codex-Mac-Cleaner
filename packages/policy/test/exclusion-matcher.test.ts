import { describe, expect, it, vi } from "vitest";

import type {
  KeyedUserExclusion,
  UserExclusion,
} from "@codex-mac-cleaner/contracts";

import {
  assertDestructiveTokenAllowed,
  assertKeyedDestructiveTokenAllowed,
  matchKeyedUserExclusions,
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

const keyedExclusion: KeyedUserExclusion = {
  schemaVersion: 2,
  exclusionId: "exclusion-keyed-a",
  ruleId: exclusion.ruleId,
  artifactKind: exclusion.artifactKind,
  keyId: "key-synthetic-a",
  derivationVersion: 1,
  subjectDigest: `hmac-sha256:v1:${identityA}`,
  claimDigests: [
    { kind: "bundle", digest: `hmac-sha256:v1:${"c".repeat(64)}` },
    { kind: "owner_type", digest: `hmac-sha256:v1:${"d".repeat(64)}` },
    { kind: "target", digest: `hmac-sha256:v1:${"e".repeat(64)}` },
  ],
  createdAt: exclusion.createdAt,
  reasonCategory: exclusion.reasonCategory,
};

const keyedCandidate = {
  ruleId: keyedExclusion.ruleId,
  artifactKind: keyedExclusion.artifactKind,
  keyId: keyedExclusion.keyId,
  derivationVersion: keyedExclusion.derivationVersion,
  subjectDigest: keyedExclusion.subjectDigest,
  claimDigests: keyedExclusion.claimDigests,
};

describe("identity matcher и audit prefilter", () => {
  it("keyed matcher совпадает только по полному installation-local namespace", () => {
    expect(matchKeyedUserExclusions([keyedExclusion], keyedCandidate)).toEqual({
      status: "matched",
      exclusionId: keyedExclusion.exclusionId,
    });
  });

  it.each([
    ["namespace", { keyId: "key-synthetic-b" }],
    ["derivation", { derivationVersion: 2 }],
    [
      "claim",
      {
        claimDigests: keyedCandidate.claimDigests.map((claim) =>
          claim.kind === "bundle"
            ? { ...claim, digest: `hmac-sha256:v1:${identityB}` as const }
            : claim,
        ),
      },
    ],
  ] as const)("keyed %s mismatch не скрывает finding", (_case, patch) => {
    expect(
      matchKeyedUserExclusions([keyedExclusion], {
        ...keyedCandidate,
        ...patch,
      }),
    ).toEqual({
      status: "identity_mismatch",
      errorCode: "EXCLUSION_IDENTITY_MISMATCH",
    });
  });

  it("single/path-only keyed claim не получает exclusion authority", () => {
    expect(
      matchKeyedUserExclusions(
        [{ ...keyedExclusion, claimDigests: [keyedExclusion.claimDigests[2]] }],
        keyedCandidate,
      ),
    ).toEqual({ status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" });
  });

  it("keyed token gate перечитывает store и fail closed на match", async () => {
    const load = vi.fn(async () => ({
      status: "ready" as const,
      exclusions: [keyedExclusion],
    }));

    await expect(
      assertKeyedDestructiveTokenAllowed(keyedCandidate, load),
    ).rejects.toMatchObject({
      errorCode: "EXCLUDED_FINDING",
      severity: "blocking",
    });
    expect(load).toHaveBeenCalledOnce();
  });

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

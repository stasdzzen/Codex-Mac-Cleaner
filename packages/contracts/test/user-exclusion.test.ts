import { describe, expect, it } from "vitest";

import {
  ExclusionCreateInputSchema,
  ExclusionListInputSchema,
  ExclusionListItemSchema,
  ExclusionRemoveInputSchema,
  ExclusionResetInputSchema,
  ExclusionResetPrepareInputSchema,
  KeyedUserExclusionSchema,
  KeyedUserExclusionIdentitySchema,
  KeyedUserExclusionStateSchema,
  UserExclusionSchema,
  UserExclusionStateSchema,
  UserExclusionStateV1Schema,
} from "../src/index.js";

const identity = "a".repeat(64);

const exclusion = {
  schemaVersion: 1,
  exclusionId: "exclusion-synthetic-a",
  ruleId: "RULE_SYNTHETIC_CACHE",
  artifactKind: "directory",
  normalizedTargetIdentity: `target:v1:${identity}`,
  bundleId: "org.example.synthetic",
  packageId: null,
  signingIdentity: `signing:v1:${identity}`,
  ownerTypeFingerprint: `owner-type:v1:${identity}`,
  createdAt: "2026-07-18T00:00:00.000Z",
  reasonCategory: "user_choice",
} as const;

describe("контракты постоянных исключений", () => {
  it("новая persistence schema хранит только installation-keyed digests", () => {
    const keyed = {
      schemaVersion: 2,
      exclusionId: "exclusion-keyed-a",
      ruleId: "RULE_SYNTHETIC_CACHE",
      artifactKind: "directory",
      keyId: "key-synthetic-a",
      derivationVersion: 1,
      subjectDigest: `hmac-sha256:v1:${"b".repeat(64)}`,
      claimDigests: [
        { kind: "owner_type", digest: `hmac-sha256:v1:${"c".repeat(64)}` },
        { kind: "target", digest: `hmac-sha256:v1:${"d".repeat(64)}` },
      ],
      createdAt: exclusion.createdAt,
      reasonCategory: exclusion.reasonCategory,
    } as const;
    const state = {
      schemaVersion: 3,
      stateVersion: 1,
      updatedAt: exclusion.createdAt,
      keyId: keyed.keyId,
      derivationVersion: keyed.derivationVersion,
      exclusions: [keyed],
    } as const;

    expect(KeyedUserExclusionSchema.parse(keyed)).toEqual(keyed);
    expect(
      KeyedUserExclusionIdentitySchema.parse({
        ruleId: keyed.ruleId,
        artifactKind: keyed.artifactKind,
        keyId: keyed.keyId,
        derivationVersion: keyed.derivationVersion,
        subjectDigest: keyed.subjectDigest,
        claimDigests: keyed.claimDigests,
      }),
    ).toBeDefined();
    expect(KeyedUserExclusionStateSchema.parse(state)).toEqual(state);
    for (const forbidden of [
      "normalizedTargetIdentity",
      "bundleId",
      "packageId",
      "signingIdentity",
      "ownerTypeFingerprint",
      "path",
    ]) {
      expect(() =>
        KeyedUserExclusionSchema.parse({ ...keyed, [forbidden]: "synthetic" }),
      ).toThrow();
    }
    expect(() =>
      KeyedUserExclusionSchema.parse({
        ...keyed,
        claimDigests: [{ kind: "target", digest: `sha256:v1:${"d".repeat(64)}` }],
      }),
    ).toThrow();
  });

  it("строго валидирует запись и обе поддержанные версии state", () => {
    expect(UserExclusionSchema.parse(exclusion)).toEqual(exclusion);
    expect(
      UserExclusionStateV1Schema.parse({ schemaVersion: 1, exclusions: [exclusion] }),
    ).toEqual({ schemaVersion: 1, exclusions: [exclusion] });
    expect(
      UserExclusionStateSchema.parse({
        schemaVersion: 2,
        stateVersion: 3,
        updatedAt: "2026-07-18T01:00:00.000Z",
        exclusions: [exclusion],
      }).stateVersion,
    ).toBe(3);

    expect(() =>
      UserExclusionStateSchema.parse({
        schemaVersion: 2,
        stateVersion: 3,
        updatedAt: "2026-07-18T01:00:00.000Z",
        exclusions: [exclusion],
        unknown: true,
      }),
    ).toThrow();
  });

  it("принимает во входах tools только server-owned IDs и закрытые поля", () => {
    const create = {
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-a",
      reasonCategory: "keep_data",
    } as const;
    expect(ExclusionCreateInputSchema.parse(create)).toEqual(create);
    expect(ExclusionListInputSchema.parse({})).toEqual({});
    expect(
      ExclusionRemoveInputSchema.parse({
        exclusionId: "exclusion-synthetic-a",
        requestId: "request-remove-a",
      }),
    ).toBeDefined();
    expect(
      ExclusionResetPrepareInputSchema.parse({ requestId: "request-reset-prepare-a" }),
    ).toBeDefined();
    expect(
      ExclusionResetInputSchema.parse({
        resetToken: "reset-synthetic-a",
        requestId: "request-reset-a",
      }),
    ).toBeDefined();

    for (const forbidden of [
      "path",
      "glob",
      "command",
      "destination",
      "owner",
      "bundleId",
      "signingIdentity",
    ] as const) {
      expect(() =>
        ExclusionCreateInputSchema.parse({ ...create, [forbidden]: "synthetic" }),
      ).toThrow();
    }
  });

  it("app-visible list item не раскрывает target и identity", () => {
    const item = ExclusionListItemSchema.parse({
      exclusionId: exclusion.exclusionId,
      ruleId: exclusion.ruleId,
      artifactKind: exclusion.artifactKind,
      createdAt: exclusion.createdAt,
      reasonCategory: exclusion.reasonCategory,
    });
    const serialized = JSON.stringify(item);

    expect(serialized).not.toMatch(/target|bundle|package|signing|owner|path/i);
    expect(() => ExclusionListItemSchema.parse(exclusion)).toThrow();
  });
});

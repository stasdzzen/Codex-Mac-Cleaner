import { describe, expect, it } from "vitest";

import type { Observation } from "@codex-mac-cleaner/adapters";

import {
  createServerCorrelationSignal,
  normalizeEvidence,
  normalizeObservations,
} from "../src/index.js";

const observedAt = "2026-07-18T00:00:00.000Z";

function observation(
  overrides: Partial<Observation> & Pick<Observation, "observationId" | "evidenceKind">,
): Observation {
  return {
    targetRef: "synthetic-target-a",
    source: "user_library_artifacts",
    displayName: "Synthetic Artifact",
    supportLevel: "candidate",
    allowedActions: [],
    staleDuringAudit: false,
    observedAt,
    fingerprint: "synthetic-fingerprint-a",
    logicalSize: 84,
    physicalSize: 42,
    sensitivityFlags: [],
    safeExplanation: "Синтетическое наблюдение",
    ...overrides,
    observationId: overrides.observationId,
    evidenceKind: overrides.evidenceKind,
  };
}

describe("normalizeObservations", () => {
  it("нормализует и дедуплицирует Observation[] детерминированно", () => {
    const input = [
      observation({
        observationId: "observation-library",
        evidenceKind: "library_artifact",
      }),
      observation({
        observationId: "observation-process",
        source: "process_activity",
        evidenceKind: "process_activity",
      }),
      observation({
        observationId: "observation-library-duplicate",
        evidenceKind: "library_artifact",
      }),
    ];

    const direct = normalizeObservations(input);
    const reversed = normalizeObservations([...input].reverse());

    expect(direct).toEqual(reversed);
    expect(direct).toHaveLength(1);
    expect(direct[0]).toMatchObject({
      schemaVersion: 1,
      supportLevel: "candidate",
      sensitivityFlags: [],
      recommendedRemovalMethod: "quarantine",
      stale: false,
    });
    expect(direct[0]?.targetIdentity).toMatch(/^target:v1:[a-f0-9]{64}$/u);
    expect(direct[0]?.snapshotFingerprint).toMatch(/^snapshot:v1:[a-f0-9]{64}$/u);
    expect(direct[0]?.items.map((item) => item.ruleInputType)).toEqual([
      "activity",
      "data_kind",
      "target_existence",
    ]);
  });

  it("формирует новый fingerprint при изменении observation fingerprint", () => {
    const first = normalizeObservations([
      observation({ observationId: "observation-a", evidenceKind: "library_artifact" }),
    ])[0];
    const second = normalizeObservations([
      observation({
        observationId: "observation-a",
        evidenceKind: "library_artifact",
        fingerprint: "synthetic-fingerprint-b",
      }),
    ])[0];

    expect(first?.snapshotFingerprint).not.toBe(second?.snapshotFingerprint);
  });

  it("не переносит raw config, stderr, full path, secret value или personal identity", () => {
    const unsafeInput = observation({
      observationId: "observation-private",
      evidenceKind: "filesystem_metadata",
      targetRef: "/synthetic/private-home/Library/Caches/private-artifact",
      displayName: "private-identity",
      fingerprint: "token=synthetic-secret-value",
      safeExplanation: "stderr: password=synthetic-password-value",
      safeMetadata: {
        format: "plist",
        parseStatus: "parsed",
        byteLength: 128,
        modifiedAt: observedAt,
        declaredOwnerDisplayName: "private-owner-identity",
        sensitivityFlags: ["tokens"],
      },
    });

    const serialized = JSON.stringify(normalizeObservations([unsafeInput]));

    for (const forbidden of [
      "/synthetic/private-home",
      "private-artifact",
      "private-identity",
      "private-owner-identity",
      "synthetic-secret-value",
      "synthetic-password-value",
      "stderr",
      "rawConfig",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("server-owned correlation contract", () => {
  const validSignal = {
    schemaVersion: 1,
    targetRef: "synthetic-target-a",
    ruleInputType: "installed_state",
    state: "absent",
    observedAt,
    fingerprint: `correlation:v1:${"d".repeat(64)}`,
  } as const;

  it.each(["path", "config", "stderr", "displayName", "secret", "uiPolicy", "score"])(
    "отклоняет запрещённое поле %s",
    (field) => {
      expect(() =>
        createServerCorrelationSignal({
          ...validSignal,
          [field]: "synthetic-private-value",
        } as never),
      ).toThrow();
    },
  );

  it("не сохраняет raw target или correlation fingerprint в EvidenceSet", () => {
    const signal = createServerCorrelationSignal(validSignal);
    const input = observation({
      observationId: "observation-correlated",
      evidenceKind: "library_artifact",
    });
    const serialized = JSON.stringify(normalizeEvidence([input], [signal]));

    expect(serialized).not.toContain(validSignal.targetRef);
    expect(serialized).not.toContain(validSignal.fingerprint);
    expect(serialized).not.toContain("synthetic-private-value");
  });
});

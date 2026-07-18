import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSyntheticCorrelationInput,
  consumeEphemeralCorrelationInput,
  EphemeralCorrelationInput,
  type RawCorrelationPayload,
  type SyntheticCorrelationOptions,
} from "@codex-mac-cleaner/adapters";
import { describe, expect, it } from "vitest";

import { buildCorrelationEvidenceSet, resolveCorrelation } from "../src/index.js";

const now = "2026-07-18T00:00:00.000Z";
const deriver = {
  keyId: "installation-key-a",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    return `hmac-sha256:v1:${createHash("sha256")
      .update(["installation-a", domain, kind, value].join("\u0000"))
      .digest("hex")}` as const;
  },
};

async function run(options: Partial<SyntheticCorrelationOptions> = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), "cmc-library-correlation-"));
  return resolveCorrelation({
    auditId: "audit-library-a",
    auditRevision: 2,
    findingId: "finding-library-a",
    exclusionStateVersion: 1,
    ruleSetVersion: 2,
    policyVersion: 2,
    now,
    deriver,
    rawInput: buildSyntheticCorrelationInput({
      seed: "library-resolver-seed",
      tempRoot,
      deriver,
      artifactCategory: "cache",
      artifactPrivateNonExecutable: true,
      ...options,
    }),
  });
}

async function mutate(
  change: (payload: RawCorrelationPayload) => RawCorrelationPayload,
): Promise<EphemeralCorrelationInput> {
  const tempRoot = await mkdtemp(join(tmpdir(), "cmc-library-invalid-"));
  return consumeEphemeralCorrelationInput(
    buildSyntheticCorrelationInput({
      seed: "invalid-library-seed",
      tempRoot,
      deriver,
    }),
    (payload) => new EphemeralCorrelationInput(change(payload)),
  );
}

function resolveRaw(rawInput: EphemeralCorrelationInput) {
  return resolveCorrelation({
    auditId: "audit-invalid-a",
    auditRevision: 2,
    findingId: "finding-invalid-a",
    exclusionStateVersion: 1,
    ruleSetVersion: 2,
    policyVersion: 2,
    now,
    deriver,
    rawInput,
  });
}

describe("correlation resolver v2", () => {
  it("выдаёт actionable cache только через authoritative binding и полный профиль", async () => {
    const result = await run();

    expect(result.safeView).toMatchObject({
      schemaVersion: 2,
      ownerBindingState: "resolved",
      ownerBindingSourceClass: "signed_history",
      requirementProfileId: "private_regenerable_remnant_v1",
      receiptLifecycle: { lifecycle: "absent" },
      requirementApplicability: { dependency: "not_applicable" },
      blockingReasonCodes: [],
    });
    expect(result.safeView.facts.artifactExistence.state).toBe("present");
    for (const fact of [
      "ownerApplication",
      "ownerExecutable",
      "activity",
      "openFile",
      "startupTarget",
      "officialUninstaller",
    ] as const) {
      expect(result.safeView.facts[fact].state).toBe("absent");
    }
    expect(result.safeView.facts.dependency).toEqual({
      state: "unknown",
      reasonCode: "not_applicable",
    });
    expect(result.safeView.allowedActions).toContain("prepare_move");
    expect(result.edges).toContainEqual(expect.objectContaining({
      relation: "remnant_of",
      strength: "authoritative",
      resolutionState: "resolved",
    }));
  });

  it.each(["application_support", "container", "webkit", "personal_file"] as const)(
    "%s всегда остаётся inspection-only",
    async (artifactCategory) => {
      const result = await run({ artifactCategory });
      expect(result.safeView.requirementProfileId).toBe("inspection_only_v1");
      expect(new Set(Object.values(result.safeView.requirementApplicability))).toEqual(
        new Set(["unsupported"]),
      );
      expect(result.safeView.allowedActions).not.toContain("prepare_move");
      expect(result.safeView.blockingReasonCodes).toContain("unsupported_profile");
    },
  );

  it.each([
    ["missing", "missing"],
    ["mismatch", "mismatch"],
  ] as const)("owner binding %s блокирует mutation", async (bindingSource, state) => {
    const result = await run({ bindingSource });
    expect(result.safeView.ownerBindingState).toBe(state);
    expect(result.safeView.allowedActions).not.toContain("prepare_move");
  });

  it("positive receipt/dependency/uninstaller не подавляются not_applicable", async () => {
    for (const positiveFact of ["receipt", "dependency", "officialUninstaller"] as const) {
      const result = await run({ positiveFacts: [positiveFact] });
      expect(result.safeView.allowedActions).not.toContain("prepare_move");
      expect(result.safeView.blockingReasonCodes).toContain("positive_counter_evidence");
    }
  });

  it.each([
    "capability_missing",
    "permission_denied",
    "partial_inventory",
    "truncated",
    "parse_loss",
    "timeout",
    "cancelled",
  ] as const)("incomplete canonical inventory %s остаётся unknown", async (state) => {
    const result = await run({ queryStates: { installed_apps: state } });
    expect(result.safeView.facts.ownerApplication).toEqual({ state: "unknown", reasonCode: state });
    expect(result.safeView.allowedActions).not.toContain("prepare_move");
  });

  it("exact receipt binding разделяет stale и live lifecycle", async () => {
    const stale = await run({ bindingSource: "exact_receipt_payload" });
    const live = await run({
      bindingSource: "exact_receipt_payload",
      installedVariant: "resolved",
      ownerExecutablePresent: true,
    });
    expect(stale.safeView.receiptLifecycle.lifecycle).toBe("stale");
    expect(live.safeView.receiptLifecycle.lifecycle).toBe("live");
    expect(live.safeView.allowedActions).not.toContain("prepare_move");
  });

  it("Snapshot A/B race инвалидирует certificates и actions", async () => {
    const result = await run({ snapshotMutation: "parent" });
    expect(result.revision.staleDuringAudit).toBe(true);
    expect(result.certificates).toEqual([]);
    expect(result.safeView.facts.artifactExistence).toEqual({
      state: "unknown",
      reasonCode: "snapshot_stale",
    });
    expect(result.safeView.allowedActions).not.toContain("prepare_move");
  });

  it("duplicate scope и duplicate strong claim fail closed до resolution", async () => {
    const duplicateScope = await mutate((payload) => ({
      ...payload,
      queries: [...payload.queries, { ...payload.queries[0]!, queryId: "duplicate-query" }],
    }));
    const duplicateClaim = await mutate((payload) => ({
      ...payload,
      candidate: { ...payload.candidate, claims: [...payload.candidate.claims, payload.candidate.claims[0]!] },
    }));
    expect(() => resolveRaw(duplicateScope)).toThrowError(
      expect.objectContaining({ errorCode: "CORRELATION_AMBIGUOUS" }),
    );
    expect(() => resolveRaw(duplicateClaim)).toThrowError(
      expect.objectContaining({ errorCode: "CORRELATION_AMBIGUOUS" }),
    );
  });

  it("safe view/evidence не раскрывают raw identities и разделяют artifact/owner", async () => {
    const result = await run();
    const evidence = buildCorrelationEvidenceSet(result, {
      supportLevel: "candidate",
      sensitivityFlags: [],
      dataKind: "known",
    });
    const serialized = JSON.stringify({ safeView: result.safeView, evidence });
    expect(evidence.items).toContainEqual(expect.objectContaining({
      ruleInputType: "artifact_existence",
      outcome: "confirmed",
    }));
    expect(evidence.items).toContainEqual(expect.objectContaining({
      ruleInputType: "owner_executable",
      outcome: "contradicted",
    }));
    for (const canary of ["library-resolver-seed", "org.synthetic", "package.synthetic", "cmc-library-correlation-"]) {
      expect(serialized).not.toContain(canary);
    }
  });
});

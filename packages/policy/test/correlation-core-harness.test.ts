import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSyntheticCorrelationInput } from "@codex-mac-cleaner/adapters";
import {
  buildCorrelationEvidenceSet,
  resolveCorrelation,
} from "@codex-mac-cleaner/evidence";
import { describe, expect, it } from "vitest";

import {
  evaluatePolicy,
  runSafeCoreIntegrationHarness,
} from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const now = "2026-07-18T00:00:00.000Z";
const deriver = {
  keyId: "key-synthetic-a",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    return `hmac-sha256:v1:${createHash("sha256")
      .update(`${domain}\u0000${kind}\u0000${value}`)
      .digest("hex")}` as const;
  },
};

async function resolverResult(
  options: Parameters<typeof buildSyntheticCorrelationInput>[0] extends infer T
    ? Partial<T>
    : never = {},
) {
  const tempRoot = await mkdtemp(join(tmpdir(), "cmc-core-harness-"));
  return resolveCorrelation({
    auditId: "audit-synthetic-a",
    auditRevision: 1,
    findingId: "finding-synthetic-a",
    exclusionStateVersion: 1,
    ruleSetVersion: 1,
    policyVersion: 1,
    now,
    deriver,
    rawInput: buildSyntheticCorrelationInput({
      seed: "core-harness-seed",
      tempRoot,
      ...options,
    }),
  });
}

function policyContext() {
  const {
    classification: _classification,
    evidenceSet: _evidenceSet,
    correlationRevision: _correlationRevision,
    ...context
  } = safeFinding;
  return context;
}

describe("safe core correlation → classifier → policy harness", () => {
  it("полный safe core flow становится policy-eligible", async () => {
    const result = await resolverResult();
    const harness = runSafeCoreIntegrationHarness({
      resolverResult: result,
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext: policyContext(),
    });

    expect(harness.classification.label).toBe("orphaned");
    expect(harness.decision.allowedActions).toContain("prepare_move");
    expect(harness.safeInput.correlationRevisionId).toBe(
      result.revision.correlationRevisionId,
    );
    expect(JSON.stringify(harness.safeInput)).not.toMatch(
      /path|bundle|package|signing|inventory|token|secret|personal/i,
    );
  });

  it("legacy EvidenceSet без immutable authority остаётся non-actionable", () => {
    const decision = evaluatePolicy({
      ...safeFinding,
      evidenceSet: { ...safeFinding.evidenceSet, authority: { mode: "legacy_non_actionable" } },
    });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(
      "POLICY_CORRELATION_REVISION_REQUIRED",
    );
  });

  it.each([
    ["installedVariant", { installedVariant: "resolved" }, "POLICY_INSTALLED_OWNER_PRESENT"],
    ["activity", { positiveFacts: ["activity"] }, "POLICY_ACTIVE_PROCESS"],
    ["openFile", { positiveFacts: ["openFile"] }, "POLICY_OPEN_FILE"],
    ["startupTarget", { positiveFacts: ["startupTarget"] }, "POLICY_STARTUP_TARGET_PRESENT"],
    ["receipt", { positiveFacts: ["receipt"] }, "POLICY_RECEIPT_PRESENT"],
    ["officialUninstaller", { positiveFacts: ["officialUninstaller"] }, "POLICY_OFFICIAL_UNINSTALLER_REQUIRED"],
    ["dependency", { positiveFacts: ["dependency"] }, "POLICY_DEPENDENCY_PRESENT"],
  ] as const)("positive %s блокирует mutation", async (_name, options, ruleId) => {
    const harness = runSafeCoreIntegrationHarness({
      resolverResult: await resolverResult(options),
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext: policyContext(),
    });

    expect(harness.decision.allowedActions).not.toContain("prepare_move");
    expect(harness.decision.blockingRuleIds).toContain(ruleId);
  });

  it("incomplete coverage и stale revision fail closed", async () => {
    const incomplete = runSafeCoreIntegrationHarness({
      resolverResult: await resolverResult({
        queryStates: { installed_apps: "permission_denied" },
      }),
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext: policyContext(),
    });
    const stale = runSafeCoreIntegrationHarness({
      resolverResult: await resolverResult({ mutateSnapshotB: true }),
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext: policyContext(),
    });

    expect(incomplete.classification.label).toBe("unknown");
    expect(incomplete.decision.allowedActions).not.toContain("prepare_move");
    expect(stale.decision.allowedActions).not.toContain("prepare_move");
    expect(stale.decision.blockingRuleIds).toContain(
      "POLICY_CORRELATION_SNAPSHOT_STALE",
    );
  });

  it("owner mismatch блокирует mutation независимо от installed-state classification", async () => {
    const harness = runSafeCoreIntegrationHarness({
      resolverResult: await resolverResult({ ownerMismatch: true }),
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext: policyContext(),
    });

    expect(harness.decision.allowedActions).not.toContain("prepare_move");
    expect(harness.decision.blockingRuleIds).toContain("POLICY_OWNER_MISMATCH");
  });

  it("revision binding нельзя подменить отдельно от evidence", async () => {
    const result = await resolverResult();
    const evidenceSet = buildCorrelationEvidenceSet(result, {
      supportLevel: "candidate",
      sensitivityFlags: [],
      dataKind: "known",
    });
    const decision = evaluatePolicy({
      ...safeFinding,
      evidenceSet,
      classification: safeFinding.classification,
      correlationRevision: {
        ...result.revision,
        edgeSetDigest: `sha256:v1:${"0".repeat(64)}`,
      },
    });

    expect(decision.allowedActions).not.toContain("prepare_move");
    expect(decision.blockingRuleIds).toContain(
      "POLICY_CORRELATION_BINDING_MISMATCH",
    );
  });
});

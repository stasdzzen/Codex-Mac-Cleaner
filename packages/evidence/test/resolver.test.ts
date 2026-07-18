import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSyntheticCorrelationInput,
  type SyntheticCorrelationOptions,
} from "@codex-mac-cleaner/adapters";
import { describe, expect, it } from "vitest";

import { resolveCorrelation } from "../src/index.js";

const fixedNow = "2026-07-18T00:00:00.000Z";
const deriver = {
  keyId: "key-synthetic-a",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    const digest = createHash("sha256")
      .update([domain, kind, value].join("\u0000"))
      .digest("hex");
    return `hmac-sha256:v1:${digest}` as const;
  },
};

async function run(
  options: Partial<SyntheticCorrelationOptions> = {},
  digestDeriver = deriver,
) {
  const tempRoot = await mkdtemp(join(tmpdir(), "cmc-correlation-resolver-"));
  return resolveCorrelation({
    auditId: "audit-synthetic-a",
    auditRevision: 1,
    findingId: "finding-synthetic-a",
    exclusionStateVersion: 1,
    ruleSetVersion: 1,
    policyVersion: 1,
    now: fixedNow,
    deriver: digestDeriver,
    rawInput: buildSyntheticCorrelationInput({
      seed: "resolver-seed",
      tempRoot,
      ...options,
    }),
  });
}

describe("deterministic correlation resolver", () => {
  it("выпускает absent только с complete same-snapshot certificates", async () => {
    const result = await run();

    for (const fact of [
      "installedApp",
      "activity",
      "openFile",
      "startupTarget",
      "receipt",
      "officialUninstaller",
      "dependency",
    ] as const) {
      expect(result.safeView.facts[fact]).toMatchObject({
        state: "absent",
        reasonCode: "complete_empty",
      });
      expect(result.safeView.facts[fact]).toHaveProperty("certificateId");
    }
    expect(result.safeView.facts.targetExecutable.state).toBe("present");
    expect(result.certificates).toHaveLength(7);
    expect(result.safeView.staleDuringAudit).toBe(false);
  });

  it.each([
    ["capability_missing", "capability_missing"],
    ["permission_denied", "permission_denied"],
    ["partial_inventory", "partial_inventory"],
    ["truncated", "truncated"],
    ["parse_loss", "parse_loss"],
    ["timeout", "timeout"],
    ["cancelled", "cancelled"],
  ] as const)("empty %s остаётся unknown", async (queryState, reasonCode) => {
    const result = await run({
      queryStates: { installed_apps: queryState },
    });

    expect(result.safeView.facts.installedApp).toEqual({
      state: "unknown",
      reasonCode,
    });
    expect(
      result.certificates.some(({ queryScope }) => queryScope === "installed_apps"),
    ).toBe(false);
  });

  it.each([
    ["installed_apps", "installedApp"],
    ["processes", "activity"],
    ["open_files", "openFile"],
    ["startup_targets", "startupTarget"],
    ["target_executables", "targetExecutable"],
    ["receipts", "receipt"],
    ["official_uninstallers", "officialUninstaller"],
    ["dependencies", "dependency"],
  ] as const)("mandatory source %s fail closed при permission gap", async (scope, fact) => {
    const result = await run({
      queryStates: { [scope]: "permission_denied" },
      targetExecutablePresent: false,
    });

    expect(result.safeView.facts[fact]).toEqual({
      state: "unknown",
      reasonCode: "permission_denied",
    });
  });

  it.each([
    ["path_only", "missing", "missing"],
    ["basename_only", "missing", "missing"],
    ["display_name_only", "missing", "missing"],
    ["bundle_only", "missing", "missing"],
    ["package_only", "missing", "missing"],
    ["signer_only", "missing", "missing"],
    ["owner_only", "missing", "missing"],
    ["duplicate", "ambiguous", "ambiguous"],
    ["shared_signer", "mismatch", "mismatch"],
    ["mismatch", "mismatch", "mismatch"],
    ["resolved", "resolved", "positive_relation"],
  ] as const)(
    "installed variant %s детерминированно даёт %s",
    async (installedVariant, resolutionState, reasonCode) => {
      const result = await run({ installedVariant });

      expect(result.resolutionStates.installedApp).toBe(resolutionState);
      expect(result.safeView.facts.installedApp.reasonCode).toBe(reasonCode);
      expect(result.safeView.facts.installedApp.state).toBe(
        installedVariant === "resolved" ? "present" : "unknown",
      );
    },
  );

  it("positive relation остаётся blocking evidence при partial inventory", async () => {
    const result = await run({
      installedVariant: "resolved",
      queryStates: { installed_apps: "partial_inventory" },
    });

    expect(result.safeView.facts.installedApp).toEqual({
      state: "present",
      reasonCode: "positive_relation",
    });
    expect(result.safeView.blockingReasonCodes).toContain(
      "positive_counter_evidence",
    );
    expect(result.safeView.coverageSummary.gapCodes).toContain(
      "partial_inventory",
    );
  });

  it("owner mismatch остаётся отдельным blocking fact и не смешивается с installed state", async () => {
    const result = await run({ ownerMismatch: true });

    expect(result.ownerResolutionState).toBe("mismatch");
    expect(result.safeView.facts.installedApp.state).toBe("absent");
  });

  it("строит все candidate-specific positive facts", async () => {
    const result = await run({
      installedVariant: "resolved",
      positiveFacts: [
        "activity",
        "openFile",
        "startupTarget",
        "receipt",
        "officialUninstaller",
        "dependency",
      ],
    });

    expect(
      Object.values(result.safeView.facts).map(({ state }) => state),
    ).toEqual(Array(8).fill("present"));
    expect(result.safeView.blockingReasonCodes).toEqual(
      expect.arrayContaining([
        "positive_counter_evidence",
        "official_uninstaller_required",
      ]),
    );
  });

  it("Snapshot A/B race меняет revision и инвалидирует negative evidence/actions", async () => {
    const stable = await run();
    const stale = await run({ mutateSnapshotB: true });

    expect(stale.revision.staleDuringAudit).toBe(true);
    expect(stale.safeView.staleDuringAudit).toBe(true);
    expect(stale.revision.correlationRevisionId).not.toBe(
      stable.revision.correlationRevisionId,
    );
    expect(stale.safeView.facts.installedApp).toEqual({
      state: "unknown",
      reasonCode: "snapshot_stale",
    });
    expect(stale.safeView.allowedActions).not.toContain("prepare_move");
    expect(Object.isFrozen(stale.revision)).toBe(true);
  });

  it("query другого snapshot не может выпустить ни positive, ни negative fact", async () => {
    const result = await run({
      installedVariant: "resolved",
      querySnapshotMismatch: "installed_apps",
    });

    expect(result.safeView.facts.installedApp).toEqual({
      state: "unknown",
      reasonCode: "snapshot_stale",
    });
    expect(result.certificates).not.toContainEqual(
      expect.objectContaining({ queryScope: "installed_apps" }),
    );
    expect(result.safeView.allowedActions).toEqual(["inspect"]);
  });

  it.each([
    "candidate",
    "parent",
    "owner_type",
    "executable",
    "process",
    "open_file",
    "receipt",
    "dependency",
  ] as const)("Snapshot A/B %s race инвалидирует revision", async (snapshotMutation) => {
    const result = await run({ snapshotMutation });

    expect(result.revision.staleDuringAudit).toBe(true);
    expect(result.certificates).toEqual([]);
    expect(Object.values(result.safeView.facts)).not.toContainEqual(
      expect.objectContaining({ state: "absent" }),
    );
  });

  it("детерминирован и не раскрывает raw canaries", async () => {
    const first = await run();
    const second = await run();
    const serialized = JSON.stringify(first);

    expect(first).toEqual(second);
    for (const forbidden of [
      "resolver-seed",
      "org.synthetic",
      "package.synthetic",
      "designated",
      "cmc-correlation-resolver-",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("provenance fingerprints зависят от installation key, а не от public raw hash", async () => {
    const otherDeriver = {
      keyId: "key-synthetic-b",
      derivationVersion: 1,
      derive(domain: string, kind: string, value: string) {
        const digest = createHash("sha256")
          .update(["installation-b", domain, kind, value].join("\u0000"))
          .digest("hex");
        return `hmac-sha256:v1:${digest}` as const;
      },
    };
    const first = await run();
    const second = await run({}, otherDeriver);

    expect(first.provenance.map(({ queryFingerprint }) => queryFingerprint)).not.toEqual(
      second.provenance.map(({ queryFingerprint }) => queryFingerprint),
    );
  });
});

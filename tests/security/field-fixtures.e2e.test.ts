import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSyntheticCorrelationInput } from "../../packages/adapters/src/index.js";
import { resolveCorrelation } from "../../packages/evidence/src/index.js";

const temporaryRoots: string[] = [];
const now = "2026-07-20T00:00:00.000Z";
const deriver = {
  keyId: "installation-key-cmc-10",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    return `hmac-sha256:v1:${createHash("sha256")
      .update(["cmc-10", domain, kind, value].join("\u0000"))
      .digest("hex")}` as const;
  },
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function resolveFixture(
  artifactCategory:
    | "cache"
    | "log"
    | "application_support"
    | "container"
    | "group_container"
    | "preference"
    | "webkit"
    | "http_storage"
    | "saved_state"
    | "database"
    | "sync_data"
    | "vpn_data"
    | "personal_file"
    | "autostart",
  positiveFacts: readonly ("receipt" | "dependency" | "officialUninstaller")[] = [],
) {
  const root = await mkdtemp(join(tmpdir(), "cmc-field-fixture-"));
  temporaryRoots.push(root);
  return resolveCorrelation({
    auditId: `audit-${artifactCategory.replaceAll("_", "-")}`,
    auditRevision: 1,
    findingId: `finding-${artifactCategory.replaceAll("_", "-")}`,
    exclusionStateVersion: 1,
    ruleSetVersion: 2,
    policyVersion: 2,
    now,
    deriver,
    rawInput: buildSyntheticCorrelationInput({
      seed: `field-${artifactCategory}`,
      tempRoot: root,
      deriver,
      artifactCategory,
      artifactPrivateNonExecutable: true,
      positiveFacts,
    }),
  });
}

describe("CMC-10: generated field fixtures", () => {
  it.each(["cache", "log"] as const)(
    "%s получает actionable profile только через authoritative server-owned binding",
    async (category) => {
      const result = await resolveFixture(category);
      expect(result.safeView).toMatchObject({
        ownerBindingState: "resolved",
        requirementProfileId: "private_regenerable_remnant_v1",
        staleDuringAudit: false,
        blockingReasonCodes: [],
      });
      expect(result.safeView.allowedActions).toContain("prepare_move");
      expect(result.edges).toContainEqual(
        expect.objectContaining({
          relation: "remnant_of",
          strength: "authoritative",
          resolutionState: "resolved",
        }),
      );
    },
  );

  it.each([
    "application_support",
    "container",
    "group_container",
    "preference",
    "webkit",
    "http_storage",
    "saved_state",
    "database",
    "sync_data",
    "vpn_data",
    "personal_file",
    "autostart",
  ] as const)("%s остаётся inspection-only", async (category) => {
    const result = await resolveFixture(category);
    expect(result.safeView.requirementProfileId).toBe("inspection_only_v1");
    expect(result.safeView.allowedActions).not.toContain("prepare_move");
    expect(result.safeView.blockingReasonCodes).toContain("unsupported_profile");
  });

  it.each(["receipt", "dependency", "officialUninstaller"] as const)(
    "positive %s не подавляется not_applicable",
    async (positiveFact) => {
      const result = await resolveFixture("cache", [positiveFact]);
      expect(result.safeView.allowedActions).not.toContain("prepare_move");
      expect(result.safeView.blockingReasonCodes).toContain(
        positiveFact === "officialUninstaller"
          ? "official_uninstaller_required"
          : "positive_counter_evidence",
      );
    },
  );
});

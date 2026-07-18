import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Observation } from "@codex-mac-cleaner/adapters";
import type { ServerCorrelationSignal } from "@codex-mac-cleaner/evidence";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDefaultRuntimeServices,
  createMcpServer,
} from "../src/server.js";

const platform = { platform: "darwin", arch: "arm64", release: "26.0.0" } as const;
const roots: string[] = [];

function correlation(
  observation: Observation,
  ruleInputType: ServerCorrelationSignal["ruleInputType"],
  state: string,
): ServerCorrelationSignal {
  const digest = createHash("sha256")
    .update(`${observation.targetRef}:${ruleInputType}:${state}`)
    .digest("hex");
  return {
    schemaVersion: 1,
    targetRef: observation.targetRef,
    ruleInputType,
    state,
    observedAt: observation.observedAt,
    fingerprint: `correlation:v1:${digest}`,
  } as ServerCorrelationSignal;
}

function actionableCorrelations(observation: Observation): readonly ServerCorrelationSignal[] {
  return [
    correlation(observation, "owner_identity", "confirmed"),
    correlation(observation, "installed_state", "absent"),
    correlation(observation, "activity", "absent"),
    correlation(observation, "open_file_state", "absent"),
    correlation(observation, "target_existence", "present"),
    correlation(observation, "receipt", "absent"),
    correlation(observation, "dependency", "absent"),
    correlation(observation, "temporal", "current"),
    correlation(observation, "data_kind", "known"),
    correlation(observation, "capability", "available"),
  ];
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("production runtime services", () => {
  it("проводит single-object prepare/move/restore через core quarantine на synthetic root", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-core-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const allowedRoot = join(homeDirectory, "Library", "Caches");
    await mkdir(join(allowedRoot, "Synthetic Remnant"), { recursive: true });

    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      correlationsForObservation: actionableCorrelations,
    });
    const server = createMcpServer(platform, services);
    const client = new Client({ name: "runtime-core-flow", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const started = await client.callTool({
        name: "audit_start",
        arguments: { requestId: "synthetic-audit-1", profile: "application_remnants" },
      });
      const auditId = (started.structuredContent as { auditId: string }).auditId;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const status = await client.callTool({ name: "audit_status", arguments: { auditId } });
        const state = (status.structuredContent as { state: string }).state;
        if (state === "completed" || state === "completed_with_warnings") break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const results = await client.callTool({
        name: "audit_results",
        arguments: { auditId, revision: 1, cursor: null, filters: {} },
      });
      const finding = (results.structuredContent as {
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      }).findings[0];
      expect(finding?.allowedActions).toContain("prepare_move");

      const preview = await client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding?.findingId, auditRevision: 1 },
      });
      expect(preview.isError).not.toBe(true);
      const previewToken = (preview.structuredContent as { previewToken: string }).previewToken;
      const moved = await client.callTool({
        name: "quarantine_move",
        arguments: { previewToken, operationId: "synthetic-operation-1" },
      });
      expect(moved.isError).not.toBe(true);
      expect(moved.structuredContent).toMatchObject({
        quarantineEntry: { quarantineEntryId: "synthetic-operation-1", state: "moved" },
      });

      const restorePreview = await client.callTool({
        name: "quarantine_prepare_restore",
        arguments: { operationId: "synthetic-operation-1" },
      });
      expect(restorePreview.isError).not.toBe(true);
      const restoreToken = (restorePreview.structuredContent as { previewToken: string }).previewToken;
      const restored = await client.callTool({
        name: "quarantine_restore",
        arguments: { operationId: "synthetic-operation-1", previewToken: restoreToken },
      });
      expect(restored.isError).not.toBe(true);
      expect(restored.structuredContent).toMatchObject({
        quarantineEntry: { quarantineEntryId: "synthetic-operation-1", state: "restored" },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

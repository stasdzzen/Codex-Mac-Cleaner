import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ModelSafeTextSchema,
  containsSecretLikeValue,
} from "../../packages/contracts/src/index.js";
import {
  createCommandRunner,
  createNodeMacOSCorrelationReadOnlyFileSystem,
} from "../../packages/adapters/src/index.js";
import {
  buildToolResult,
  createDefaultRuntimeServices,
  type AuditToolService,
} from "../../apps/mcp-server/src/server.js";

async function completedAudit(service: AuditToolService) {
  const started = await service.start({
    requestId: "request-privacy-production",
    profile: "application_remnants",
  });
  const auditId = started.auditId;
  for (let attempt = 0; attempt < 2_000; attempt += 1) {
    const status = await service.status({ auditId });
    const state = status.state;
    if (state === "completed" || state === "completed_with_warnings") {
      const results = await service.results({
        auditId,
        revision: 1,
        cursor: null,
        filters: {},
      });
      const dashboard = await service.dashboard({ auditId, revision: 1 });
      return {
        results: buildToolResult("audit_results", results, "Результаты готовы."),
        dashboard: buildToolResult(
          "dashboard_open",
          dashboard.output,
          "Dashboard готов.",
          dashboard.meta,
        ),
      };
    }
    if (state === "failed" || state === "cancelled") {
      throw new Error(`PRIVACY_AUDIT_${state.toUpperCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("PRIVACY_AUDIT_TIMEOUT");
}

describe("CMC-10: model-safe privacy boundary", () => {
  it.each([
    "PRIVATE_KEY=synthetic-private-key-value",
    "Authorization: Basic synthetic-authorization-value",
    "Proxy-Authorization: Custom synthetic-authorization-value",
    "client_secret: synthetic-client-secret-value",
  ])("не пропускает credential-shaped текст %s", (value) => {
    expect(containsSecretLikeValue(value)).toBe(true);
    expect(ModelSafeTextSchema.safeParse(value).success).toBe(false);
  });

  it("сохраняет безопасный нейтральный label", () => {
    const value = "Generated Cache Item";
    expect(containsSecretLikeValue(value)).toBe(false);
    expect(ModelSafeTextSchema.parse(value)).toBe(value);
  });

  it("оставляет basename model-private и допускает в widget только безопасное имя", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "cmc-privacy-production-"));
    const homeDirectory = join(temporaryRoot, "home");
    const cacheRoot = join(homeDirectory, "Library", "Caches");
    const stateRoot = join(temporaryRoot, "state");
    const projectRoot = join(temporaryRoot, "project");
    const rawNames = [
      "PRIVATE_KEY=synthetic-value",
      "Authorization: Basic synthetic-value",
      "Proxy-Authorization: Custom synthetic-value",
      "Readable Control Cache",
    ];
    await Promise.all([
      mkdir(cacheRoot, { recursive: true }),
      mkdir(projectRoot, { recursive: true }),
    ]);
    await Promise.all(rawNames.map((name) => writeFile(join(cacheRoot, name), "")));

    const nodeFilesystem = createNodeMacOSCorrelationReadOnlyFileSystem();
    const correlationFilesystem = {
      canonicalize: nodeFilesystem.canonicalize,
      stat: nodeFilesystem.stat,
      async readDirectory(path: string, signal: AbortSignal) {
        signal.throwIfAborted();
        if (
          path === "/Applications" ||
          path === "/System/Applications" ||
          path === join(homeDirectory, "Applications") ||
          path === "/Library/LaunchAgents" ||
          path === "/Library/LaunchDaemons" ||
          path === join(homeDirectory, "Library", "LaunchAgents")
        ) {
          return [];
        }
        return nodeFilesystem.readDirectory(path, signal);
      },
    };

    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot,
      currentProjectRoot: projectRoot,
      correlation: {
        commands: createCommandRunner(async () => ({
          stdout: "",
          stderr: "",
          exitCode: 0,
        })),
        filesystem: correlationFilesystem,
      },
    });
    try {
      const { results, dashboard } = await completedAudit(services.auditService);
      const modelPayload = JSON.stringify({
        results: results.structuredContent,
        modelContent: results.content,
      });
      const widgetPayload = JSON.stringify(dashboard._meta);
      for (const rawName of rawNames) expect(modelPayload).not.toContain(rawName);
      for (const secretLikeName of rawNames.slice(0, 3)) {
        expect(widgetPayload).not.toContain(secretLikeName);
      }
      expect(widgetPayload).toContain("Readable Control Cache");
      const displayNames = (
        results.structuredContent as { findings: Array<{ displayName: string }> }
      ).findings.map(({ displayName }) => displayName);
      expect(displayNames).toHaveLength(rawNames.length);
      expect(displayNames).toEqual(
        expect.arrayContaining(
          rawNames.map(() => expect.stringMatching(/^Объект кэша [a-f0-9]{8}$/u)),
        ),
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);
});

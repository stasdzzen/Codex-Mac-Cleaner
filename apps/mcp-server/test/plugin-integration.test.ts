import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import {
  APP_VISIBLE_TOOL_DEFINITIONS,
  DASHBOARD_RESOURCE_URI,
  MODEL_VISIBLE_TOOL_DEFINITIONS,
  ScheduleIntentCoordinator,
  buildToolResult,
  createMcpServer,
} from "../src/server.js";

const platform = { platform: "darwin", arch: "arm64", release: "26.0.0" } as const;

const modelToolNames = [
  "audit_start",
  "audit_status",
  "audit_cancel",
  "audit_results",
  "dashboard_open",
  "finding_inspect",
  "finding_reveal",
  "schedule_intent_get",
  "schedule_intent_complete",
] as const;

const appToolNames = [
  "quarantine_prepare_move",
  "quarantine_move",
  "quarantine_list",
  "quarantine_prepare_restore",
  "quarantine_restore",
  "quarantine_prepare_purge",
  "quarantine_purge",
  "exclusion_create",
  "exclusion_list",
  "exclusion_remove",
  "exclusion_reset_prepare",
  "exclusion_reset",
  "schedule_request",
  "schedule_state",
] as const;

describe("полная интеграция MCP App", () => {
  it("регистрирует канонический model/app surface и скрывает app-only tools", async () => {
    const server = createMcpServer(platform, {
      dashboardHtml: "<!doctype html><html><body><main>Dashboard</main></body></html>",
    });
    const client = new Client({ name: "surface-contract", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      expect(Object.keys(MODEL_VISIBLE_TOOL_DEFINITIONS)).toEqual(modelToolNames);
      expect(Object.keys(APP_VISIBLE_TOOL_DEFINITIONS)).toEqual(appToolNames);

      const listed = await client.listTools();
      const byName = new Map(listed.tools.map((tool) => [tool.name, tool]));
      for (const name of modelToolNames) {
        expect(
          (byName.get(name)?._meta as { ui?: { visibility?: string[] } } | undefined)
            ?.ui?.visibility,
        ).toBeUndefined();
      }
      for (const name of appToolNames) {
        expect(byName.get(name)?._meta).toMatchObject({
          ui: { visibility: ["app"] },
        });
      }
      expect(byName.get("dashboard_open")?._meta).toMatchObject({
        ui: { resourceUri: DASHBOARD_RESOURCE_URI },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("не принимает path, destination или client identity в app-only schemas", () => {
    const forbiddenKeys = [
      "path",
      "sourcePath",
      "destination",
      "destinationPath",
      "clientId",
      "clientIdentity",
      "uiSessionId",
      "bundleId",
      "signingIdentity",
      "ownerIdentity",
    ];
    for (const [name, definition] of Object.entries(APP_VISIBLE_TOOL_DEFINITIONS)) {
      const jsonSchema = JSON.stringify(definition.inputSchema.toJSONSchema());
      for (const forbidden of forbiddenKeys) {
        expect(jsonSchema, `${name} содержит ${forbidden}`).not.toContain(`\"${forbidden}\"`);
      }
      expect(jsonSchema).toContain("additionalProperties");
    }
  });

  it("возвращает автономный versioned Dashboard resource без сетевого CSP", async () => {
    const html = "<!doctype html><html><body><main>Dashboard v1</main></body></html>";
    const server = createMcpServer(platform, { dashboardHtml: html });
    const client = new Client({ name: "resource-contract", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const resources = await client.listResources();
      expect(resources.resources).toEqual([
        expect.objectContaining({
          uri: DASHBOARD_RESOURCE_URI,
          mimeType: "text/html;profile=mcp-app",
        }),
      ]);
      const resource = await client.readResource({ uri: DASHBOARD_RESOURCE_URI });
      expect(resource.contents).toEqual([
        expect.objectContaining({
          uri: DASHBOARD_RESOURCE_URI,
          mimeType: "text/html;profile=mcp-app",
          text: html,
          _meta: expect.objectContaining({
            ui: expect.objectContaining({ csp: {} }),
          }),
        }),
      ]);
      expect(JSON.stringify(resource)).not.toMatch(
        /connectDomains|resourceDomains|frameDomains|https?:\/\//i,
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("schedule coordinator создаёт только intent и не вызывает host automation", async () => {
    let hostCalls = 0;
    const coordinator = new ScheduleIntentCoordinator({
      now: () => new Date("2026-07-18T02:00:00.000Z"),
      createId: () => "intent-synthetic-1",
      onHostAutomationCall: () => {
        hostCalls += 1;
      },
    });

    const requested = await coordinator.request({
      requestId: "request-schedule-1",
      action: "enable",
      dayOfMonth: 15,
      localTime: "10:30",
    });
    expect(requested).toMatchObject({
      intentId: "intent-synthetic-1",
      state: "awaiting_confirmation",
      requiresHostCapability: true,
    });
    expect(await coordinator.get({ intentId: requested.intentId })).toMatchObject({
      intentId: requested.intentId,
      action: "enable",
    });
    expect(hostCalls).toBe(0);

    await coordinator.complete({
      intentId: requested.intentId,
      requestId: "request-complete-1",
      outcome: "capability_unavailable",
      automationId: null,
    });
    expect(hostCalls).toBe(0);
    await expect(
      coordinator.request({
        requestId: "request-cron-1",
        action: "enable",
        dayOfMonth: 15,
        localTime: "10:30",
        cron: "0 10 * * *",
      } as never),
    ).rejects.toThrow();
  });

  it("fail-closed отклоняет shell/sudo для unsupported_manual model output", () => {
    const finding = {
      findingId: "finding-unsupported-1",
      displayName: "Системный компонент",
      category: "autostart",
      supportLevel: "unsupported_manual",
      logicalSize: 0,
      physicalSize: 0,
      label: "unknown",
      confidence: "low",
      risk: "high",
      allowedActions: ["inspect"],
      safeMetadata: {
        format: "unknown",
        parseStatus: "not_attempted",
        byteLength: 0,
        modifiedAt: "2026-07-18T02:00:00.000Z",
        sensitivityFlags: [],
      },
      blockingReasons: ["Требует расширенного режима"],
    } as const;
    const base = {
      findingId: finding.findingId,
      auditRevision: 1,
      stateVersion: 1,
      finding,
      evidenceSummaries: ["Изменяющие действия недоступны"],
      stale: false,
    };
    expect(
      buildToolResult("finding_inspect", base, "Проверка завершена"),
    ).toMatchObject({ structuredContent: base });
    for (const unsafe of ["sudo удалить объект", "Выполните rm -rf", "Запустите launchctl"]) {
      expect(() =>
        buildToolResult(
          "finding_inspect",
          { ...base, evidenceSummaries: [unsafe] },
          "Проверка завершена",
        ),
      ).toThrow();
    }
  });

  it("скомпилированный Dashboard package автономен", async () => {
    const html = await readFile(
      new URL("../../../.codex-plugin/assets/dashboard-v1.html", import.meta.url),
      "utf8",
    );
    expect(html).toContain("Audit Dashboard");
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("tools/call");
    const scriptStart = html.indexOf('<script type="module">');
    const scriptEnd = html.lastIndexOf("</script>");
    const withoutScript = `${html.slice(0, scriptStart)}${html.slice(
      scriptEnd + "</script>".length,
    )}`;
    const styleStart = withoutScript.indexOf("<style>");
    const styleEnd = withoutScript.lastIndexOf("</style>");
    const documentShell = `${withoutScript.slice(0, styleStart)}${withoutScript.slice(
      styleEnd + "</style>".length,
    )}`;
    expect(documentShell).not.toMatch(
      /<(?:script|link)[^>]+(?:src|href)=["'][^"']+/i,
    );
    expect(html).not.toMatch(
      /audit-public-synthetic|finding-public-synthetic|quarantine-public-synthetic/,
    );
    expect(html).toContain("Ожидание безопасного snapshot");
  });

  it("скомпилированный stdio runtime выполняет безопасный audit/dashboard flow", async () => {
    const repositoryRoot = new URL("../../../", import.meta.url).pathname;
    const runtimePath = new URL(
      "../../../.codex-plugin/runtime/server.js",
      import.meta.url,
    ).pathname;
    const syntheticRoot = await mkdtemp(join(tmpdir(), "cmc-compiled-runtime-"));
    const syntheticHome = join(syntheticRoot, "home");
    const syntheticData = join(
      syntheticHome,
      "Library",
      "Application Support",
      "Codex Mac Cleaner",
      "plugin",
    );
    const syntheticCaches = join(syntheticHome, "Library", "Caches");
    await mkdir(
      join(syntheticCaches, "Nested Git Directory Parent", "Nested Project", ".git"),
      { recursive: true },
    );
    const nestedGitFileParent = join(
      syntheticCaches,
      "Nested Git File Parent",
      "Nested Project",
    );
    await mkdir(nestedGitFileParent, { recursive: true });
    await writeFile(
      join(nestedGitFileParent, ".git"),
      "gitdir: synthetic-metadata\n",
      "utf8",
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [runtimePath, "--stdio"],
      cwd: repositoryRoot,
      env: {
        ...getDefaultEnvironment(),
        HOME: syntheticHome,
        CODEX_MAC_CLEANER_PLUGIN_ROOT: repositoryRoot,
        CODEX_MAC_CLEANER_PLUGIN_DATA: syntheticData,
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "compiled-runtime-smoke", version: "1.0.0" });
    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(modelToolNames.length + appToolNames.length);
      const resource = await client.readResource({ uri: DASHBOARD_RESOURCE_URI });
      expect(resource.contents[0]).toMatchObject({
        uri: DASHBOARD_RESOURCE_URI,
        mimeType: "text/html;profile=mcp-app",
      });

      const started = await client.callTool({
        name: "audit_start",
        arguments: {
          requestId: "compiled-audit-request-1",
          profile: "application_remnants",
        },
      });
      expect(started.isError).not.toBe(true);
      expect(started.structuredContent).toMatchObject({ state: "queued" });
      const auditId = (started.structuredContent as { auditId: string }).auditId;

      let status;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        status = await client.callTool({
          name: "audit_status",
          arguments: { auditId },
        });
        const state = (status.structuredContent as { state?: string } | undefined)?.state;
        if (["completed", "completed_with_warnings", "failed", "cancelled"].includes(state ?? "")) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(status?.isError).not.toBe(true);
      expect(status?.structuredContent).toMatchObject({
        auditId,
        state: expect.stringMatching(/^completed(?:_with_warnings)?$/),
      });

      const results = await client.callTool({
        name: "audit_results",
        arguments: { auditId, revision: 1, cursor: null, filters: {} },
      });
      expect(results.isError).not.toBe(true);
      expect(results.structuredContent).toMatchObject({ auditId, revision: 1, findings: [] });

      const dashboard = await client.callTool({
        name: "dashboard_open",
        arguments: { auditId, revision: 1 },
      });
      expect(dashboard.isError).not.toBe(true);
      expect(dashboard.structuredContent).toMatchObject({
        auditId,
        revision: 1,
        resourceUri: DASHBOARD_RESOURCE_URI,
        findings: [],
      });

      const quarantine = await client.callTool({ name: "quarantine_list", arguments: {} });
      expect(quarantine.isError).not.toBe(true);
      expect(quarantine.structuredContent).toMatchObject({ quarantineEntries: [] });

      const exclusions = await client.callTool({ name: "exclusion_list", arguments: {} });
      expect(exclusions.isError).not.toBe(true);
      expect(exclusions.structuredContent).toMatchObject({ exclusions: [] });
    } finally {
      await client.close();
      await rm(syntheticRoot, { recursive: true, force: true });
    }
  });
});

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  createNodeMacOSCorrelationReadOnlyFileSystem,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
} from "@codex-mac-cleaner/adapters";
import { resolveCorrelation } from "@codex-mac-cleaner/evidence";
import {
  InstallationKeyStore,
  KeyedOwnerBindingHistoryStore,
} from "@codex-mac-cleaner/storage";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  APP_VISIBLE_TOOL_DEFINITIONS,
  DASHBOARD_RESOURCE_URI,
  MODEL_VISIBLE_TOOL_DEFINITIONS,
  ScheduleIntentCoordinator,
  buildToolResult,
  createMcpServer,
} from "../src/server.js";

const platform = { platform: "darwin", arch: "arm64", release: "26.0.0" } as const;
const execFileAsync = promisify(execFile);
const repositoryRoot = new URL("../../../", import.meta.url).pathname;
let packagedRoot = "";

beforeAll(async () => {
  packagedRoot = await mkdtemp(join(tmpdir(), "cmc-plugin-integration-build-"));
  await execFileAsync(
    process.execPath,
    [
      join(repositoryRoot, "apps/mcp-server/scripts/build-plugin-runtime.mjs"),
      "--output-root",
      packagedRoot,
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, NODE_ENV: "production" },
      maxBuffer: 32 * 1024 * 1024,
    },
  );
}, 120_000);

afterAll(async () => {
  if (packagedRoot !== "") {
    await rm(packagedRoot, { recursive: true, force: true });
  }
});

function packagedPath(...segments: string[]): string {
  return join(packagedRoot, ...segments);
}

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

async function waitForCompletedAudit(client: Client, requestId: string) {
  const started = await client.callTool({
    name: "audit_start",
    arguments: { requestId, profile: "application_remnants" },
  });
  expect(started.isError).not.toBe(true);
  const auditId = (started.structuredContent as { auditId: string }).auditId;
  let status;
  for (let attempt = 0; attempt < 6_000; attempt += 1) {
    status = await client.callTool({
      name: "audit_status",
      arguments: { auditId },
    });
    const state = (status.structuredContent as { state?: string } | undefined)?.state;
    if (["completed", "completed_with_warnings", "failed", "cancelled"].includes(state ?? "")) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(status?.structuredContent).toMatchObject({
    auditId,
    state: expect.stringMatching(/^completed(?:_with_warnings)?$/),
  });
  const results = await client.callTool({
    name: "audit_results",
    arguments: { auditId, revision: 1, cursor: null, filters: {} },
  });
  expect(results.isError).not.toBe(true);
  return { auditId, results };
}

function generatedInode(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

async function seedGeneratedOwnerHistory(
  syntheticHome: string,
  stateRoot: string,
  candidatePath: string,
): Promise<Readonly<{ bundleId: string }>> {
  const suffix = randomUUID().replaceAll("-", "");
  const bundleId = `org.example.cmc.${suffix}`;
  const appPath = join(syntheticHome, "Applications", `Owner-${suffix}.app`);
  const executablePath = join(appPath, "Contents", "MacOS", "Owner");
  const nodeFilesystem = createNodeMacOSCorrelationReadOnlyFileSystem();
  const filesystem: MacOSCorrelationReadOnlyFileSystem = {
    async canonicalize(path, signal) {
      signal.throwIfAborted();
      if (path === appPath || path === executablePath) return path;
      return nodeFilesystem.canonicalize(path, signal);
    },
    async stat(path, signal) {
      signal.throwIfAborted();
      if (path === appPath || path === executablePath) {
        return {
          device: "generated-device",
          inode: generatedInode(path),
          fileType: path === appPath ? "bundle" : "file",
          uid: process.getuid?.() ?? 501,
          gid: process.getgid?.() ?? 20,
          size: 1,
          modifiedAtMs: 1,
        };
      }
      return nodeFilesystem.stat(path, signal);
    },
    async readDirectory(path, signal) {
      signal.throwIfAborted();
      if (path === join(syntheticHome, "Applications")) {
        return [{ path: appPath, fileType: "bundle" }];
      }
      if (
        path === "/Applications" ||
        path === "/System/Applications" ||
        path === "/Library/LaunchAgents" ||
        path === "/Library/LaunchDaemons" ||
        path === join(syntheticHome, "Library", "LaunchAgents")
      ) {
        return [];
      }
      return nodeFilesystem.readDirectory(path, signal);
    },
  };
  const executor: ArgvExecutor = async (executable, argv) => {
    if (executable === "/usr/bin/plutil") {
      return {
        stdout: JSON.stringify({
          CFBundleIdentifier: bundleId,
          CFBundleExecutable: "Owner",
        }),
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/bin/codesign") {
      return {
        stdout: "",
        stderr: [
          `designated => identifier ${bundleId} and anchor apple generic`,
          `TeamIdentifier=TEAM${suffix.slice(0, 12).toUpperCase()}`,
        ].join("\n"),
        exitCode: 0,
      };
    }
    if (executable === "/bin/ps") {
      return {
        stdout: `42 Sat Jul 18 00:00:00 2026 ${executablePath}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/lsof") {
      return {
        stdout: `p42\ncOwner\nn${candidatePath}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/pkgutil") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    throw new Error(`UNEXPECTED_GENERATED_BOUNDARY:${executable}:${argv.length}`);
  };
  const installationKey = await new InstallationKeyStore({ stateRoot })
    .loadOrCreate();
  const adapter = createMacOSProductionCorrelationAdapter({
    commands: createCommandRunner(executor),
    candidates: createMacOSCandidateRegistry({
      candidates: new Map([["candidate-generated-history", candidatePath]]),
      userHome: syntheticHome,
    }),
    filesystem,
    stateRoot,
    installationKey,
    now: () => "2026-07-18T00:00:00.000Z",
  });
  const rawInput = await adapter.buildInput({
    candidateRef: "candidate-generated-history",
    snapshotId: `snapshot-${randomUUID()}`,
    signal: new AbortController().signal,
  });
  resolveCorrelation({
    auditId: `audit-${randomUUID()}`,
    auditRevision: 1,
    findingId: `finding-${randomUUID()}`,
    exclusionStateVersion: 0,
    ruleSetVersion: 2,
    policyVersion: 2,
    now: "2026-07-18T00:00:00.000Z",
    deriver: installationKey,
    rawInput,
  });
  const history = await new KeyedOwnerBindingHistoryStore(stateRoot).list();
  expect(history).toHaveLength(1);
  expect(JSON.stringify(history)).not.toContain(candidatePath);
  expect(JSON.stringify(history)).not.toContain(bundleId);
  return { bundleId };
}

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
        ).toEqual(name === "dashboard_open" ? ["model"] : undefined);
      }
      for (const name of appToolNames) {
        expect(byName.get(name)?._meta).toMatchObject({
          ui: { visibility: ["app"] },
        });
      }
      expect(byName.get("dashboard_open")?._meta).toMatchObject({
        ui: {
          resourceUri: DASHBOARD_RESOURCE_URI,
          visibility: ["model"],
        },
        "ui/resourceUri": DASHBOARD_RESOURCE_URI,
        "openai/outputTemplate": DASHBOARD_RESOURCE_URI,
        "openai/widgetAccessible": true,
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
            ui: expect.objectContaining({
              csp: {
                redirectDomains: ["https://github.com", "https://dzzen.com"],
              },
            }),
          }),
        }),
      ]);
      expect(JSON.stringify(resource)).not.toMatch(
        /connectDomains|resourceDomains|frameDomains/i,
      );
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("schedule coordinator остаётся inert/unavailable и не вызывает host automation", async () => {
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
      state: "capability_unavailable",
      requiresHostCapability: true,
    });
    expect(await coordinator.get({ intentId: requested.intentId })).toMatchObject({
      intentId: requested.intentId,
      action: "enable",
      state: "capability_unavailable",
    });
    expect(hostCalls).toBe(0);

    await expect(
      coordinator.complete({
        intentId: requested.intentId,
        requestId: "request-complete-1",
        outcome: "capability_unavailable",
        automationId: null,
      }),
    ).rejects.toThrow("SCHEDULE_INTENT_NOT_PENDING");
    expect(await coordinator.state({})).toMatchObject({
      enabled: false,
      capabilityState: "unavailable",
      pendingIntentId: null,
    });
    const server = createMcpServer(platform, { scheduleService: coordinator });
    const client = new Client({ name: "schedule-unavailable", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const unavailable = await client.callTool({
        name: "schedule_request",
        arguments: {
          requestId: "request-schedule-unavailable",
          action: "pause",
        },
      });
      expect(JSON.stringify(unavailable.content)).toContain("недоступно");
      expect(JSON.stringify(unavailable.content)).not.toMatch(
        /требуется отдельная host capability|подтверждени/iu,
      );
    } finally {
      await client.close();
      await server.close();
    }
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
      packagedPath(".codex-plugin", "assets", "dashboard-v2.html"),
      "utf8",
    );
    expect(html).toContain("Audit Dashboard");
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("tools/call");
    expect(html).toContain("requestDisplayMode");
    expect(html).toContain("openExternal");
    expect(html).toContain("fullscreen");
    expect(html).toContain("Развернуть");
    expect(html).toContain("© 2026 Dzzen");
    expect(html).toContain("https://github.com/stasdzzen/Codex-Mac-Cleaner");
    expect(html).toContain("https://dzzen.com/support");
    expect(html).not.toContain("Мини-окно");
    expect(html).not.toMatch(/(?:["'`])pip(?:["'`])/u);
    expect(html.match(/<!doctype html>/giu)).toHaveLength(1);
    expect(html.match(/<script type="module">/giu)).toHaveLength(1);
    expect(html.match(/<\/script>/giu)).toHaveLength(1);
    expect(html.match(/<style\b/giu)).toHaveLength(1);
    expect(html.match(/<\/style>/giu)).toHaveLength(1);
    expect(html).not.toMatch(/<script[^>]+src=["'][^"']+/iu);
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

  it("не выпускает core preview secret в source или compiled package", async () => {
    const [source, runtime] = await Promise.all([
      readFile(new URL("../src/runtime.ts", import.meta.url), "utf8"),
      readFile(
        packagedPath(".codex-plugin", "runtime", "server.js"),
        "utf8",
      ),
    ]);
    expect(source).not.toMatch(/previewToken:\s*preview\.secret/u);
    expect(source).not.toMatch(/token:\s*input\.previewToken/u);
    expect(runtime).toContain("action-handle-");
    expect(runtime).not.toMatch(
      /previewToken:[A-Za-z_$][\w$]*\.secret/u,
    );
    expect(runtime).not.toMatch(/token:[A-Za-z_$][\w$]*\.previewToken/u);
  });

  it("packaged MCP-манифест запускает безопасный audit/dashboard flow", async () => {
    const mcpManifest = JSON.parse(
      await readFile(join(repositoryRoot, ".mcp.json"), "utf8"),
    ) as {
      mcpServers: {
        codexMacCleaner: {
          command: string;
          args: string[];
          cwd: string;
          env?: Record<string, string>;
        };
      };
    };
    const launch = mcpManifest.mcpServers.codexMacCleaner;
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
      command: launch.command,
      args: launch.args,
      cwd: join(packagedRoot, launch.cwd),
      env: {
        ...getDefaultEnvironment(),
        HOME: syntheticHome,
        ...launch.env,
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

      const liveDashboard = await client.callTool({
        name: "dashboard_open",
        arguments: { auditId, revision: null },
      });
      expect(liveDashboard.isError).not.toBe(true);
      expect(liveDashboard.structuredContent).toMatchObject({
        auditId,
        resourceUri: DASHBOARD_RESOURCE_URI,
      });
      expect(liveDashboard._meta).toMatchObject({
        "openai/outputTemplate": DASHBOARD_RESOURCE_URI,
      });
      expect(liveDashboard.structuredContent).toMatchObject({
        revision: null,
        findings: [],
      });

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

      const completedLiveDashboard = await client.callTool({
        name: "dashboard_open",
        arguments: { auditId, revision: null },
      });
      expect(completedLiveDashboard.isError).not.toBe(true);
      expect(completedLiveDashboard.structuredContent).toMatchObject({
        auditId,
        revision: null,
        findings: [],
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

  it(
    "скомпилированный stdio runtime использует package-owned history N и проводит N+1 prepare/move/restore",
    async () => {
      const runtimePath = packagedPath(".codex-plugin", "runtime", "server.js");
      const boundaryPath = new URL(
        "./compiled-runtime-boundary.mjs",
        import.meta.url,
      ).pathname;
      const syntheticRoot = await mkdtemp(join(tmpdir(), "cmc-compiled-correlation-"));
      const syntheticHome = join(syntheticRoot, "home");
      const stateRoot = join(
        syntheticHome,
        "Library",
        "Application Support",
        "Codex Mac Cleaner",
        "plugin",
      );
      const candidateName = `Generated Remnant ${randomUUID()}`;
      const candidatePath = join(syntheticHome, "Library", "Caches", candidateName);
      const protectedSibling = join(syntheticHome, "Library", "Caches", "Credentials");
      await mkdir(join(syntheticHome, "Library", "Caches"), { recursive: true });
      await writeFile(candidatePath, "", "utf8");
      await mkdir(protectedSibling, { recursive: true });
      const seeded = await seedGeneratedOwnerHistory(
        syntheticHome,
        stateRoot,
        candidatePath,
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["--import", boundaryPath, runtimePath, "--stdio"],
        cwd: repositoryRoot,
        env: {
          ...getDefaultEnvironment(),
          HOME: syntheticHome,
          CODEX_MAC_CLEANER_PLUGIN_ROOT: packagedRoot,
          CODEX_MAC_CLEANER_PLUGIN_DATA: stateRoot,
        },
        stderr: "ignore",
      });
      const client = new Client({ name: "compiled-correlation-e2e", version: "1.0.0" });
      try {
        await client.connect(transport);
        const revisionN1 = await waitForCompletedAudit(
          client,
          `audit-n1-${randomUUID()}`,
        );
        const finding = (revisionN1.results.structuredContent as {
          findings: Array<{
            findingId: string;
            displayName: string;
            allowedActions: string[];
          }>;
        }).findings.find(({ allowedActions }) =>
          allowedActions.includes("prepare_move"),
        );
        expect(finding).toBeDefined();
        expect(finding?.displayName).toMatch(/^Объект кэша [a-f0-9]{8}$/u);
        expect(finding?.displayName).not.toContain(candidateName);

        const dashboard = await client.callTool({
          name: "dashboard_open",
          arguments: { auditId: revisionN1.auditId, revision: 1 },
        });
        const dashboardFinding = (
          (dashboard._meta as { dashboard?: { findings?: unknown[] } } | undefined)
            ?.dashboard?.findings ?? []
        ).find((value) =>
          typeof value === "object" &&
          value !== null &&
          Reflect.get(value, "findingId") === finding?.findingId
        ) as Record<string, unknown> | undefined;
        expect(dashboardFinding).toMatchObject({
          ownerBindingState: "resolved",
          requirementProfileId: "private_regenerable_remnant_v1",
          allowedActions: expect.arrayContaining(["prepare_move"]),
        });
        expect(finding?.allowedActions).toContain("prepare_move");

        const preview = await client.callTool({
          name: "quarantine_prepare_move",
          arguments: { findingId: finding?.findingId, auditRevision: 1 },
        });
        expect(preview.isError).not.toBe(true);
        expect(preview.structuredContent).toMatchObject({
          findingId: finding?.findingId,
          displayName: finding?.displayName,
        });
        const previewToken = (preview.structuredContent as { previewToken: string })
          .previewToken;
        expect(previewToken).toMatch(/^action-handle-/u);
        const operationId = `operation-${randomUUID()}`;
        const moved = await client.callTool({
          name: "quarantine_move",
          arguments: { previewToken, operationId },
        });
        expect(moved.isError).not.toBe(true);
        await expect(stat(candidatePath)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(stat(protectedSibling)).resolves.toBeDefined();
        const replayedMove = await client.callTool({
          name: "quarantine_move",
          arguments: { previewToken, operationId },
        });
        expect(replayedMove.isError).not.toBe(true);
        expect(replayedMove.structuredContent).toEqual(moved.structuredContent);
        const crossOperationMove = await client.callTool({
          name: "quarantine_move",
          arguments: {
            previewToken,
            operationId: `other-operation-${randomUUID()}`,
          },
        });
        expect(crossOperationMove.isError).toBe(true);

        const restorePreview = await client.callTool({
          name: "quarantine_prepare_restore",
          arguments: { operationId },
        });
        const restoreToken = (
          restorePreview.structuredContent as { previewToken: string }
        ).previewToken;
        expect(restoreToken).toMatch(/^action-handle-/u);
        const restored = await client.callTool({
          name: "quarantine_restore",
          arguments: { operationId, previewToken: restoreToken },
        });
        expect(restored.isError).not.toBe(true);
        await expect(stat(candidatePath)).resolves.toBeDefined();
        await expect(stat(protectedSibling)).resolves.toBeDefined();
        const replayedRestore = await client.callTool({
          name: "quarantine_restore",
          arguments: { operationId, previewToken: restoreToken },
        });
        expect(replayedRestore.isError).not.toBe(true);
        expect(replayedRestore.structuredContent).toEqual(
          restored.structuredContent,
        );

        const publicResult = JSON.stringify({
          revisionN1: revisionN1.results,
          dashboard,
          preview,
          moved,
          replayedMove,
          restored,
          replayedRestore,
        });
        expect(publicResult).not.toContain(syntheticRoot);
        expect(publicResult).not.toContain(seeded.bundleId);
        expect(publicResult).not.toContain(candidateName);
        expect(publicResult).not.toMatch(
          /canonicalPath|bundleIdentifier|packageIdentifier|designatedRequirement|correlation graph/i,
        );
      } finally {
        await client.close();
        await rm(syntheticRoot, { recursive: true, force: true });
        await expect(stat(syntheticRoot)).rejects.toMatchObject({ code: "ENOENT" });
      }
    },
    600_000,
  );
});

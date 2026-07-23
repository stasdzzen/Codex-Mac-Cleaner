#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DASHBOARD_RESOURCE_URI =
  "ui://codex-mac-cleaner/dashboard-v3.html";
export const DASHBOARD_MIME_TYPE = "text/html;profile=mcp-app";

export const EXPECTED_MODEL_TOOLS = Object.freeze([
  "audit_start",
  "audit_status",
  "audit_cancel",
  "audit_results",
  "dashboard_open",
  "finding_inspect",
  "finding_reveal",
  "schedule_intent_get",
  "schedule_intent_complete",
]);

export const EXPECTED_APP_TOOLS = Object.freeze([
  "dashboard_page",
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
]);

const repositoryRoot = resolve(import.meta.dirname, "..");

function parseArguments(arguments_) {
  let pluginRoot = repositoryRoot;
  let json = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--plugin-root") {
      const value = arguments_[index + 1];
      if (!value) throw new Error("PLUGIN_ROOT_REQUIRED");
      pluginRoot = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`UNKNOWN_ARGUMENT:${argument}`);
  }
  return { pluginRoot, json };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function validateLaunchContract(mcp) {
  assert.deepEqual(
    Object.keys(mcp.mcpServers ?? {}),
    ["codexMacCleaner"],
    "MCP server identity drifted",
  );
  const launch = mcp.mcpServers.codexMacCleaner;
  assert.equal(launch.cwd, ".", "MCP cwd must stay plugin-relative");
  assert.equal(launch.command, "node", "MCP command must stay Node stdio");
  assert.deepEqual(
    launch.args,
    ["./.codex-plugin/runtime/server.js", "--stdio"],
    "MCP stdio entrypoint drifted",
  );
  assert.deepEqual(
    launch.env,
    { CODEX_MAC_CLEANER_PLUGIN_ROOT: "." },
    "MCP environment contract drifted",
  );
  assert.doesNotMatch(
    JSON.stringify(mcp),
    /https?:\/\/|streamablehttp|websocket|eventsource|terminal|shell/iu,
    "MCP launch contract must not contain HTTP or terminal fallback",
  );
  return launch;
}

function visibilityOf(tool) {
  return tool?._meta?.ui?.visibility;
}

function validateTools(tools) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const actual = [...byName.keys()].sort();
  const expected = [...EXPECTED_MODEL_TOOLS, ...EXPECTED_APP_TOOLS].sort();
  assert.deepEqual(actual, expected, "Packaged MCP tool inventory drifted");

  for (const name of EXPECTED_MODEL_TOOLS) {
    const expectedVisibility = name === "dashboard_open" ? ["model"] : undefined;
    assert.deepEqual(
      visibilityOf(byName.get(name)),
      expectedVisibility,
      `${name} visibility drifted`,
    );
  }
  for (const name of EXPECTED_APP_TOOLS) {
    assert.deepEqual(
      visibilityOf(byName.get(name)),
      ["app"],
      `${name} must remain app-only`,
    );
  }

  const dashboard = byName.get("dashboard_open");
  assert.equal(
    dashboard?._meta?.ui?.resourceUri,
    DASHBOARD_RESOURCE_URI,
    "dashboard_open resource URI drifted",
  );
  assert.equal(
    dashboard?._meta?.["ui/resourceUri"],
    DASHBOARD_RESOURCE_URI,
    "dashboard_open legacy resource URI drifted",
  );
  assert.equal(
    dashboard?._meta?.["openai/outputTemplate"],
    DASHBOARD_RESOURCE_URI,
    "dashboard_open output template drifted",
  );
  assert.equal(
    dashboard?._meta?.["openai/widgetAccessible"],
    true,
    "Dashboard must remain app-callable",
  );
}

function validateResource(resources, result) {
  const descriptor = resources.find(
    (resource) => resource.uri === DASHBOARD_RESOURCE_URI,
  );
  assert.ok(descriptor, "Dashboard resource URI drifted");
  assert.equal(
    descriptor.mimeType,
    DASHBOARD_MIME_TYPE,
    "Dashboard resource MIME drifted",
  );

  assert.equal(result.contents.length, 1, "Dashboard resource must be singular");
  const content = result.contents[0];
  assert.equal(content.uri, DASHBOARD_RESOURCE_URI);
  assert.equal(content.mimeType, DASHBOARD_MIME_TYPE);
  assert.match(content.text ?? "", /<!doctype html>/iu);

  const csp = content._meta?.ui?.csp;
  assert.deepEqual(
    csp?.redirectDomains,
    ["https://github.com", "https://dzzen.com"],
    "Dashboard redirect allowlist drifted",
  );
  for (const forbidden of [
    "connectDomains",
    "resourceDomains",
    "frameDomains",
  ]) {
    assert.equal(
      Object.hasOwn(csp ?? {}, forbidden),
      false,
      `Dashboard CSP unexpectedly contains ${forbidden}`,
    );
  }
}

async function loadClientSdk() {
  const requireFromServer = createRequire(
    join(repositoryRoot, "apps/mcp-server/package.json"),
  );
  const clientPath = requireFromServer.resolve(
    "@modelcontextprotocol/sdk/client/index.js",
  );
  const stdioPath = requireFromServer.resolve(
    "@modelcontextprotocol/sdk/client/stdio.js",
  );
  const [{ Client }, { StdioClientTransport, getDefaultEnvironment }] =
    await Promise.all([
      import(pathToFileURL(clientPath).href),
      import(pathToFileURL(stdioPath).href),
    ]);
  return { Client, StdioClientTransport, getDefaultEnvironment };
}

function withTimeout(promise, milliseconds, code) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function probePluginSurface(pluginRoot) {
  const [manifest, mcp] = await Promise.all([
    readJson(join(pluginRoot, ".codex-plugin/plugin.json")),
    readJson(join(pluginRoot, ".mcp.json")),
  ]);
  const launch = validateLaunchContract(mcp);
  const syntheticRoot = await mkdtemp(
    join(tmpdir(), "cmc-plugin-surface-probe-"),
  );
  const syntheticHome = join(syntheticRoot, "home");
  await mkdir(syntheticHome, { recursive: true });
  const { Client, StdioClientTransport, getDefaultEnvironment } =
    await loadClientSdk();
  const environment = Object.fromEntries(
    Object.entries(launch.env).map(([key, value]) => [
      key,
      value === "." ? pluginRoot : String(value),
    ]),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(pluginRoot, launch.args[0]), ...launch.args.slice(1)],
    cwd: resolve(pluginRoot, launch.cwd),
    env: {
      ...getDefaultEnvironment(),
      HOME: syntheticHome,
      ...environment,
    },
    stderr: "pipe",
  });
  const client = new Client({
    name: "codex-mac-cleaner-surface-probe",
    version: "1.0.0",
  });
  let connected = false;

  try {
    await withTimeout(client.connect(transport), 20_000, "MCP_CONNECT_TIMEOUT");
    connected = true;
    const [listedTools, listedResources] = await Promise.all([
      client.listTools(),
      client.listResources(),
    ]);
    validateTools(listedTools.tools);
    const resource = await client.readResource({
      uri: DASHBOARD_RESOURCE_URI,
    });
    validateResource(listedResources.resources, resource);

    return {
      ok: true,
      plugin: manifest.name,
      version: manifest.version,
      modelToolCount: EXPECTED_MODEL_TOOLS.length,
      appToolCount: EXPECTED_APP_TOOLS.length,
      resourceUri: DASHBOARD_RESOURCE_URI,
      mimeType: DASHBOARD_MIME_TYPE,
      transport: "stdio",
    };
  } finally {
    try {
      if (connected) await client.close();
      else await transport.close();
    } finally {
      await rm(syntheticRoot, { recursive: true, force: true });
    }
  }
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replaceAll(repositoryRoot, "<repository>")
    .replace(/\/Users\/[A-Za-z0-9._-]+(?:\/[^\s:)]*)?/gu, "<local-path>")
    .replace(/\/home\/[A-Za-z0-9._-]+(?:\/[^\s:)]*)?/gu, "<local-path>")
    .replace(/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+(?:\\[^\s:)]*)?/gu, "<local-path>");
}

async function main() {
  const { pluginRoot, json } = parseArguments(process.argv.slice(2));
  const result = await probePluginSurface(pluginRoot);
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stdout.write(
    [
      "Поверхность плагина: PASS",
      `Версия: ${result.version}`,
      `Инструменты: ${result.modelToolCount} model + ${result.appToolCount} app-only`,
      `Dashboard: ${result.resourceUri}`,
      `Transport: ${result.transport}`,
    ].join("\n") + "\n",
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    process.stderr.write(
      `Поверхность плагина: FAIL (${safeErrorMessage(error)})\n`,
    );
    process.exitCode = 1;
  });
}

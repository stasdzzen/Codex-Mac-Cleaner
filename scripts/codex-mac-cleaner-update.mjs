#!/usr/bin/env node

import { spawn } from "node:child_process";

const MARKETPLACE_NAME = "codex-mac-cleaner";
const PLUGIN_ID = "codex-mac-cleaner@codex-mac-cleaner";
const CANONICAL_REPOSITORY =
  "https://github.com/stasdzzen/Codex-Mac-Cleaner.git";
const RELEASE_TAG_PATTERN =
  /^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/u;
const COMMAND_TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;

class UpdateError extends Error {
  constructor(code) {
    super(code);
    this.name = "UpdateError";
    this.code = code;
  }
}

function command(binary, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, arguments_, {
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stdoutBytes = 0;
    let outputOverflow = false;
    const timer = setTimeout(() => child.kill("SIGKILL"), COMMAND_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        outputOverflow = true;
        child.kill("SIGKILL");
        return;
      }
      stdout += chunk;
    });
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      reject(new UpdateError("COMMAND_START_FAILED"));
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, outputOverflow });
    });
  });
}

async function run(binary, arguments_, errorCode) {
  const result = await command(binary, arguments_);
  if (
    result.exitCode !== 0 ||
    result.signal !== null ||
    result.outputOverflow
  ) {
    throw new UpdateError(errorCode);
  }
  return result.stdout;
}

function parsePluginState(payload) {
  let document;
  try {
    document = JSON.parse(payload);
  } catch {
    throw new UpdateError("PLUGIN_STATE_INVALID");
  }

  const installed = Array.isArray(document?.installed)
    ? document.installed.filter((entry) => entry?.pluginId === PLUGIN_ID)
    : [];
  if (installed.length !== 1) {
    throw new UpdateError("PLUGIN_NOT_INSTALLED");
  }

  const plugin = installed[0];
  if (
    plugin.installed !== true ||
    plugin.enabled !== true ||
    typeof plugin.version !== "string" ||
    plugin.marketplaceName !== MARKETPLACE_NAME
  ) {
    throw new UpdateError("PLUGIN_STATE_UNSUPPORTED");
  }
  if (
    plugin.marketplaceSource?.sourceType !== "git" ||
    plugin.marketplaceSource?.source !== CANONICAL_REPOSITORY
  ) {
    throw new UpdateError("MARKETPLACE_SOURCE_MISMATCH");
  }

  const previousRef = `v${plugin.version}`;
  if (!RELEASE_TAG_PATTERN.test(previousRef)) {
    throw new UpdateError("INSTALLED_VERSION_UNSUPPORTED");
  }
  return { version: plugin.version, ref: previousRef };
}

async function readPluginState(codexBinary) {
  const payload = await run(
    codexBinary,
    [
      "plugin",
      "list",
      "--marketplace",
      MARKETPLACE_NAME,
      "--available",
      "--json",
    ],
    "PLUGIN_STATE_READ_FAILED",
  );
  return parsePluginState(payload);
}

async function verifyReleaseTag(gitBinary, targetRef) {
  await run(
    gitBinary,
    [
      "ls-remote",
      "--exit-code",
      "--tags",
      CANONICAL_REPOSITORY,
      `refs/tags/${targetRef}`,
    ],
    "TARGET_TAG_NOT_FOUND",
  );
}

async function removeMarketplace(codexBinary, errorCode) {
  await run(
    codexBinary,
    ["plugin", "marketplace", "remove", MARKETPLACE_NAME],
    errorCode,
  );
}

async function addMarketplace(codexBinary, targetRef, errorCode) {
  await run(
    codexBinary,
    [
      "plugin",
      "marketplace",
      "add",
      CANONICAL_REPOSITORY,
      "--ref",
      targetRef,
      "--json",
    ],
    errorCode,
  );
}

async function installPlugin(codexBinary, errorCode) {
  await run(
    codexBinary,
    ["plugin", "add", PLUGIN_ID, "--json"],
    errorCode,
  );
}

async function verifyVersion(codexBinary, expectedVersion, errorCode) {
  const state = await readPluginState(codexBinary);
  if (state.version !== expectedVersion) {
    throw new UpdateError(errorCode);
  }
  return state;
}

async function rollback(codexBinary, previous) {
  try {
    await command(codexBinary, [
      "plugin",
      "marketplace",
      "remove",
      MARKETPLACE_NAME,
    ]);
    await addMarketplace(codexBinary, previous.ref, "ROLLBACK_ADD_FAILED");
    await installPlugin(codexBinary, "ROLLBACK_INSTALL_FAILED");
    await verifyVersion(
      codexBinary,
      previous.version,
      "ROLLBACK_VERIFY_FAILED",
    );
    return "restored";
  } catch {
    return "failed";
  }
}

function output(result, jsonOutput) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (result.status === "updated") {
    process.stdout.write(
      `Codex Mac Cleaner обновлён до ${result.targetRef}. Полностью перезапустите Codex и откройте новую задачу.\n`,
    );
    return;
  }
  if (result.status === "already_current") {
    process.stdout.write(`Codex Mac Cleaner уже использует ${result.targetRef}.\n`);
    return;
  }
  process.stderr.write(
    `Обновление остановлено: ${result.errorCode}. Rollback: ${result.rollback}.\n`,
  );
}

function parseArguments(arguments_) {
  const jsonOutput = arguments_.includes("--json");
  const positional = arguments_.filter((argument) => argument !== "--json");
  if (positional.length !== 1 || !RELEASE_TAG_PATTERN.test(positional[0])) {
    throw new UpdateError("EXACT_RELEASE_TAG_REQUIRED");
  }
  return { jsonOutput, targetRef: positional[0] };
}

async function main() {
  let jsonOutput = process.argv.includes("--json");
  let mutationStarted = false;
  let previous;
  try {
    const parsed = parseArguments(process.argv.slice(2));
    jsonOutput = parsed.jsonOutput;
    const targetRef = parsed.targetRef;
    const codexBinary =
      process.env.CODEX_MAC_CLEANER_CODEX_BINARY ?? "codex";
    const gitBinary = process.env.CODEX_MAC_CLEANER_GIT_BINARY ?? "git";

    previous = await readPluginState(codexBinary);
    const targetVersion = targetRef.slice(1);
    if (previous.version === targetVersion) {
      output(
        {
          schemaVersion: 1,
          status: "already_current",
          fromVersion: previous.version,
          toVersion: previous.version,
          targetRef,
          restartRequired: false,
        },
        jsonOutput,
      );
      return;
    }

    await verifyReleaseTag(gitBinary, targetRef);
    mutationStarted = true;
    await removeMarketplace(codexBinary, "TARGET_REMOVE_MARKETPLACE_FAILED");
    await addMarketplace(codexBinary, targetRef, "TARGET_ADD_FAILED");
    await installPlugin(codexBinary, "TARGET_INSTALL_FAILED");
    await verifyVersion(codexBinary, targetVersion, "TARGET_VERIFY_FAILED");

    output(
      {
        schemaVersion: 1,
        status: "updated",
        fromVersion: previous.version,
        toVersion: targetVersion,
        targetRef,
        restartRequired: true,
      },
      jsonOutput,
    );
  } catch (error) {
    const errorCode =
      error instanceof UpdateError ? error.code : "UPDATE_FAILED";
    const codexBinary =
      process.env.CODEX_MAC_CLEANER_CODEX_BINARY ?? "codex";
    const rollbackState =
      mutationStarted && previous
        ? await rollback(codexBinary, previous)
        : "not_required";
    output(
      {
        schemaVersion: 1,
        status: "failed",
        errorCode,
        rollback: rollbackState,
        restartRequired: false,
      },
      jsonOutput,
    );
    process.exitCode = 1;
  }
}

await main();

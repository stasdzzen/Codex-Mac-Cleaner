import { spawn } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const updater = resolve(repositoryRoot, "scripts/codex-mac-cleaner-update.mjs");
const canonicalRepository =
  "https://github.com/stasdzzen/Codex-Mac-Cleaner.git";

interface FakeState {
  version: string;
  ref: string;
  source: string;
  enabled: boolean;
  marketplacePresent: boolean;
  failTargetAdd?: boolean;
  failTargetInstall?: boolean;
  failRollbackAdd?: boolean;
  commands: string[][];
}

interface UpdaterResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const fakeCodex = String.raw`#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const path = process.env.FAKE_CODEX_STATE;
const state = JSON.parse(readFileSync(path, "utf8"));
const args = process.argv.slice(2);
state.commands.push(args);
const save = () => writeFileSync(path, JSON.stringify(state));
const fail = () => { save(); process.exit(9); };

if (args[0] === "plugin" && args[1] === "list") {
  save();
  process.stdout.write(JSON.stringify({
    installed: [{
      pluginId: "codex-mac-cleaner@codex-mac-cleaner",
      name: "codex-mac-cleaner",
      marketplaceName: "codex-mac-cleaner",
      version: state.version,
      installed: true,
      enabled: state.enabled,
      marketplaceSource: { sourceType: "git", source: state.source },
    }],
    available: [],
  }));
  process.exit(0);
}

if (args.join(" ") === "plugin marketplace remove codex-mac-cleaner") {
  state.marketplacePresent = false;
  save();
  process.exit(0);
}

if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {
  const ref = args[args.indexOf("--ref") + 1];
  if (ref === "v0.1.0-beta.3" && state.failTargetAdd) fail();
  if (ref === "v0.1.0-beta.2" && state.failRollbackAdd) fail();
  state.ref = ref;
  state.source = args[3];
  state.marketplacePresent = true;
  save();
  process.stdout.write("{}\n");
  process.exit(0);
}

if (args.join(" ") === "plugin add codex-mac-cleaner@codex-mac-cleaner --json") {
  if (state.ref === "v0.1.0-beta.3" && state.failTargetInstall) fail();
  state.version = state.ref.slice(1);
  save();
  process.stdout.write("{}\n");
  process.exit(0);
}

fail();
`;

const fakeGit = String.raw`#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const path = process.env.FAKE_CODEX_STATE;
const state = JSON.parse(readFileSync(path, "utf8"));
const args = process.argv.slice(2);
state.commands.push(["git", ...args]);
writeFileSync(path, JSON.stringify(state));
if (process.env.FAKE_TAG_MISSING === "1") process.exit(2);
process.stdout.write(args.at(-1) + "\n");
`;

async function fixture(overrides: Partial<FakeState> = {}) {
  const root = await mkdtemp(join(tmpdir(), "cmc-updater-test-"));
  const statePath = join(root, "state.json");
  const codexPath = join(root, "codex");
  const gitPath = join(root, "git");
  const state: FakeState = {
    version: "0.1.0-beta.2",
    ref: "v0.1.0-beta.2",
    source: canonicalRepository,
    enabled: true,
    marketplacePresent: true,
    commands: [],
    ...overrides,
  };
  await Promise.all([
    writeFile(statePath, JSON.stringify(state), "utf8"),
    writeFile(codexPath, fakeCodex, "utf8"),
    writeFile(gitPath, fakeGit, "utf8"),
  ]);
  await Promise.all([chmod(codexPath, 0o755), chmod(gitPath, 0o755)]);
  return { root, statePath, codexPath, gitPath };
}

async function runUpdater(
  current: Awaited<ReturnType<typeof fixture>>,
  target: string,
  additionalEnvironment: Record<string, string> = {},
): Promise<UpdaterResult> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [updater, "--json", target], {
      env: {
        ...process.env,
        CODEX_MAC_CLEANER_CODEX_BINARY: current.codexPath,
        CODEX_MAC_CLEANER_GIT_BINARY: current.gitPath,
        CODEX_HOME: current.root,
        FAKE_CODEX_STATE: current.statePath,
        ...additionalEnvironment,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

async function readState(path: string): Promise<FakeState> {
  return JSON.parse(await readFile(path, "utf8")) as FakeState;
}

describe("безопасный updater плагина", () => {
  it("обновляет ref и версию без plugin remove", async () => {
    const current = await fixture();
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "updated",
        fromVersion: "0.1.0-beta.2",
        toVersion: "0.1.0-beta.3",
        restartRequired: true,
      });
      expect(state).toMatchObject({
        ref: "v0.1.0-beta.3",
        version: "0.1.0-beta.3",
        enabled: true,
      });
      expect(state.commands).not.toContainEqual([
        "plugin",
        "remove",
        "codex-mac-cleaner@codex-mac-cleaner",
      ]);
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("не изменяет уже актуальную установку", async () => {
    const current = await fixture({
      version: "0.1.0-beta.3",
      ref: "v0.1.0-beta.3",
    });
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "already_current",
        restartRequired: false,
      });
      expect(state.commands).toHaveLength(1);
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("отклоняет неточный тег до обращения к Codex CLI", async () => {
    const current = await fixture();
    try {
      const result = await runUpdater(current, "latest");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "failed",
        errorCode: "EXACT_RELEASE_TAG_REQUIRED",
        rollback: "not_required",
      });
      expect(state.commands).toEqual([]);
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("блокирует посторонний marketplace source до изменений", async () => {
    const current = await fixture({
      source: "https://example.invalid/other.git",
    });
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        errorCode: "MARKETPLACE_SOURCE_MISMATCH",
        rollback: "not_required",
      });
      expect(state.commands).toHaveLength(1);
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("не начинает изменения, если target tag не существует", async () => {
    const current = await fixture();
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3", {
        FAKE_TAG_MISSING: "1",
      });
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        errorCode: "TARGET_TAG_NOT_FOUND",
        rollback: "not_required",
      });
      expect(state.marketplacePresent).toBe(true);
      expect(state.ref).toBe("v0.1.0-beta.2");
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("восстанавливает прежний ref после ошибки target add", async () => {
    const current = await fixture({ failTargetAdd: true });
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        errorCode: "TARGET_ADD_FAILED",
        rollback: "restored",
      });
      expect(state).toMatchObject({
        ref: "v0.1.0-beta.2",
        version: "0.1.0-beta.2",
        marketplacePresent: true,
      });
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("восстанавливает прежний ref после ошибки reinstall", async () => {
    const current = await fixture({ failTargetInstall: true });
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");
      const state = await readState(current.statePath);

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        errorCode: "TARGET_INSTALL_FAILED",
        rollback: "restored",
      });
      expect(state).toMatchObject({
        ref: "v0.1.0-beta.2",
        version: "0.1.0-beta.2",
        marketplacePresent: true,
      });
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });

  it("сообщает блокирующий сбой rollback", async () => {
    const current = await fixture({
      failTargetAdd: true,
      failRollbackAdd: true,
    });
    try {
      const result = await runUpdater(current, "v0.1.0-beta.3");

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        errorCode: "TARGET_ADD_FAILED",
        rollback: "failed",
      });
    } finally {
      await rm(current.root, { recursive: true, force: true });
    }
  });
});

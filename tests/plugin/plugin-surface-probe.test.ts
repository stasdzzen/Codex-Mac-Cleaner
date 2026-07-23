import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  DASHBOARD_RESOURCE_URI,
  EXPECTED_APP_TOOLS,
  EXPECTED_MODEL_TOOLS,
} from "../../scripts/probe-plugin-surface.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("probe поверхности плагина", () => {
  it("подтверждает packaged stdio tools, видимость и Dashboard resource", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "scripts/probe-plugin-surface.mjs"), "--json"],
      { cwd: repositoryRoot, timeout: 30_000 },
    );
    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      plugin: "codex-mac-cleaner",
      version: "0.1.0-beta.11",
      modelToolCount: 9,
      appToolCount: 15,
      resourceUri: DASHBOARD_RESOURCE_URI,
      mimeType: "text/html;profile=mcp-app",
      transport: "stdio",
    });
  });

  it("сохраняет точное соответствие capability matrix", async () => {
    const matrix = await readFile(
      resolve(repositoryRoot, "docs/quality/plugin-capability-matrix.md"),
      "utf8",
    );
    const rows = [...matrix.matchAll(/^\| `([a-z_]+)` \| `(model|app)` \|/gmu)];
    const model = rows
      .filter((match) => match[2] === "model")
      .map((match) => match[1]);
    const app = rows
      .filter((match) => match[2] === "app")
      .map((match) => match[1]);
    expect(model).toEqual(EXPECTED_MODEL_TOOLS);
    expect(app).toEqual(EXPECTED_APP_TOOLS);
  });

  it("завершается ошибкой при drift Dashboard resource", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-probe-drift-"));
    temporaryRoots.push(root);
    await Promise.all([
      mkdir(join(root, ".codex-plugin/runtime"), { recursive: true }),
      mkdir(join(root, ".codex-plugin/assets"), { recursive: true }),
    ]);
    await Promise.all([
      copyFile(
        resolve(repositoryRoot, ".codex-plugin/plugin.json"),
        join(root, ".codex-plugin/plugin.json"),
      ),
      copyFile(resolve(repositoryRoot, ".mcp.json"), join(root, ".mcp.json")),
      copyFile(
        resolve(repositoryRoot, ".codex-plugin/assets/dashboard-v3.html"),
        join(root, ".codex-plugin/assets/dashboard-v3.html"),
      ),
    ]);
    const runtime = await readFile(
      resolve(repositoryRoot, ".codex-plugin/runtime/server.js"),
      "utf8",
    );
    const drifted = runtime.replaceAll(
      DASHBOARD_RESOURCE_URI,
      "ui://codex-mac-cleaner/dashboard-drift.html",
    );
    expect(drifted).not.toBe(runtime);
    await writeFile(
      join(root, ".codex-plugin/runtime/server.js"),
      drifted,
      "utf8",
    );

    await expect(
      execFileAsync(
        process.execPath,
        [
          resolve(repositoryRoot, "scripts/probe-plugin-surface.mjs"),
          "--plugin-root",
          root,
          "--json",
        ],
        { cwd: repositoryRoot, timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: 1 });
  });
});

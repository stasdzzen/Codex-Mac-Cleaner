import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("repository marketplace plugin", () => {
  it("имеет manifest, локальный stdio MCP и существующий entrypoint", async () => {
    const manifest = await readJson(".codex-plugin/plugin.json");
    expect(manifest).toMatchObject({
      name: "codex-mac-cleaner",
      version: "0.1.0-beta.2",
      license: "Apache-2.0",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    });

    const marketplace = await readJson(".agents/plugins/marketplace.json");
    expect(marketplace).toMatchObject({
      name: "codex-mac-cleaner",
      interface: { displayName: "Codex Mac Cleaner" },
      plugins: [
        {
          name: "codex-mac-cleaner",
          source: { source: "local", path: "./" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    });

    const mcp = await readJson(".mcp.json");
    const servers = mcp.mcpServers as Record<string, Record<string, unknown>>;
    expect(Object.keys(servers)).toEqual(["codexMacCleaner"]);
    expect(servers.codexMacCleaner).toMatchObject({
      cwd: ".",
      command: "node",
      args: ["./.codex-plugin/runtime/server.js", "--stdio"],
      env: {
        CODEX_MAC_CLEANER_PLUGIN_ROOT: ".",
      },
    });
    expect(servers.codexMacCleaner.env).not.toHaveProperty(
      "CODEX_MAC_CLEANER_PLUGIN_DATA",
    );
    expect(JSON.stringify(mcp)).not.toMatch(/https?:\/\/|telemetry|network/i);

    const entrypoint = resolve(
      repositoryRoot,
      (servers.codexMacCleaner.args as string[])[0] ?? "",
    );
    expect(entrypoint).toBeDefined();
    await access(entrypoint!);
    expect(dirname(entrypoint!)).toBe(resolve(repositoryRoot, ".codex-plugin/runtime"));
  });

  it("Skill сохраняет no-terminal и app-confirmation flow", async () => {
    const skill = await readFile(
      resolve(repositoryRoot, "skills/codex-mac-cleaner/SKILL.md"),
      "utf8",
    );
    expect(skill).toMatch(/profile[^\n]*application_remnants/i);
    expect(skill).toMatch(/dashboard_open/i);
    expect(skill).toMatch(/audit_cancel[^\n]*явн/i);
    expect(skill).toMatch(/клик[^\n]*(?:подтверж|одн)|подтверж[^\n]*клик/i);
    expect(skill).not.toMatch(/```(?:bash|sh|zsh|shell)|\bsudo\b|\brm\s+-|launchctl|готово[»"]?/i);
    expect(skill).not.toMatch(
      /quarantine_(?:prepare|move|restore|purge|list)|exclusion_(?:create|list|remove|reset)|schedule_request|schedule_state/i,
    );
  });

  it("package allowlist исключает local state и проходит privacy scan", async () => {
    const contract = await readJson(".codex-plugin/package-allowlist.json");
    const files = contract.files as string[];
    expect(files).toEqual([
      ".codex-plugin/plugin.json",
      ".codex-plugin/package-allowlist.json",
      ".codex-plugin/runtime/server.js",
      ".codex-plugin/assets/dashboard-v1.html",
      ".mcp.json",
      "skills/codex-mac-cleaner/SKILL.md",
      "LICENSE",
      "docs/release/third-party-notices.json",
    ]);
    expect(JSON.stringify(contract)).not.toMatch(
      /node_modules|local.state|inventory|evidence|fixture|\.codex\/|application.support/i,
    );

    const fileContents = await Promise.all(
      files.map(async (file) => {
        const absolute = resolve(repositoryRoot, file);
        await access(absolute);
        return { file, text: await readFile(absolute, "utf8") };
      }),
    );
    const payload = fileContents.map(({ text }) => text).join("\n");
    const codePayload = fileContents
      .filter(({ file }) => file !== "docs/release/third-party-notices.json")
      .map(({ text }) => text)
      .join("\n");
    expect(payload).not.toMatch(/\/Users\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/i);
    expect(payload).not.toMatch(
      /\b(?:sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})\b/i,
    );
    expect(payload).not.toContain("/Users/admin");
    expect(codePayload).not.toMatch(
      /\b(?:XMLHttpRequest|WebSocket|EventSource|StreamableHTTP|SSEServerTransport|telemetry)\b/i,
    );
  });
});

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-10: supply-chain and public package boundary", () => {
  it("workflows используют read-only permissions и pinned GitHub-owned actions", async () => {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", ".github/workflows/*.yml"],
      { cwd: repositoryRoot },
    );
    const workflows = stdout.trim().split("\n").filter(Boolean);
    expect(workflows.length).toBeGreaterThan(0);
    for (const workflow of workflows) {
      const text = await readFile(resolve(repositoryRoot, workflow), "utf8");
      expect(text).toMatch(/^permissions:\s*\n\s+contents:\s+read\s*$/mu);
      expect(text).not.toMatch(/pull_request_target|permissions:\s*write-all|secrets:\s*inherit/iu);
      for (const match of text.matchAll(/^\s*-?\s*uses:\s*([^@\s]+)@([^\s#]+)/gmu)) {
        expect(match[1]).toMatch(/^(?:actions|github)\//u);
        expect(match[2]).toMatch(/^[a-f0-9]{40}$/u);
      }
    }
  });

  it("shipped plugin не содержит scheduler, network transport или developer state", async () => {
    const contract = JSON.parse(
      await readFile(resolve(repositoryRoot, ".codex-plugin/package-allowlist.json"), "utf8"),
    ) as { files: string[] };
    const payload = (
      await Promise.all(
        contract.files.map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
      )
    ).join("\n");
    expect(payload).not.toMatch(/\/Users\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/u);
    expect(payload).not.toMatch(/\blaunchctl\b|\bcrontab\b|node-cron|cron-parser|node-schedule/iu);
    expect(payload).not.toMatch(/XMLHttpRequest|WebSocket|EventSource|telemetry/iu);
    expect(payload).not.toMatch(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\bghp_[A-Za-z0-9]{20,}/u);
    expect(contract.files).not.toContain(expect.stringMatching(/\.map$|\/(?:state|history|inventory)\//iu));
    expect(
      contract.files.filter((path) => path.endsWith(".json")),
    ).toEqual([
      ".codex-plugin/plugin.json",
      ".codex-plugin/package-allowlist.json",
      ".mcp.json",
    ]);
  });
});

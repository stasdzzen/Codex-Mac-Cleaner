import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const shippedArtifacts = [
  ".codex-plugin/runtime/server.js",
  ".codex-plugin/assets/dashboard-v3.html",
  ".codex-plugin/package-allowlist.json",
  "docs/release/third-party-notices.json",
] as const;

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("repository marketplace bundle freshness", () => {
  it(
    "побайтно совпадает со свежей canonical сборкой",
    async () => {
      const outputRoot = await mkdtemp(join(tmpdir(), "cmc-plugin-freshness-"));

      try {
        await execFileAsync(
          process.execPath,
          [
            "apps/mcp-server/scripts/build-plugin-runtime.mjs",
            "--output-root",
            outputRoot,
          ],
          {
            cwd: repositoryRoot,
            env: { ...process.env, NODE_ENV: "production" },
            maxBuffer: 10 * 1024 * 1024,
          },
        );

        for (const artifact of shippedArtifacts) {
          const [shipped, fresh] = await Promise.all([
            readFile(resolve(repositoryRoot, artifact)),
            readFile(resolve(outputRoot, artifact)),
          ]);

          expect(sha256(shipped), `${artifact} SHA-256`).toBe(sha256(fresh));
          expect(shipped.equals(fresh), `${artifact} bytes`).toBe(true);
        }
      } finally {
        await rm(outputRoot, { recursive: true, force: true });
      }
    },
    120_000,
  );

  it("содержит CMC-10 hardening без raw basename и schedule lifecycle", async () => {
    const [runtime, dashboard] = await Promise.all([
      readFile(resolve(repositoryRoot, shippedArtifacts[0]), "utf8"),
      readFile(resolve(repositoryRoot, shippedArtifacts[1]), "utf8"),
    ]);

    expect(runtime).toContain("EMPTY_CACHE_LOG_ARTIFACT_V1");
    expect(runtime).toContain("Объект кэша");
    expect(dashboard).toContain("Автопроверка появится позже");
    expect(dashboard).toContain("Проверить сейчас");
    expect(dashboard).toContain("Развернуть");
    expect(dashboard).not.toContain("Мини-окно");
    expect(dashboard).toContain("audit_start");
    expect(dashboard).not.toMatch(/schedule_(?:request|state|intent)/u);
    expect(dashboard).not.toContain("Расписание read-only аудита появится");

    const shippedPayload = `${runtime}\n${dashboard}`;
    for (const rawCanary of [
      "PRIVATE_KEY=synthetic-value",
      "Authorization: Basic synthetic-value",
      "Proxy-Authorization: Custom synthetic-value",
      "Readable Control Cache",
    ]) {
      expect(shippedPayload).not.toContain(rawCanary);
    }
  });
});

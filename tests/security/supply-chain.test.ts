import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { assertApprovedSpdxLicense } from "../../scripts/release-license-metadata.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const approvedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MPL-2.0",
]);

function readTarEntries(archive: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= archive.length; ) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/u, "");
    const sizeText = header
      .subarray(124, 136)
      .toString("ascii")
      .replace(/\0.*$/u, "")
      .trim();
    const size = Number.parseInt(sizeText, 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`INVALID_TAR:${name}`);
    const contentStart = offset + 512;
    entries.set(name, archive.subarray(contentStart, contentStart + size));
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe("CMC-10: supply-chain and public package boundary", () => {
  it("полностью декодирует package path separators в CycloneDX purl", async () => {
    const source = await readFile(
      resolve(repositoryRoot, "scripts/release-license-metadata.mjs"),
      "utf8",
    );
    expect(source).toContain('.replaceAll("%2F", "/")');
    expect(source).not.toContain('.replace("%2F", "/")');
  });

  it("fail closed отклоняет missing и неутверждённую SPDX license", () => {
    expect(assertApprovedSpdxLicense("MPL-2.0")).toBe("MPL-2.0");
    expect(() => assertApprovedSpdxLicense(undefined)).toThrow(
      "DEPENDENCY_LICENSE_MISSING",
    );
    expect(() => assertApprovedSpdxLicense("GPL-3.0-only")).toThrow(
      "DEPENDENCY_LICENSE_NOT_APPROVED:GPL-3.0-only",
    );
  });

  it(
    "публикует SPDX licenses и покрывающий SBOM sanitized notices artifact",
    async () => {
      const outputRoot = await mkdtemp(join(tmpdir(), "cmc-package-licenses-"));
      try {
        await execFileAsync(
          process.execPath,
          ["scripts/package-release.mjs", "--output-dir", outputRoot],
          {
            cwd: repositoryRoot,
            env: { ...process.env, NODE_ENV: "production" },
            maxBuffer: 32 * 1024 * 1024,
          },
        );
        const entries = readTarEntries(
          await readFile(join(outputRoot, "codex-mac-cleaner-v0.1.0-beta.9.tar")),
        );
        for (const requiredEntry of [
          "skills/codex-mac-cleaner/SKILL.md",
          "skills/codex-mac-cleaner-update/SKILL.md",
          "scripts/codex-mac-cleaner-update.mjs",
        ]) {
          expect(entries.has(requiredEntry), requiredEntry).toBe(true);
        }
        expect(
          JSON.parse(
            entries.get(".codex-plugin/plugin.json")!.toString("utf8"),
          ),
        ).toMatchObject({ name: "codex-mac-cleaner", version: "0.1.0-beta.9" });
        const noticesName = "docs/release/third-party-notices.json";
        const allowlist = JSON.parse(
          await readFile(
            resolve(repositoryRoot, ".codex-plugin/package-allowlist.json"),
            "utf8",
          ),
        ) as { files: string[] };
        expect(allowlist.files).toContain(noticesName);
        expect(entries.has(noticesName)).toBe(true);
        expect(entries.get(".codex-plugin/package-allowlist.json")!.equals(
          await readFile(resolve(repositoryRoot, ".codex-plugin/package-allowlist.json")),
        )).toBe(true);
        expect(entries.get(noticesName)!.equals(
          await readFile(resolve(repositoryRoot, noticesName)),
        )).toBe(true);

        const sbom = JSON.parse(
          entries.get("release-evidence/sbom.cdx.json")!.toString("utf8"),
        ) as {
          components: Array<{
            "bom-ref": string;
            licenses?: Array<{ license?: { id?: string } }>;
          }>;
        };
        for (const component of sbom.components) {
          expect(component.licenses, component["bom-ref"]).toHaveLength(1);
          expect(
            approvedLicenses.has(component.licenses?.[0]?.license?.id ?? ""),
            component["bom-ref"],
          ).toBe(true);
        }

        const noticesText = entries.get(noticesName)!.toString("utf8");
        const notices = JSON.parse(noticesText) as {
          components: Array<{
            bomRef: string;
            license: string;
            noticeIds: string[];
          }>;
          notices: Array<{ id: string; text: string }>;
        };
        expect(notices.components.map(({ bomRef }) => bomRef).sort()).toEqual(
          sbom.components.map((component) => component["bom-ref"]).sort(),
        );
        const noticeIds = new Set(notices.notices.map(({ id }) => id));
        for (const component of notices.components) {
          expect(approvedLicenses.has(component.license), component.bomRef).toBe(true);
          expect(component.noticeIds.length, component.bomRef).toBeGreaterThan(0);
          expect(
            component.noticeIds.every((noticeId) => noticeIds.has(noticeId)),
            component.bomRef,
          ).toBe(true);
        }
        expect(noticesText).not.toMatch(
          /\/Users\/|\/home\/|[A-Za-z]:\\Users\\|(?:^|["\s])node_modules\//u,
        );
      } finally {
        await rm(outputRoot, { recursive: true, force: true });
      }
    },
    120_000,
  );

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
    const fileContents = await Promise.all(
      contract.files.map(async (path) => ({
        path,
        text: await readFile(resolve(repositoryRoot, path), "utf8"),
      })),
    );
    const payload = fileContents.map(({ text }) => text).join("\n");
    const codePayload = fileContents
      .filter(({ path }) => path !== "docs/release/third-party-notices.json")
      .map(({ text }) => text)
      .join("\n");
    expect(payload).not.toMatch(/\/Users\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/u);
    expect(codePayload).not.toMatch(
      /\blaunchctl\b|\bcrontab\b|node-cron|cron-parser|node-schedule/iu,
    );
    expect(codePayload).not.toMatch(/XMLHttpRequest|WebSocket|EventSource|telemetry/iu);
    expect(payload).not.toMatch(/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|\bghp_[A-Za-z0-9]{20,}/u);
    expect(contract.files).not.toContain(expect.stringMatching(/\.map$|\/(?:state|history|inventory)\//iu));
    expect(
      contract.files.filter((path) => path.endsWith(".json")),
    ).toEqual([
      ".codex-plugin/plugin.json",
      ".codex-plugin/package-allowlist.json",
      ".mcp.json",
      "docs/release/third-party-notices.json",
    ]);
  });
});

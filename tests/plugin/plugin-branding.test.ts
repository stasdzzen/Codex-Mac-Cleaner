import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const pluginIconPath = resolve(
  repositoryRoot,
  "assets/icon.png",
);

function readPngMetadata(png: Buffer): {
  width: number;
  height: number;
  colorType: number;
} {
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png.readUInt8(25),
  };
}

describe("CMC-38: единый знак плагина", () => {
  it("публикует квадратный прозрачный PNG через plugin manifest и package allowlist", async () => {
    const [icon, manifestSource, allowlistSource] = await Promise.all([
      readFile(pluginIconPath),
      readFile(resolve(repositoryRoot, ".codex-plugin/plugin.json"), "utf8"),
      readFile(
        resolve(repositoryRoot, ".codex-plugin/package-allowlist.json"),
        "utf8",
      ),
    ]);
    const manifest = JSON.parse(manifestSource) as {
      interface: Record<string, unknown>;
    };
    const allowlist = JSON.parse(allowlistSource) as { files: string[] };

    expect(readPngMetadata(icon)).toEqual({
      width: 512,
      height: 512,
      colorType: 6,
    });
    expect(manifest.interface).toMatchObject({
      brandColor: "#1E9DF1",
      composerIcon: "./assets/icon.png",
      logo: "./assets/icon.png",
      logoDark: "./assets/icon.png",
    });
    expect(allowlist.files).toContain("assets/icon.png");
  });

  it("показывает тот же знак в Dashboard и README без внешнего ресурса", async () => {
    const [dashboardSource, packagedDashboard, readme] = await Promise.all([
      readFile(
        resolve(
          repositoryRoot,
          "apps/widget/src/components/audit-dashboard.tsx",
        ),
        "utf8",
      ),
      readFile(
        resolve(repositoryRoot, ".codex-plugin/assets/dashboard-v4.html"),
        "utf8",
      ),
      readFile(resolve(repositoryRoot, "README.md"), "utf8"),
    ]);

    expect(dashboardSource).toContain(
      'import pluginIconUrl from "@/assets/codex-mac-cleaner-icon.png?inline";',
    );
    expect(dashboardSource).toContain('src={pluginIconUrl}');
    expect(packagedDashboard).toContain("data:image/png;base64,");
    expect(readme).toContain('src="assets/icon.png"');
  });
});

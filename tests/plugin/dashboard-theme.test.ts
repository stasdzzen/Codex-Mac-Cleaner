import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-38: визуальная тема Dashboard", () => {
  it("сохраняет переданные semantic tokens и тёмный режим по умолчанию", async () => {
    const [styles, html] = await Promise.all([
      readFile(resolve(repositoryRoot, "apps/widget/src/styles.css"), "utf8"),
      readFile(resolve(repositoryRoot, "apps/widget/dashboard-v2.html"), "utf8"),
    ]);

    for (const token of [
      "--background: oklch(1 0 0);",
      "--foreground: oklch(0.141 0.005 285.823);",
      "--primary: oklch(0.488 0.243 264.376);",
      "--chart-1: oklch(0.871 0.006 286.286);",
      "--sidebar-primary: oklch(0.546 0.245 262.881);",
      "--background: oklch(0.141 0.005 285.823);",
      "--primary: oklch(0.424 0.199 265.638);",
      "--destructive: oklch(0.704 0.191 22.216);",
      "--sidebar-primary: oklch(0.623 0.214 259.815);",
    ]) {
      expect(styles).toContain(token);
    }

    expect(styles).toContain("--color-chart-1: var(--chart-1);");
    expect(styles).toContain("--color-sidebar: var(--sidebar);");
    expect(html).toMatch(/<html[^>]*class="dark"/u);
    expect(html).toContain('<meta name="color-scheme" content="dark" />');
  });

  it("ограничивает motion и не добавляет внешние визуальные ресурсы", async () => {
    const styles = await readFile(
      resolve(repositoryRoot, "apps/widget/src/styles.css"),
      "utf8",
    );

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain('[data-audit-active="true"]');
    expect(styles).toContain(".storage-comparison-bar");
    expect(styles).not.toMatch(/@import\s+url|https?:\/\//u);
    expect(styles).not.toContain("dark:");
  });
});

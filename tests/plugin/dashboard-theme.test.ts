import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-38: тема shadcn на Base UI", () => {
  it("использует пресет Base Mira, тему владельца и тёмный режим по умолчанию", async () => {
    const [styles, html, components] = await Promise.all([
      readFile(resolve(repositoryRoot, "apps/widget/src/styles.css"), "utf8"),
      readFile(resolve(repositoryRoot, "apps/widget/dashboard-v2.html"), "utf8"),
      readFile(resolve(repositoryRoot, "apps/widget/components.json"), "utf8"),
    ]);

    for (const token of [
      "--background: oklch(1 0 0);",
      "--foreground: oklch(0.141 0.005 285.823);",
      "--card: oklch(1 0 0);",
      "--primary: oklch(0.488 0.243 264.376);",
      "--chart-1: oklch(0.809 0.105 251.813);",
      "--chart-5: oklch(0.424 0.199 265.638);",
      "--radius: 0.625rem;",
      "--background: oklch(0.141 0.005 285.823);",
      "--foreground: oklch(0.985 0 0);",
      "--card: oklch(0.21 0.006 285.885);",
      "--primary: oklch(0.424 0.199 265.638);",
      "--destructive: oklch(0.704 0.191 22.216);",
    ]) {
      expect(styles).toContain(token);
    }

    expect(components).toContain('"style": "base-mira"');
    expect(styles).toContain("--color-chart-1: var(--chart-1);");
    expect(styles).toContain("--color-sidebar: var(--sidebar);");
    expect(styles).toContain("--radius-lg: var(--radius);");
    expect(styles).toContain("--font-heading: var(--font-sans);");
    expect(styles).toContain("@custom-variant dark");
    expect(styles).not.toContain("--color-font-sans:");
    expect(styles).not.toContain("--color-radius:");
    expect(styles).not.toContain("--color-shadow-color:");
    expect(styles).not.toContain("--shadow-color:");
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

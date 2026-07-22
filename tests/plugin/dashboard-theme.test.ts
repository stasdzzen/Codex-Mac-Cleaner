import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-38: визуальная тема Dashboard", () => {
  it("сохраняет актуальные semantic tokens владельца и тёмный режим по умолчанию", async () => {
    const [styles, html] = await Promise.all([
      readFile(resolve(repositoryRoot, "apps/widget/src/styles.css"), "utf8"),
      readFile(resolve(repositoryRoot, "apps/widget/dashboard-v2.html"), "utf8"),
    ]);

    for (const token of [
      "--background: #ffffff;",
      "--foreground: #0f1419;",
      "--card: #f7f8f8;",
      "--primary: #1e9df1;",
      "--chart-2: #00b87a;",
      "--chart-5: #e0245e;",
      "--radius: 1.3rem;",
      "--font-sans: Open Sans, sans-serif;",
      "--shadow-color: rgba(29,161,242,0.15);",
      "--background: #000000;",
      "--foreground: #e7e9ea;",
      "--card: #17181c;",
      "--primary: #1c9cf0;",
      "--destructive: #f4212e;",
      "--shadow-color: rgba(29,161,242,0.25);",
    ]) {
      expect(styles).toContain(token);
    }

    expect(styles).toContain("--color-chart-1: var(--chart-1);");
    expect(styles).toContain("--color-sidebar: var(--sidebar);");
    expect(styles).toContain("--radius-lg: var(--radius);");
    expect(styles).toContain("--shadow-sm:");
    expect(styles).not.toContain("--color-font-sans:");
    expect(styles).not.toContain("--color-radius:");
    expect(styles).not.toContain("--color-shadow-color:");
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

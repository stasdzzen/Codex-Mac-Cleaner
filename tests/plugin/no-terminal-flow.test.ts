import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-10: clean-room/new-task no-terminal contract", () => {
  it("Skill запускает audit/dashboard и оставляет решения app buttons", async () => {
    const skill = await readFile(
      resolve(repositoryRoot, "skills/codex-mac-cleaner/SKILL.md"),
      "utf8",
    );
    expect(skill).toMatch(/audit_start[\s\S]*application_remnants/iu);
    expect(skill).toMatch(/dashboard_open/iu);
    expect(skill).toMatch(/кноп|клик/iu);
    expect(skill).not.toMatch(/```(?:bash|sh|zsh|shell)|\bsudo\b|\brm\s+-|launchctl/iu);
    expect(skill).not.toMatch(
      /quarantine_(?:prepare|move|restore|purge)|exclusion_(?:create|remove|reset)|schedule_request/iu,
    );
  });

  it("Dashboard содержит button-only move/exclude/skip/restore/purge и manual audit", async () => {
    const sources = await Promise.all(
      [
        "apps/widget/src/components/audit-dashboard.tsx",
        "apps/widget/src/components/action-dialog.tsx",
        "apps/widget/src/components/quarantine-center.tsx",
      ].map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
    );
    const source = sources.join("\n");
    for (const label of [
      "В карантин",
      "Исключить",
      "Пропустить сейчас",
      "Восстановить",
      "Удалить навсегда",
      "Проверить сейчас",
    ]) {
      expect(source).toContain(label);
    }
    for (const tool of [
      "quarantine_prepare_move",
      "quarantine_move",
      "exclusion_create",
      "audit_start",
    ]) {
      expect(source).toContain(tool);
    }
    expect(source).toContain("`quarantine_prepare_${action}`");
    expect(source).toContain("`quarantine_${action}`");
    expect(source).toContain('action="restore"');
    expect(source).toContain('action="purge"');
    const skipBody = source.slice(
      source.indexOf("function skipFinding"),
      source.indexOf("async function cancelAudit"),
    );
    expect(skipBody).not.toContain("callTool");
    expect(source).not.toMatch(/```(?:bash|sh|zsh|shell)|\bsudo\b|\brm\s+-|launchctl/iu);
  });
});

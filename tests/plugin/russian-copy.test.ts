import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

describe("CMC-40: понятные русские тексты", () => {
  it("показывает русское имя разработчика и русское описание плагина", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(repositoryRoot, ".codex-plugin/plugin.json"), "utf8"),
    ) as {
      author: { name: string };
      description: string;
      interface: {
        shortDescription: string;
        longDescription: string;
        developerName: string;
        category: string;
        capabilities: string[];
      };
    };

    expect(manifest.author.name).toBe("Участники проекта Codex Mac Cleaner");
    expect(manifest.interface.developerName).toBe(
      "Участники проекта Codex Mac Cleaner",
    );
    expect(manifest.description).toMatch(/[А-Яа-яЁё]/u);
    expect(manifest.interface.shortDescription).toMatch(/[А-Яа-яЁё]/u);
    expect(manifest.interface.longDescription).toMatch(/[А-Яа-яЁё]/u);

    // Эти значения принадлежат машинной схеме Codex и не переводятся.
    expect(manifest.interface.category).toBe("Productivity");
    expect(manifest.interface.capabilities).toEqual(["Interactive", "Read", "Write"]);
  });

  it("использует единые понятные действия в окне проверки", async () => {
    const source = (
      await Promise.all(
        [
          "apps/widget/src/components/audit-dashboard.tsx",
          "apps/widget/src/components/action-dialog.tsx",
          "apps/widget/src/components/quarantine-center.tsx",
        ].map((path) => readFile(resolve(repositoryRoot, path), "utf8")),
      )
    ).join("\n");

    for (const label of [
      "Оставить",
      "В карантин",
      "Восстановить",
      "Удалить навсегда",
      "Оставленные",
    ]) {
      expect(source).toContain(label);
    }
    expect(source).not.toContain(">Исключить<");
    expect(source).not.toContain("Краткая сводка находок");
    expect(source).not.toContain("Состояние действия");
  });

  it("объясняет установку, запуск и обновление без необъяснённого жаргона", async () => {
    const readme = await readFile(resolve(repositoryRoot, "README.md"), "utf8");

    for (const heading of [
      "## Что делает плагин",
      "## Требования",
      "## Установка",
      "## Как запустить",
      "## Как обновить предыдущую версию",
      "## Как устроена безопасность",
      "## Ограничения предварительной версии",
    ]) {
      expect(readme).toContain(heading);
    }
    expect(readme).toContain("процессором Apple M1 или новее");
    expect(readme).toContain("файловая система macOS");
    expect(readme).not.toContain("Удалять marketplace");
    expect(readme).not.toContain("пользовательскую папку Library");
  });

  it("показывает понятные русские названия инструментов и окна проверки", async () => {
    const [server, resource, quarantine] = await Promise.all([
      readFile(resolve(repositoryRoot, "apps/mcp-server/src/server.ts"), "utf8"),
      readFile(
        resolve(repositoryRoot, "apps/mcp-server/src/resources/dashboard.ts"),
        "utf8",
      ),
      readFile(
        resolve(repositoryRoot, "apps/mcp-server/src/tools/quarantine.ts"),
        "utf8",
      ),
    ]);

    expect(server).toContain('title: "Начать проверку"');
    expect(server).toContain('title: "Открыть окно проверки"');
    expect(server).toContain('title: "Оставить объект"');
    expect(resource).toContain('title: "Codex Mac Cleaner — проверка Mac"');
    expect(quarantine).toContain("Повторно проверяет один объект");
    expect(`${server}\n${resource}`).not.toContain('title: "Открыть Dashboard"');
    expect(`${server}\n${resource}`).not.toContain("Audit Dashboard");
  });

  it("оставляет публичные формы GitHub русскими", async () => {
    const paths = [
      ".github/ISSUE_TEMPLATE/bug.yml",
      ".github/ISSUE_TEMPLATE/feature.yml",
      ".github/pull_request_template.md",
      "SUPPORT.md",
      "SECURITY.md",
    ];
    const payload = (
      await Promise.all(paths.map((path) => readFile(resolve(repositoryRoot, path), "utf8")))
    ).join("\n");

    expect(payload).toContain("[ОШИБКА]");
    expect(payload).toContain("[ПРЕДЛОЖЕНИЕ]");
    expect(payload).toContain("## Правила безопасности");
    expect(payload).not.toMatch(/\b(?:secrets|tokens|app inventory|environment dump)\b/iu);
  });
});

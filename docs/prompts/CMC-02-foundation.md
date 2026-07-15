---
type: Worker Prompt
title: Промпт CMC-02 — foundation и platform guard
description: Готовый вход Worker для workspace и ограничения macOS 26 arm64.
tags: [prompt, worker, foundation, cmc-02]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker в репозитории stasdzzen/Codex-Mac-Cleaner. Выполни только Issue CMC-02. Одна Issue = один worktree = одна ветка = один PR. Не запускай другие задачи и не выполняй merge.

Прочитай AGENTS.md, docs/decisions/ADR-0001-target-platform.md, docs/decisions/ADR-0002-typescript-runtime.md, docs/quality/acceptance-gates.md и раздел CMC-02 пошагового плана. Проверь, что dependency CMC-01 закрыта и текущий base совпадает с origin/main. Затем валидируй Issue через issue_contract.py.

Создай pnpm workspace на Node 24 LTS и TypeScript 7 с точными версиями из плана. Реализуй чистую функцию platform guard, которая принимает входные значения и до любых scanner calls отклоняет не-darwin, не-arm64 и macOS ниже 26. Не добавляй Swift, Electron, runtime network или продуктовые функции.

Следуй TDD: сначала падающий тест, затем минимальная реализация, затем полный pnpm check. Не ослабляй engine range и не заменяй pinned versions без отдельного аргументированного PR finding.

Открой PR и передай русскоязычный отчёт: Issue/PR, ветка/SHA, файлы, фактические команды и результаты, незавершённые gates. Не проверяй собственный PR.
```

---
type: Worker Prompt
title: Промпт CMC-18 — синхронизация lockfile scope
description: Готовый вход Worker для согласования цепочки зависимостей и области изменений CMC-03 с pnpm lockfile.
tags: [prompt, worker, governance, lockfile, cmc-18]
status: approved
owner: Architect
date: 2026-07-18
---

# Готовый промпт

```text
Ты Worker для одной GitHub Issue CMC-18 / #23 в stasdzzen/Codex-Mac-Cleaner. Работай только в назначенном worktree и одной ветке; не реализуй CMC-03, не координируй другие Issues, не выполняй merge, release или публикацию.

Создай полное двуязычное зеркало Issue #23 в .github/issue-specs/CMC-18.md. В локальном контракте CMC-03 сохрани существующие runtime paths и safety-ограничения, добавив только dependency #23 и корневой `pnpm-lock.yaml`. Синхронизируй roadmap, критический путь, промпт CMC-03, индекс промптов и журнал. Не меняй live Issue #3: после merge её синхронизирует Controller.

Не меняй `pnpm-lock.yaml`, package-файлы, runtime-код, архитектуру, ADR или safety-канон. До редактирования зафиксируй RED: план CMC-03 требует Zod, MCP SDK и commit lockfile, но текущий touched_paths не разрешает `pnpm-lock.yaml`.

На финальном head запусти repository validator, unit tests repository policy и `git diff --check`. Отдельно сравни `git diff --name-only origin/main...HEAD` с touched_paths Issue #23. Открой один ready-for-review PR с закрытием #23, приложи фактические проверки и укажи незавершённый gate синхронизации live Issue #3 Controller после merge. Поставь #23 в `cto:review` и остановись.
```

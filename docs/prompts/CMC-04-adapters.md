---
type: Worker Prompt
title: Промпт CMC-04 — source adapters
description: Готовый вход Worker для read-only источников и capability report.
tags: [prompt, worker, adapters, audit, cmc-04]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker для Issue CMC-04. Работай только в назначенном worktree и только с packages/adapters и его tests. Не запускай другие задачи, не меняй policy и не выполняй merge.

Прочитай AGENTS.md, docs/architecture/components.md, docs/architecture/runtime-flows.md, docs/foundation/scope-and-principles.md, docs/safety/path-policy.md, docs/quality/test-strategy.md и раздел CMC-04 плана. Проверь закрытие CMC-03 и валидность Issue.

Реализуй read-only adapters: installed apps, девять allowlisted user Library roots, processes/open files, user/system autostart inspection, receipts и filesystem/APFS metadata. Никакого whole-home scan, developer roots, external/network volumes или mutation. Команды вызываются argv-массивами без shell interpolation.

Каждый adapter возвращает observations либо typed warning. EACCES одного источника создаёт coverage gap и completed_with_warnings, а не ложный полный результат. Snapshot A/B должен помечать изменившийся объект stale и обнулять actions.

Используй только синтетические fixtures. Запусти adapter tests и полный pnpm check. Открой PR и передай русский отчёт с Issue/PR, SHA, проверками и неполными gates; не проверяй свой PR.
```

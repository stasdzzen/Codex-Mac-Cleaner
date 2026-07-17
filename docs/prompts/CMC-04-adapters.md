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

Прочитай AGENTS.md, docs/architecture/components.md, docs/architecture/runtime-flows.md, docs/foundation/scope-and-principles.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/decisions/ADR-0010-field-research-safety-contract.md, docs/safety/path-policy.md, docs/quality/test-strategy.md и раздел CMC-04 плана. Проверь закрытие CMC-03 и валидность Issue.

Реализуй read-only adapters: installed apps, девять allowlisted user Library roots, processes/open files, user autostart, targeted system/shared inspection, receipts и filesystem/APFS metadata. Candidate scan не перечисляет `~/APPS`, `~/.codex`, developer roots, external/network volumes и локальные Git-проекты. JSON/YAML/plist преобразуются в `SafeMetadata` до persistence; raw keys/values, passwords, tokens и subscription URLs не выходят из parser boundary. System LaunchAgents/Daemons/helpers/receipts дают только `unsupported_manual` без mutation, shell-команд или sudo. Каждый adapter принимает общий `AbortSignal`; команды вызываются argv-массивами без shell interpolation.

Каждый adapter возвращает observations либо typed warning. EACCES одного источника создаёт coverage gap и completed_with_warnings, а не ложный полный результат. Snapshot A/B должен помечать изменившийся объект stale и обнулять actions. Отмена закрывает writers, создаёт ровно один terminal state `cancelled` и сохраняет read-only частичный отчёт с пустыми `allowedActions`. Повторная отмена и гонка с уже достигнутым terminal state идемпотентны.

Используй только синтетический field pack: remnants, caches, personal/sensitive data и system/shared cases. Реальные paths, app inventory, bundle IDs, config values и секреты владельца запрещены. Сначала напиши protected-root, redaction, inspection-only, cancellation и empty-actions tests, затем реализацию. Запусти adapter tests и полный pnpm check. Открой PR и передай русский отчёт с Issue/PR, SHA, проверками и неполными gates; не проверяй свой PR.
```

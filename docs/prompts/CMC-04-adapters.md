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

Прочитай AGENTS.md, docs/architecture/components.md, docs/architecture/runtime-flows.md, docs/foundation/scope-and-principles.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/safety/path-policy.md, docs/quality/test-strategy.md и раздел CMC-04 плана. Проверь закрытие CMC-03 и валидность Issue.

Реализуй read-only adapters: installed apps, девять allowlisted user Library roots, processes/open files/TCP evidence, user login/background/launch items и missing executable, protected container metadata, official uninstallers, stale receipts, targeted system/shared inspection и filesystem/APFS/Time Machine observations. Candidate scan не перечисляет `~/.codex`, current project root, plugin state, universal protected classes, developer/external/network areas и локальные Git-проекты. JSON/YAML/plist преобразуются в `SafeMetadata`. System/relocated/helper/daemon/framework/printer/VPN/service cases дают только `unsupported_manual` или capability gap без mutation, shell-команд, `sudo` и TCC bypass. Каждый adapter принимает общий `AbortSignal`; команды вызываются argv-массивами без shell interpolation.

Каждый adapter возвращает observations либо typed warning. EACCES одного источника создаёт coverage gap и completed_with_warnings, а не ложный полный результат. Snapshot A/B должен помечать изменившийся объект stale и обнулять actions. Отмена закрывает writers, создаёт ровно один terminal state `cancelled` и сохраняет read-only частичный отчёт с пустыми `allowedActions`. Повторная отмена и гонка с уже достигнутым terminal state идемпотентны.

Используй только синтетический public field pack: remnants, caches, personal/sensitive data, missing target, uninstaller, stale receipt, protected metadata и system/shared cases. Username, реальные paths, app inventory, bundle/signing IDs, config values и секреты владельца запрещены. Сначала напиши protected-root, redaction, inspection-only, cancellation и empty-actions tests, затем реализацию. Запусти adapter tests и полный pnpm check. Открой PR и передай русский отчёт с Issue/PR, SHA, проверками и неполными gates; не проверяй свой PR.
```

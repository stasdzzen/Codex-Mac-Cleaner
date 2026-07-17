---
type: Worker Prompt
title: Промпт CMC-08 — Audit Dashboard
description: Готовый вход Worker для автономного тёмного React widget на shadcn/ui.
tags: [prompt, worker, ui, shadcn, cmc-08]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker Issue CMC-08. Работай только в apps/widget и его tests. Не меняй server policy, quarantine implementation, plugin manifests и не выполняй merge.

Прочитай AGENTS.md, docs/architecture/components.md, docs/contracts/mcp-tools.md, docs/foundation/terminology.md, docs/decisions/ADR-0006-dark-shadcn-dashboard.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/quality/test-strategy.md и CMC-08 пошагового плана. Dependency CMC-05 должна быть закрыта; валидируй Issue.

Собери автономный тёмный Audit Dashboard на React/Vite и локальных shadcn components: Card, Progress, Table, Badge, Sheet, Alert, AlertDialog, Skeleton, Tabs, Button, Tooltip и sonner. Используй semantic tokens, не raw colors, не CDN и не ручные dark overrides. Dashboard имеет пять вкладок: «Обзор», «Находки», «Карантин», «Исключения», «Расписание»; behavior последних двух добавляют CMC-12/13, до этого они показывают честное dependency state.

Работай через frozen synthetic field fixtures. UI показывает `FindingFacts`, `ReclaimEstimate`, coverage, `supportLevel`, label, confidence, risk, evidence и blocking reason текстом. `allowedActions`, `StorageSummary` и `DiskObservation` приходят с сервера; UI не вычисляет policy, размеры или free-space delta. Actionable finding имеет «Удалить», «Исключить» и «Пропустить сейчас»: skip меняет только `skippedFindingIds`, exclude делегируется будущему CMC-12, delete открывает подтверждение quarantine одного объекта с точными последствиями. `unsupported_manual` показывает «Требует расширенного режима» без mutation/shell. Поддержи `cancelling`/`cancelled`. В Quarantine Center только поэлементные «Восстановить» и «Удалить навсегда», без bulk/auto purge. Widget state не содержит path/token/policy. Старый `stateVersion` отбрасывается.

Сначала Testing Library tests для пяти вкладок, отмены, «Пропустить сейчас» без tool call, FindingFacts, support levels, пяти показателей, отсутствия shell/bulk, поэлементных кнопок и keyboard/focus поведения; затем реализация и автономная Vite build. Запусти widget tests/build и pnpm check. Открой PR; отчёт на русском с Issue/PR, SHA и фактическими результатами. Не выполняй визуальный manual smoke без отдельного факта.
```

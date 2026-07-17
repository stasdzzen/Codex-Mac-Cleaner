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

Прочитай AGENTS.md, docs/architecture/components.md, docs/contracts/mcp-tools.md, docs/foundation/terminology.md, docs/decisions/ADR-0006-dark-shadcn-dashboard.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/decisions/ADR-0010-field-research-safety-contract.md, docs/quality/test-strategy.md и CMC-08 пошагового плана. Dependency CMC-05 должна быть закрыта; валидируй Issue.

Собери автономный тёмный Audit Dashboard на React/Vite и локальных shadcn components: Card, Progress, Table, Badge, Sheet, Alert, AlertDialog, Skeleton, Tabs, Button, Tooltip и sonner. Используй semantic tokens, не raw colors, не CDN и не ручные dark overrides. Dashboard имеет ровно три вкладки: «Обзор», «Находки», «Карантин».

Работай через frozen synthetic field fixtures. UI показывает coverage, `supportLevel`, label, confidence, risk, evidence и blocking reason текстом. `allowedActions`, `StorageSummary` и `DiskObservation` приходят с сервера; UI не вычисляет policy, размеры или free-space delta. Покажи пять labels: «Логический размер находок», «Физический размер находок», «В карантине», «Удалено навсегда», «Свободно на диске» с временем наблюдения. Actionable finding имеет «Оставить» и «Переместить в карантин»: «Оставить» только добавляет findingId в session-local `reviewedFindingIds`, не вызывает tool и сбрасывается при новом аудите. `unsupported_manual` не показывает mutation или shell-команду. Поддержи `cancelling`/`cancelled` и точный Alert. В Quarantine Center только поэлементные «Восстановить» и «Удалить навсегда», без bulk/auto purge. Widget state не содержит path/token/policy. Старый `stateVersion` отбрасывается.

Сначала Testing Library tests для вкладок, отмены, «Оставить» без tool call, support levels, пяти показателей, отсутствия shell/bulk, поэлементных кнопок и keyboard/focus поведения; затем реализация и автономная Vite build. Запусти widget tests/build и pnpm check. Открой PR; отчёт на русском с Issue/PR, SHA и фактическими результатами. Не выполняй визуальный manual smoke без отдельного факта.
```

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

Прочитай AGENTS.md, docs/architecture/components.md, docs/contracts/mcp-tools.md, docs/foundation/terminology.md, docs/decisions/ADR-0006-dark-shadcn-dashboard.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/quality/test-strategy.md и CMC-08 пошагового плана. Dependency CMC-05 должна быть закрыта; валидируй Issue.

Собери автономный тёмный Audit Dashboard на React/Vite и локальных shadcn components: Card, Progress, Table, Badge, Sheet, Alert, AlertDialog, Skeleton, Tabs, Button, Tooltip и sonner. Используй semantic tokens, не raw colors, не CDN и не ручные dark overrides. Dashboard имеет ровно три вкладки: «Обзор», «Находки», «Карантин».

Работай через frozen fixtures. UI показывает coverage, label, confidence, risk, evidence и blocking reason текстом. `allowedActions` и `StorageSummary` приходят с сервера; UI не вычисляет policy или размеры. Покажи «Найдено кандидатов», «В карантине» и «Удалено навсегда» без заявления точного изменения свободного места APFS. Поддержи `cancelling`/`cancelled`; частичный отменённый отчёт read-only, не предлагает «Переместить в карантин» и показывает точный `Alert`: «Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно. Начните новый аудит». В Quarantine Center у каждой записи есть «Восстановить» и «Удалить навсегда», но нет bulk selection, «Очистить всё» и автоматической очистки. Widget state хранит только активную вкладку, фильтр, selected row и panel, без path/token/policy. Старый `stateVersion` отбрасывается.

Сначала Testing Library tests для вкладок, отмены, пустых actions, поэлементных кнопок, отсутствия bulk-control и keyboard/focus поведения; затем реализация и автономная Vite build. Запусти widget tests/build и pnpm check. Открой PR; отчёт на русском с Issue/PR, SHA и фактическими результатами. Не выполняй визуальный manual smoke без отдельного факта.
```

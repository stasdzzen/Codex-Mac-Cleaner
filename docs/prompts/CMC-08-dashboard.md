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

Прочитай AGENTS.md, docs/architecture/components.md, docs/contracts/mcp-tools.md, docs/foundation/terminology.md, docs/decisions/ADR-0006-dark-shadcn-dashboard.md, docs/quality/test-strategy.md и CMC-08 пошагового плана. Dependency CMC-05 должна быть закрыта; валидируй Issue.

Собери автономный тёмный Audit Dashboard на React/Vite и локальных shadcn components: Card, Progress, Table, Badge, Sheet, Alert, AlertDialog, Skeleton, sonner. Используй semantic tokens, не raw colors, не CDN и не ручные dark overrides.

Работай через frozen fixtures. UI показывает coverage, label, confidence, risk, evidence и blocking reason текстом. allowedActions приходит с сервера; UI не вычисляет policy. Widget state хранит только фильтр, selected row и panel, без path/token/policy. Старый stateVersion отбрасывается.

Сначала Testing Library tests, затем реализация и автономная Vite build. Запусти widget tests/build и pnpm check. Открой PR; отчёт на русском с Issue/PR, SHA и фактическими результатами. Не выполняй визуальный manual smoke без отдельного факта.
```

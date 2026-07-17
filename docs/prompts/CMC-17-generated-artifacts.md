---
type: Worker Prompt
title: Промпт CMC-17 — generated artifacts workspace
description: Готовый вход Worker для безопасной подготовки Git ignore перед pnpm workspace.
tags: [prompt, worker, foundation, governance, cmc-17]
status: approved
owner: Architect
date: 2026-07-17
---

# Готовый промпт

```text
Ты Worker Issue CMC-17. Работай только в назначенном worktree и не реализуй CMC-02.

Добавь корневое правило node_modules/ в .gitignore, синхронизируй локальную Issue-спеку и live dependency CMC-02, roadmap и индекс промптов. Не создавай package.json, lockfile или generated artifacts.

Проверь root и nested `node_modules` через `git check-ignore --no-index node_modules/example packages/platform/node_modules/example`, затем запусти repository validator, unit tests и `git diff --check`. Открой один PR и остановись без merge, release или перехода к CMC-02.
```

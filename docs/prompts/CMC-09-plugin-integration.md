---
type: Worker Prompt
title: Промпт CMC-09 — MCP App и plugin integration
description: Готовый вход Worker для полного tool surface, UI resource и repository plugin package.
tags: [prompt, worker, mcp, plugin, cmc-09]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker Issue CMC-09. Работай только над интеграцией apps/mcp-server, .codex-plugin, .mcp.json, Skill и plugin contract tests. Не меняй core policy/quarantine без отдельного blocking finding и не выполняй merge/release.

Прочитай AGENTS.md, docs/contracts/mcp-tools.md, docs/architecture/components.md, docs/decisions/ADR-0007-github-distribution.md, docs/quality/acceptance-gates.md и раздел CMC-09 плана. CMC-07 и CMC-08 должны быть закрыты; Issue валидна.

Зарегистрируй model-visible audit tools и app-only mutation tools с точными schemas, annotations и _meta.ui.visibility. Ни один mutation input не содержит path/destination. dashboard_open отдаёт ui://codex-mac-cleaner/dashboard-v1.html; полный путь и detailed evidence доступны только widget _meta.

Создай .codex-plugin/plugin.json, local stdio .mcp.json и Skill, который объясняет scope, запускает только application_remnants и не вызывает app-only tools. Bundle автономен, сеть и telemetry отсутствуют.

Сначала visibility/schema/plugin tests, затем integration. Выполни pnpm check. Открой один PR и передай русский отчёт с Issue/PR, SHA, commands/results и незавершённым clean-room/manual smoke. Не проверяй свой PR.
```

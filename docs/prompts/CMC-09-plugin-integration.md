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

Прочитай AGENTS.md, docs/contracts/mcp-tools.md, docs/architecture/components.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/decisions/ADR-0010-field-research-safety-contract.md, docs/quality/acceptance-gates.md и раздел CMC-09 плана. CMC-07 и CMC-08 должны быть закрыты; Issue валидна.

Зарегистрируй семь model-visible tools и app-only cleanup mutation tools с точными schemas, annotations и `_meta.ui.visibility`. `audit_cancel` model-visible с точными annotations. Ни один cleanup mutation input не содержит path/destination. `dashboard_open` отдаёт `dashboard-v1.html`; model output получает `supportLevel`, safe metadata flags, blocking reason, расширенный `StorageSummary` и `DiskObservation`, но не raw config values, protected-scope details или полный путь. `unsupported_manual` не содержит mutation или готовой команды.

Создай `.codex-plugin/plugin.json`, local stdio `.mcp.json` и Skill, который объясняет scope, запускает только `application_remnants`, автоматически открывает Dashboard, может вызвать `audit_cancel` только по явному запросу пользователя и не вызывает app-only cleanup tools. Skill не выдаёт shell-команды и не просит отвечать «готово»; mutation начинается только после app-visible button click. Bundle автономен, сеть и telemetry отсутствуют.

Сначала visibility/schema/redaction/no-terminal/plugin tests, затем integration. Выполни pnpm check. Открой один PR и передай русский отчёт с Issue/PR, SHA, commands/results и незавершённым clean-room/manual smoke. Не проверяй свой PR.
```

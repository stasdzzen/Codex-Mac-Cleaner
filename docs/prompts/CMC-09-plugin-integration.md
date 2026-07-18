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
Ты существующий Worker Issue CMC-09/#9. Возобновляй работу только после merge CMC-21/#36 и только в прежних app-managed worktree, ветке `codex/issue-9-mcp-app-plugin` и PR #34; не создавай замену. Работай только над интеграцией apps/mcp-server, .codex-plugin, .mcp.json, Skill и plugin contract tests. Не меняй core policy/quarantine и не выполняй merge/release.

Прочитай AGENTS.md, docs/contracts/mcp-tools.md, docs/contracts/correlation-identity.md, docs/architecture/components.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/decisions/ADR-0012-server-owned-correlation-identity.md, docs/quality/acceptance-gates.md и раздел CMC-09 roadmap. CMC-07, CMC-08, CMC-12 и CMC-21/#36 должны быть merged; live #9 должна сохранять `cto:blocked` до явного возобновления владельцем/Controller.

До любых package/runtime изменений запусти `corepack pnpm install --frozen-lockfile`, сохрани checksum `pnpm-lock.yaml` перед командой и подтверди, что frozen installation его не изменила; изменение lockfile на этом шаге — fail-closed blocker. Если реализация меняет package manifest, workspace dependency или pinned dependency, обнови `pnpm-lock.yaml` осознанно, обязательно включи требуемое изменение в PR этой же Issue, затем снова запусти `corepack pnpm install --frozen-lockfile` и подтверди неизменность уже подготовленного lockfile после проверки.

Зарегистрируй канонические model-visible tools, app-only cleanup tools и exclusion tools с точными schemas, annotations и `_meta.ui.visibility`. Подключи core resolver CMC-21: candidate-specific installed/process/open-file/receipt/dependency facts не строятся по path/name/display-only match; `absent` принимается только с complete same-snapshot coverage, а ambiguity/missing/mismatch/partial остаются `unknown`. `audit_cancel` model-visible. Ни один mutation/exclusion input не содержит path/destination/identity fields. `dashboard_open` отдаёт `dashboard-v1.html`; model и widget получают только safe facts/actions и `excludedCount`, но не raw config/path, app inventory, bundle/package/signing identities, correlation graph или token material. `unsupported_manual` не содержит mutation или готовой команды. Добавь schedule intent tool skeleton, но не вызывай host-native automation: эту capability завершает CMC-13.

Создай `.codex-plugin/plugin.json`, local stdio `.mcp.json` и Skill, который объясняет scope, запускает только `application_remnants`, автоматически открывает Dashboard, может вызвать `audit_cancel` только по явному запросу пользователя и не вызывает app-only cleanup tools. Skill не выдаёт shell-команды и не просит отвечать «готово»; mutation начинается только после app-visible button click. Bundle автономен, сеть и telemetry отсутствуют. Package allowlist исключает username, home paths, app inventory, personal developer decisions и local state.

Сначала visibility/schema/redaction/no-terminal/plugin tests, затем integration. Обязателен packaged stdio synthetic E2E audit → correlation → prepare handle → move → restore и negative case incomplete coverage → `unknown` без action; реальный Mac не изменять. Выполни pnpm check. Обнови только существующий PR #34 и передай русский отчёт с Issue/PR, SHA, commands/results и незавершённым clean-room/manual smoke. Не проверяй свой PR.
```

---
type: Worker Prompt
title: Промпт CMC-09 — MCP App и plugin integration
description: Готовый вход Worker для полного tool surface, UI resource и repository plugin package.
tags: [prompt, worker, mcp, plugin, cmc-09]
status: approved
owner: Architect
date: 2026-07-19
---

# Готовый промпт

```text
Ты существующий Worker Issue CMC-09/#9. Возобновляй работу только после merge CMC-21/#36 и только в прежних app-managed worktree, ветке `codex/issue-9-mcp-app-plugin` и PR #34; не создавай замену. Работай только над интеграцией apps/mcp-server, .codex-plugin, .mcp.json, Skill и plugin contract tests. Не меняй core policy/quarantine и не выполняй merge/release.

Прочитай AGENTS.md, docs/contracts/mcp-tools.md, docs/contracts/correlation-identity.md, docs/architecture/components.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/decisions/ADR-0012-server-owned-correlation-identity.md, docs/decisions/ADR-0013-actionable-library-remnant-correlation.md, docs/decisions/ADR-0014-defer-host-automation-post-v01.md, docs/quality/acceptance-gates.md и раздел CMC-09 roadmap. CMC-07, CMC-08, CMC-12 и исправленная CMC-21/#36 должны быть merged; live #9 должна сохранять `cto:blocked` до явного возобновления владельцем/Controller.

До любых package/runtime изменений запусти `corepack pnpm install --frozen-lockfile`, сохрани checksum `pnpm-lock.yaml` перед командой и подтверди, что frozen installation его не изменила; изменение lockfile на этом шаге — fail-closed blocker. Если реализация меняет package manifest, workspace dependency или pinned dependency, обнови `pnpm-lock.yaml` осознанно, обязательно включи требуемое изменение в PR этой же Issue, затем снова запусти `corepack pnpm install --frozen-lockfile` и подтверди неизменность уже подготовленного lockfile после проверки.

Зарегистрируй канонические model-visible tools, app-only cleanup tools и exclusion tools с точными schemas, annotations и `_meta.ui.visibility`. Подключи исправленный core resolver CMC-21: widget/model получают safe `ownerBindingState`, раздельные artifact/owner states, receipt lifecycle и server-owned profile/applicability, но не могут выбирать profile или identity. `not_applicable` не показывается как `absent`; path/name/bundle-only match не создаёт owner binding. `audit_cancel` model-visible. Ни один mutation/exclusion input не содержит path/destination/identity/profile fields. `dashboard_open` отдаёт `dashboard-v1.html`; outputs не содержат raw config/path, app inventory, bundle/package/signing identities, historical bindings, correlation graph или token material. `unsupported_manual` не содержит mutation или готовой команды. Schedule intent tool skeleton остаётся инертным: вкладка честно disabled, предлагает обычный manual audit, `enabled=false`, automation ID отсутствует, успешного host outcome нет. Не вызывай host-native automation; post-v0.1 capability принадлежит заблокированной CMC-13.

Создай `.codex-plugin/plugin.json`, local stdio `.mcp.json` и Skill, который объясняет scope, запускает только `application_remnants`, автоматически открывает Dashboard, может вызвать `audit_cancel` только по явному запросу пользователя и не вызывает app-only cleanup tools. Skill не выдаёт shell-команды и не просит отвечать «готово»; mutation начинается только после app-visible button click. Bundle автономен, сеть и telemetry отсутствуют. Package allowlist исключает username, home paths, app inventory, personal developer decisions и local state.

Сначала visibility/schema/redaction/no-terminal/plugin tests, затем integration. Обязателен packaged stdio synthetic E2E на generated `~/Library/Caches|Logs` artifact: audit → authoritative binding/profile/coverage → prepare handle → move → restore; отдельно incomplete coverage и inspect-only categories не получают action. Реальный Mac не изменять. Выполни pnpm check. Обнови только существующий PR #34 и передай русский отчёт с Issue/PR, SHA, commands/results и незавершённым clean-room/manual smoke. Не проверяй свой PR.
```

```cto-issue
schema: 1
dependencies: #7, #8, #12
conflicts: none
touched_paths: apps/mcp-server/; .codex-plugin/; .mcp.json; skills/; tests/plugin/; pnpm-lock.yaml
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Integrate the complete public MCP App and repository marketplace plugin with a no-terminal product flow.

### Scope

Register canonical model-visible tools, app-only cleanup/exclusion tools and schedule-intent skeleton, safe finding/summary/disk outputs, the five-tab dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests and package allowlist from CMC-09.

### Acceptance criteria

Cleanup/exclusion tools are app-only and accept no paths or client identity fields. Mutation starts only after Delete confirmation for one object. Model output contains support level, safe flags and `excludedCount`, but no full paths, raw config, exclusion identities, personal inventory or protected details. Unsupported findings contain no mutation, shell or sudo guidance. The Skill starts only `application_remnants`, opens the Dashboard, never calls app-only cleanup tools and emits no shell command. Schedule tools only create/read/complete intents; MCP App does not call host-native automation. Package allowlist excludes local state, username, home paths, personal app names/decisions and real-Mac inventory.

### Verification

Run MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests and root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core safety weakening, merge or release.

## Русский

### Цель

Интегрировать полный публичный MCP App и repository marketplace plugin с продуктовым сценарием без терминала.

### Объём

Зарегистрировать канонические model-visible tools, app-only cleanup/exclusion tools и schedule-intent skeleton, безопасные finding/summary/disk outputs, пяти-вкладочный Dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests и package allowlist из CMC-09.

### Критерии приёмки

Cleanup/exclusion tools app-only и не принимают paths или client identity fields. Mutation начинается только после подтверждения «Удалить» для одного объекта. Model output содержит support level, safe flags и `excludedCount`, но не full paths, raw config, exclusion identities, personal inventory или protected details. Unsupported findings без mutation/shell/sudo. Skill запускает только `application_remnants`, открывает Dashboard, не вызывает app-only cleanup tools и не выдаёт shell-команду. Schedule tools только создают/читают/завершают intents; MCP App не вызывает host-native automation. Package allowlist исключает local state, username, home paths, personal app names/decisions и real-Mac inventory.

### Проверка

Запустить MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests и root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление core safety, merge и release.

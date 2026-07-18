```cto-issue
schema: 1
dependencies: #7, #8, #12, #36
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

Resume the existing Worker/worktree/branch/PR #34 after CMC-21 merges. Register canonical model-visible tools, app-only cleanup/exclusion tools and schedule-intent skeleton, wire the approved core correlation resolver, safe finding/summary/disk outputs, the five-tab dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests and package allowlist from CMC-09.

### Acceptance criteria

Cleanup/exclusion tools are app-only and accept no paths or client identity fields. Production candidate facts come from the CMC-21 resolver: no path/name/display-only resolution, and `absent` requires complete same-snapshot coverage. Widget/model outputs contain only safe facts/actions, support level, safe flags and `excludedCount`, but no full paths, raw config, app inventory, bundle/package/signing identities, correlation graph, tokens or protected details. Mutation starts only after Delete confirmation for one object. Unsupported findings contain no mutation, shell or sudo guidance. The Skill starts only `application_remnants`, opens the Dashboard, never calls app-only cleanup tools and emits no shell command. Schedule tools only create/read/complete intents; MCP App does not call host-native automation. Package allowlist excludes local state, username, home paths, personal app names/decisions and real-Mac inventory.

### Verification

Run MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests, and packaged stdio synthetic audit → correlation → prepare → move → restore plus incomplete-coverage fail-closed E2E, then root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core safety weakening, merge or release.

## Русский

### Цель

Интегрировать полный публичный MCP App и repository marketplace plugin с продуктовым сценарием без терминала.

### Объём

После merge CMC-21 возобновить существующие Worker/worktree/branch/PR #34. Зарегистрировать канонические model-visible tools, app-only cleanup/exclusion tools и schedule-intent skeleton, подключить утверждённый core correlation resolver, безопасные finding/summary/disk outputs, пяти-вкладочный Dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests и package allowlist из CMC-09.

### Критерии приёмки

Cleanup/exclusion tools app-only и не принимают paths или client identity fields. Production facts candidate получает из resolver CMC-21: path/name/display-only resolution запрещён, а `absent` требует complete same-snapshot coverage. Widget/model получают только safe facts/actions, support level, safe flags и `excludedCount`, но не full paths, raw config, app inventory, bundle/package/signing identities, correlation graph, tokens или protected details. Mutation начинается только после подтверждения «Удалить» для одного объекта. Unsupported findings без mutation/shell/sudo. Skill запускает только `application_remnants`, открывает Dashboard, не вызывает app-only cleanup tools и не выдаёт shell-команду. Schedule tools только создают/читают/завершают intents; MCP App не вызывает host-native automation. Package allowlist исключает local state, username, home paths, personal app names/decisions и real-Mac inventory.

### Проверка

Запустить MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests, packaged stdio synthetic E2E audit → correlation → prepare → move → restore и fail-closed incomplete coverage, затем root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление core safety, merge и release.

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

Resume the existing Worker/worktree/branch/PR #34 after the ADR-0013-corrected CMC-21 merges. Register canonical model-visible tools, app-only cleanup/exclusion tools and schedule-intent skeleton, wire the approved core correlation resolver, safe finding/summary/disk outputs, the five-tab dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests and package allowlist from CMC-09.

### Acceptance criteria

Cleanup/exclusion tools are app-only and accept no paths, client identity, profile or applicability fields. Production candidate facts come from the corrected CMC-21 resolver: Library artifact and owner are separate, only authoritative binding is actionable, and `not_applicable` is not `absent`. Widget/model outputs contain only safe owner/profile/fact/action summaries, support level, safe flags and `excludedCount`, but no full paths, raw config, app inventory, bundle/package/signing identities, historical bindings, correlation graph, tokens or protected details. Mutation starts only after one-object “Move to quarantine” confirmation and only for the v0.1 private regenerable cache/log profile. Unsupported and inspect-only findings contain no mutation, shell or sudo guidance. The Skill starts only `application_remnants`, opens the Dashboard, never calls app-only cleanup tools and emits no shell command. Schedule tools only create/read/complete intents; MCP App does not call host-native automation. Package allowlist excludes local state, username, home paths, personal app names/decisions and real-Mac inventory.

### Verification

Run MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests, and packaged stdio E2E using a generated user-Library cache/log: audit → authoritative binding/profile/coverage → prepare → move → restore, plus incomplete-coverage and inspect-only fail-closed cases, then root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core safety weakening, merge or release.

## Русский

### Цель

Интегрировать полный публичный MCP App и repository marketplace plugin с продуктовым сценарием без терминала.

### Объём

После merge исправленной по ADR-0013 CMC-21 возобновить существующие Worker/worktree/branch/PR #34. Зарегистрировать канонические model-visible tools, app-only cleanup/exclusion tools и schedule-intent skeleton, подключить утверждённый core correlation resolver, безопасные finding/summary/disk outputs, пяти-вкладочный Dashboard resource, public plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests и package allowlist из CMC-09.

### Критерии приёмки

Cleanup/exclusion tools app-only и не принимают paths, client identity, profile или applicability fields. Production facts приходят из исправленного CMC-21: Library artifact и owner раздельны, только authoritative binding actionable, а `not_applicable` не является `absent`. Widget/model получают только safe owner/profile/fact/action summaries, support level, safe flags и `excludedCount`, но не full paths, raw config, app inventory, bundle/package/signing identities, historical bindings, correlation graph, tokens или protected details. Mutation начинается только после подтверждения «Переместить в карантин» для одного объекта и только для приватного регенерируемого cache/log profile v0.1. Unsupported и inspect-only findings без mutation/shell/sudo. Skill запускает только `application_remnants`, открывает Dashboard, не вызывает app-only cleanup tools и не выдаёт shell-команду. Schedule tools только создают/читают/завершают intents; MCP App не вызывает host-native automation. Package allowlist исключает local state, username, home paths, personal app names/decisions и real-Mac inventory.

### Проверка

Запустить MCP schema/visibility/redaction/exclusion/schedule-intent tests, no-terminal Skill tests, public package privacy/plugin contract tests и packaged stdio E2E на generated user-Library cache/log: audit → authoritative binding/profile/coverage → prepare → move → restore; отдельно incomplete coverage и inspect-only cases fail closed. Затем root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление core safety, merge и release.

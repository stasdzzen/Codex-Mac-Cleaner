```cto-issue
schema: 1
dependencies: #7, #8
conflicts: none
touched_paths: apps/mcp-server/; .codex-plugin/; .mcp.json; skills/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Integrate the complete MCP App and a repository marketplace plugin with a no-terminal product flow.

### Scope

Register seven model-visible tools, app-only cleanup tools, safe finding/summary/disk outputs, the versioned dashboard resource, plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests and package entries from CMC-09.

### Acceptance criteria

Cleanup tools are app-only and accept no paths. Mutation starts only after an app-visible button click. `audit_cancel` keeps the exact canonical annotations. Model output contains support level and safe flags but no full paths, raw config values, secrets or protected-scope details. Unsupported findings contain no mutation, shell or sudo guidance. Dashboard receives extended `StorageSummary` and `DiskObservation`. The Skill starts only `application_remnants`, opens the Dashboard, never calls app-only cleanup tools, emits no shell command and never asks the user to reply `ready`; cancellation requires an explicit request. Manifests reference existing production entries.

### Verification

Run MCP schema/visibility/redaction tests, no-terminal Skill tests, plugin contract tests and root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core safety weakening, merge or release.

## Русский

### Цель

Интегрировать полный MCP App и repository marketplace plugin с продуктовым сценарием без терминала.

### Объём

Зарегистрировать семь model-visible tools, app-only cleanup tools, безопасные finding/summary/disk outputs, versioned Dashboard resource, plugin manifest, stdio MCP config, Skill, redaction/visibility/no-terminal tests и package entries из CMC-09.

### Критерии приёмки

Cleanup tools app-only и не принимают paths. Mutation начинается только после app-visible button click. `audit_cancel` сохраняет точные annotations. Model output содержит support level и safe flags, но не full paths, raw config values, secrets или protected-scope details. Unsupported findings не содержат mutation, shell или sudo. Dashboard получает расширенный `StorageSummary` и `DiskObservation`. Skill запускает только `application_remnants`, открывает Dashboard, не вызывает app-only cleanup tools, не выдаёт shell-команду и не просит ответить «готово»; отмена — только по явному запросу. Manifests ссылаются на существующие production entries.

### Проверка

Запустить MCP schema/visibility/redaction tests, no-terminal Skill tests, plugin contract tests и root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление core safety, merge и release.

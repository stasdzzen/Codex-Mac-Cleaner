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

Integrate the complete MCP App surface and build the repository marketplace plugin package.

### Scope

Register seven model-visible tools, app-only cleanup mutation tools, versioned dashboard resource, plugin manifest, stdio MCP config, Skill and contract tests from CMC-09.

### Acceptance criteria

Cleanup mutation tools are app-only and accept no paths. `audit_cancel` remains model-visible, non-destructive and idempotent with the exact MCP annotations. Model-visible output contains no full paths. The dashboard receives server-owned storage summaries and audit cancellation states, loads through `dashboard-v1.html`, and manifests reference existing build entries. The Skill may cancel an audit only after an explicit user request.

### Verification

Run MCP schema/visibility tests, plugin contract tests and root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core policy weakening, merge or release.

## Русский

### Цель

Интегрировать полный MCP App surface и собрать plugin package для repository marketplace.

### Объём

Зарегистрировать семь model-visible tools, app-only cleanup mutation tools, versioned dashboard resource, plugin manifest, stdio MCP config, Skill и tests из CMC-09.

### Критерии приёмки

Cleanup mutation tools app-only и не принимают paths. `audit_cancel` остаётся model-visible, non-destructive и idempotent с точными annotations MCP contract. Model-visible output без полных путей. Dashboard получает server-owned storage summaries и состояния отмены аудита, загружается как `dashboard-v1.html`, manifests ссылаются на существующие build entries. Skill может отменить аудит только по явному запросу пользователя.

### Проверка

Запустить MCP schema/visibility tests, plugin contract tests и root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление policy, merge и release.

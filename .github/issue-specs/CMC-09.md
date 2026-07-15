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

Register model-visible and app-only tools, versioned dashboard resource, plugin manifest, stdio MCP config, Skill and contract tests from CMC-09.

### Acceptance criteria

Mutation tools are app-only and accept no paths. Annotations exactly match the MCP contract. Model-visible output contains no full paths. The autonomous dashboard loads through `dashboard-v1.html`, and manifests reference existing build entries.

### Verification

Run MCP schema/visibility tests, plugin contract tests and root `pnpm check` on the final head SHA.

### Constraints

No network transport, telemetry, public Plugin Directory claim, core policy weakening, merge or release.

## Русский

### Цель

Интегрировать полный MCP App surface и собрать plugin package для repository marketplace.

### Объём

Зарегистрировать model-visible/app-only tools, versioned dashboard resource, plugin manifest, stdio MCP config, Skill и tests из CMC-09.

### Критерии приёмки

Mutation tools app-only и не принимают paths. Annotations совпадают с contract. Model-visible output без полных путей. Dashboard загружается как `dashboard-v1.html`, manifests ссылаются на существующие build entries.

### Проверка

Запустить MCP schema/visibility tests, plugin contract tests и root `pnpm check` на финальном head SHA.

### Ограничения

Запрещены network transport, telemetry, заявление public Plugin Directory, ослабление policy, merge и release.

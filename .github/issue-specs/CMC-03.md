```cto-issue
schema: 1
dependencies: #2
conflicts: none
touched_paths: apps/mcp-server/; packages/contracts/; packages/storage/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Implement strict domain contracts, the JSON/NDJSON store and the model-visible read tool skeleton.

### Scope

Create Zod schemas, separate model/widget finding views, atomic file storage and the six model-visible tools defined by the MCP contract. Use the exact files in CMC-03 of the implementation plan.

### Acceptance criteria

Unknown input fields are rejected. Full paths exist only in widget-only data and local manifests. Directories use `0700`, files use `0600`, writes are atomic, and mutation tools are absent.

### Verification

Run contracts tests, storage tests, MCP schema tests and root `pnpm check` on the final head SHA.

### Constraints

No adapters, policy, quarantine, SQLite, network transport, arbitrary path input, merge or release.

## Русский

### Цель

Реализовать строгие доменные контракты, JSON/NDJSON store и каркас model-visible read tools.

### Объём

Создать Zod schemas, отдельные model/widget представления Finding, atomic file store и шесть model-visible tools из MCP contract по файлам CMC-03.

### Критерии приёмки

Неизвестные поля отклоняются. Полные пути есть только в widget-only данных и локальных manifests. Права `0700`/`0600`, запись атомарна, mutation tools отсутствуют.

### Проверка

Запустить contracts, storage и MCP schema tests, затем root `pnpm check` на финальном head SHA.

### Ограничения

Не добавлять adapters, policy, quarantine, SQLite, network transport, path input, merge или release.

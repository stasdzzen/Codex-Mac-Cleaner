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

Implement strict domain contracts, the JSON/NDJSON store and the model-visible non-destructive tool skeleton.

### Scope

Create Zod schemas, separate model/widget finding views, atomic file storage, audit cancellation contracts, server-owned storage summaries and the seven model-visible tools defined by the MCP contract. Use the exact files in CMC-03 of the implementation plan.

### Acceptance criteria

Unknown input fields are rejected. `audit_cancel` accepts only `auditId` and `requestId`, is non-destructive and idempotent, and the run-state contract includes `cancelling` and `cancelled`. `StorageSummary` exposes non-negative integer `candidatePhysicalBytes`, `quarantinePhysicalBytes` and `purgedPhysicalBytes`. Full paths exist only in widget-only data and local manifests. Directories use `0700`, files use `0600`, writes are atomic, and cleanup mutation tools are absent.

### Verification

Run contracts tests, storage tests, MCP schema tests and root `pnpm check` on the final head SHA.

### Constraints

No adapters, policy, quarantine, SQLite, network transport, arbitrary path input, merge or release.

## Русский

### Цель

Реализовать строгие доменные контракты, JSON/NDJSON store и каркас model-visible недеструктивных tools.

### Объём

Создать Zod schemas, отдельные model/widget представления Finding, atomic file store, контракты отмены аудита, server-owned сводку занимаемого места и семь model-visible tools из MCP contract по файлам CMC-03.

### Критерии приёмки

Неизвестные поля отклоняются. `audit_cancel` принимает только `auditId` и `requestId`, не является destructive и идемпотентен; run-state contract включает `cancelling` и `cancelled`. `StorageSummary` содержит неотрицательные целые `candidatePhysicalBytes`, `quarantinePhysicalBytes` и `purgedPhysicalBytes`. Полные пути есть только в widget-only данных и локальных manifests. Права `0700`/`0600`, запись атомарна, cleanup mutation tools отсутствуют.

### Проверка

Запустить contracts, storage и MCP schema tests, затем root `pnpm check` на финальном head SHA.

### Ограничения

Не добавлять adapters, policy, quarantine, SQLite, network transport, path input, merge или release.

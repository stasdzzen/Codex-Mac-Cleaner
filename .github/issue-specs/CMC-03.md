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

Implement strict domain, privacy, storage and model-visible MCP contracts for the local audit foundation.

### Scope

Create the CMC-03 plan files: reject-unknown Zod schemas, separate model/widget finding views, `supportLevel`, `SafeMetadata`, immutable `ProtectedScopeRule`, extended `StorageSummary`, `DiskObservation`, audit cancellation, atomic JSON/NDJSON storage and the seven model-visible tools.

### Acceptance criteria

Unknown fields are rejected. `audit_cancel` accepts only `auditId` and `requestId` and has the canonical states and annotations. `Finding` supports `candidate`, `analysis_only` and `unsupported_manual`; the latter two allow only inspect. `StorageSummary` contains non-negative `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` and `stateVersion`; `DiskObservation` contains non-negative available/total bytes, an ISO timestamp and `source=statfs`. Model-visible and persisted safe metadata contain no raw JSON/YAML/plist keys or values, secrets, subscription URLs, full paths, volume identities or protected-scope details. Cleanup mutation tools are absent. Storage permissions and atomic writes match the canon.

### Verification

Run contract, safe-metadata, protected-scope, storage and MCP schema tests plus root `pnpm check` on the final head SHA.

### Constraints

No adapters, policy implementation, quarantine, SQLite, network transport, arbitrary path input, merge or release.

## Русский

### Цель

Реализовать строгие доменные, privacy, storage и model-visible MCP-контракты фундамента аудита.

### Объём

Создать точные файлы CMC-03 из плана: reject-unknown Zod schemas, раздельные model/widget views, `supportLevel`, `SafeMetadata`, неизменяемый `ProtectedScopeRule`, расширенный `StorageSummary`, `DiskObservation`, отмену аудита, атомарный JSON/NDJSON store и семь model-visible tools.

### Критерии приёмки

Неизвестные поля отклоняются. `audit_cancel` принимает только `auditId`/`requestId` и имеет канонические states/annotations. `Finding` поддерживает `candidate`, `analysis_only`, `unsupported_manual`; два последних допускают только inspect. `StorageSummary` содержит неотрицательные целые `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes`, `stateVersion`; `DiskObservation` — available/total bytes, ISO-время и `source=statfs`. Model-visible и persisted safe metadata не содержат raw JSON/YAML/plist keys/values, passwords, tokens, subscription URLs, full paths, volume identities или protected-scope details. Cleanup mutation tools отсутствуют. Права и atomic writes соответствуют канону.

### Проверка

Запустить contract, safe-metadata, protected-scope, storage и MCP schema tests, затем root `pnpm check` на финальном head SHA.

### Ограничения

Не добавлять adapters, policy implementation, quarantine, SQLite, network transport, arbitrary path input, merge или release.

```cto-issue
schema: 1
dependencies: #2, #23
conflicts: none
touched_paths: apps/mcp-server/; packages/contracts/; packages/storage/; pnpm-lock.yaml
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Implement strict public-product domain, privacy, storage and model-visible MCP contracts for the local audit foundation.

### Scope

Create the CMC-03 plan files: reject-unknown Zod schemas, separate model/widget finding views, `FindingFacts`, `ReclaimEstimate`, `supportLevel`, `SafeMetadata`, universal immutable `ProtectedScopeRule`, `UserExclusion`, `ScheduleIntent`/`ScheduleState`, extended `StorageSummary`, `DiskObservation`, audit cancellation, atomic JSON/NDJSON/versioned-state primitives and the canonical model-visible skeleton.

### Acceptance criteria

Unknown fields are rejected. `audit_cancel` accepts only `auditId` and `requestId`. `Finding` includes canonical support/facts/reclaim schemas. `ProtectedScopeRule` uses only universal classes and contains no personal app/path rules. Versioned exclusion/schedule schemas and migration primitives are strict; a path alone is never exclusion identity and schedule inputs contain no raw RRULE. `StorageSummary` and `DiskObservation` retain canonical non-negative fields. Model-visible and persisted safe metadata contain no raw config, secrets, full paths, personal inventory, signing details or protected-scope identities. Cleanup implementation is absent. Storage permissions and atomic writes match the canon.

### Verification

Run contract, finding-facts, safe-metadata, universal-protected-scope, exclusion/schedule schema, migration-primitive, storage and MCP schema tests plus root `pnpm check` on the final head SHA.

### Constraints

No adapters, policy implementation, quarantine, SQLite, network transport, arbitrary path input, merge or release.

## Русский

### Цель

Реализовать строгие публичные доменные, privacy, storage и model-visible MCP-контракты фундамента аудита.

### Объём

Создать точные файлы CMC-03 из плана: reject-unknown Zod schemas, раздельные model/widget views, `FindingFacts`, `ReclaimEstimate`, `supportLevel`, `SafeMetadata`, универсальный неизменяемый `ProtectedScopeRule`, `UserExclusion`, `ScheduleIntent`/`ScheduleState`, расширенный `StorageSummary`, `DiskObservation`, отмену аудита и атомарные JSON/NDJSON/versioned-state primitives.

### Критерии приёмки

Неизвестные поля отклоняются. `audit_cancel` принимает только `auditId`/`requestId`. `Finding` включает канонические support/facts/reclaim schemas. `ProtectedScopeRule` содержит только универсальные классы без персональных app/path rules. Exclusion/schedule schemas и migration primitives строгие; один path не является exclusion identity, а schedule input не содержит raw RRULE. `StorageSummary` и `DiskObservation` сохраняют канонические неотрицательные поля. Model-visible и persisted metadata не содержат raw config, secrets, full paths, personal inventory, signing details или protected identities. Cleanup implementation отсутствует. Права и atomic writes соответствуют канону.

### Проверка

Запустить contract, finding-facts, safe-metadata, universal-protected-scope, exclusion/schedule schema, migration-primitive, storage и MCP schema tests, затем root `pnpm check` на финальном head SHA.

### Ограничения

Не добавлять adapters, policy implementation, quarantine, SQLite, network transport, arbitrary path input, merge или release.

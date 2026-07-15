```cto-issue
schema: 1
dependencies: #5
conflicts: none
touched_paths: packages/quarantine/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement the durable single-object quarantine transaction and fail-closed crash recovery.

### Scope

Create preview tokens, object locking, manifests, journal, same-volume move and the recovery matrix from CMC-06. Restore and purge are excluded.

### Acceptance criteria

A durable `prepared` manifest exists before rename. The destination is fixed by the server. `EXDEV`, stale fingerprint, link, mount, active/open-file and race conditions change no source data. Repeated operation IDs are idempotent.

### Verification

Run temp-directory E2E, race and every fault-injection point plus root `pnpm check`.

### Constraints

No copy-delete, arbitrary path/destination, follow-links, restore, purge, UI, merge or release.

## Русский

### Цель

Реализовать durable quarantine transaction одного объекта и fail-closed crash recovery.

### Объём

Создать preview tokens, object lock, manifests, journal, same-volume move и recovery matrix из CMC-06. Restore и purge исключены.

### Критерии приёмки

Durable `prepared` manifest существует до rename. Destination вычисляет сервер. `EXDEV`, stale fingerprint, link, mount, active/open-file и race не меняют source. Повтор operation ID идемпотентен.

### Проверка

Запустить temp-directory E2E, race, все fault-injection точки и root `pnpm check`.

### Ограничения

Запрещены copy-delete, path/destination input, follow-links, restore, purge, UI, merge и release.

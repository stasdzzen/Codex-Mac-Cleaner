```cto-issue
schema: 1
dependencies: #6
conflicts: none
touched_paths: packages/quarantine/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Add safe original-path restore and explicit single-entry purge to the quarantine package.

### Scope

Implement prepare/execute flows for restore and purge, a server-owned quarantine summary, and conflict, metadata, xattr and symlink tests from CMC-07.

### Acceptance criteria

Restore never creates parents, overwrites a path or uses an alternate destination. Purge is manual, single-entry, quarantine-contained and never follows links. Move, restore and purge return the new `stateVersion` and `StorageSummary`. A successful purge increases journal-derived `purgedPhysicalBytes`; a failed purge keeps the entry and summary unchanged. Metadata and synthetic xattrs survive restore.

### Verification

Run the complete quarantine suite and root `pnpm check`, including external symlink target preservation.

### Constraints

No bulk or timed purge, overwrite, alternate restore, UI, plugin packaging, merge or release.

## Русский

### Цель

Добавить безопасный restore в исходный путь и явный purge одной записи карантина.

### Объём

Реализовать prepare/execute flows restore и purge, server-owned сводку карантина, conflict, metadata, xattr и symlink tests из CMC-07.

### Критерии приёмки

Restore не создаёт parents, не перезаписывает путь и не использует alternate destination. Purge ручной, поэлементный, ограничен карантином и не следует links. Move, restore и purge возвращают новый `stateVersion` и `StorageSummary`. Успешный purge увеличивает вычисленный по локальному журналу `purgedPhysicalBytes`; неуспешный purge сохраняет запись и сводку без изменений. Metadata и synthetic xattrs сохраняются.

### Проверка

Запустить полный quarantine suite и root `pnpm check`, включая сохранность внешнего symlink target.

### Ограничения

Запрещены bulk/timed purge, overwrite, alternate restore, UI, plugin packaging, merge и release.

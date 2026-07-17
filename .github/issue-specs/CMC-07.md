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

Add safe original-path restore, explicit single-entry purge and honest storage/disk observations.

### Scope

Implement restore and purge prepare/execute flows, extended server-owned `StorageSummary`, timestamped `DiskObservation`, and conflict, metadata, xattr, symlink, summary and APFS-semantics tests from CMC-07.

### Acceptance criteria

Restore never creates parents, overwrites a path or uses an alternate destination. Purge is manual, single-entry, quarantine-contained and never follows links. Move, restore and purge return a new `stateVersion`, summary and `DiskObservation`. Summary separates logical and physical candidate bytes, quarantine bytes and journal-derived purged bytes. Disk observation contains `statfs` available/total bytes and time but no causal delta field. Successful purge updates journal-derived bytes; failed purge leaves the entry and summary unchanged. Metadata and synthetic xattrs survive restore.

### Verification

Run the complete quarantine, summary, disk-observation and failed-purge suites plus root `pnpm check`, including external symlink target preservation.

### Constraints

No bulk/timed purge, overwrite, alternate restore, APFS or Time Machine management, UI, plugin packaging, merge or release.

## Русский

### Цель

Добавить безопасный restore в исходный путь, явный purge одной записи и честные storage/disk observations.

### Объём

Реализовать prepare/execute flows restore/purge, расширенный server-owned `StorageSummary`, timestamped `DiskObservation`, conflict, metadata, xattr, symlink, summary и APFS-semantics tests из CMC-07.

### Критерии приёмки

Restore не создаёт parents, не перезаписывает путь и не использует alternate destination. Purge ручной, поэлементный, ограничен карантином и не следует links. Move, restore и purge возвращают новый `stateVersion`, summary и `DiskObservation`. Summary разделяет logical/physical candidate bytes, quarantine bytes и journal-derived purged bytes. Disk observation содержит available/total bytes `statfs` и время, но не causal delta. Успешный purge обновляет journal-derived bytes; failed purge сохраняет запись и summary. Metadata и synthetic xattrs сохраняются.

### Проверка

Запустить полный quarantine, summary, disk-observation и failed-purge suite, затем root `pnpm check`, включая сохранность внешнего symlink target.

### Ограничения

Запрещены bulk/timed purge, overwrite, alternate restore, APFS/Time Machine management, UI, plugin packaging, merge и release.

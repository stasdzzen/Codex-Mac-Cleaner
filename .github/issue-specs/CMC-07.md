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

Implement prepare/execute flows for restore and purge plus conflict, metadata, xattr and symlink tests from CMC-07.

### Acceptance criteria

Restore never creates parents, overwrites a path or uses an alternate destination. Purge is manual, single-entry, quarantine-contained and never follows links. Metadata and synthetic xattrs survive restore.

### Verification

Run the complete quarantine suite and root `pnpm check`, including external symlink target preservation.

### Constraints

No bulk or timed purge, overwrite, alternate restore, UI, plugin packaging, merge or release.

## Русский

### Цель

Добавить безопасный restore в исходный путь и явный purge одной записи карантина.

### Объём

Реализовать prepare/execute flows restore и purge, conflict, metadata, xattr и symlink tests из CMC-07.

### Критерии приёмки

Restore не создаёт parents, не перезаписывает путь и не использует alternate destination. Purge ручной, поэлементный, ограничен карантином и не следует links. Metadata и synthetic xattrs сохраняются.

### Проверка

Запустить полный quarantine suite и root `pnpm check`, включая сохранность внешнего symlink target.

### Ограничения

Запрещены bulk/timed purge, overwrite, alternate restore, UI, plugin packaging, merge и release.

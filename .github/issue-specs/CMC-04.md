```cto-issue
schema: 1
dependencies: #3
conflicts: none
touched_paths: packages/adapters/
risk: medium
parallel_safety: safe
execution_profile: default
```

## English

### Goal

Collect read-only field-derived observations while protecting excluded areas and producing honest support and coverage data.

### Scope

Implement installed-app, nine-root Library, process/open-file, user autostart, targeted system/shared inspection, receipt, filesystem/APFS and safe JSON/YAML/plist adapters, Snapshot A/B coordination and cooperative cancellation. Add only synthetic field fixtures for remnants, caches, personal data and system/shared components.

### Acceptance criteria

Adapters never mutate scanned data. Candidate traversal stays inside the nine roots and never enumerates `~/APPS`, `~/.codex`, developer/external/network areas or local Git projects. System LaunchAgents/Daemons/helpers and receipts produce only `unsupported_manual` with inspect and no shell or sudo guidance. `Operation not permitted` becomes a coverage warning. JSON/YAML/plist are reduced to `SafeMetadata` before persistence; raw keys/values and secret-like inputs are absent from observations and test output. Cancellation closes writers, reaches one terminal state and leaves empty actions. Real owner paths, bundle IDs, app inventory and secrets are absent from fixtures and PR evidence.

### Verification

Run synthetic field fixtures, redaction, protected-root, inspection-only, cancellation and read-only tree-comparison tests plus root `pnpm check`.

### Constraints

No whole-home scan, shell interpolation, real-Mac fixtures, policy decisions, mutation, merge or release.

## Русский

### Цель

Собрать read-only observations из полевых сценариев, защитить исключённые области и вернуть честные support/coverage данные.

### Объём

Реализовать adapters installed apps, девяти Library roots, processes/open files, user autostart, targeted system/shared inspection, receipts, filesystem/APFS, безопасного JSON/YAML/plist, Snapshot A/B и cooperative cancellation. Добавить только синтетические field fixtures для остатков, кэшей, личных данных и system/shared-компонентов.

### Критерии приёмки

Adapters не меняют данные. Candidate traversal остаётся в девяти roots и не перечисляет `~/APPS`, `~/.codex`, developer/external/network области или локальные Git-проекты. System LaunchAgents/Daemons/helpers и receipts дают только `unsupported_manual` с inspect, без shell/sudo. `Operation not permitted` становится coverage warning. JSON/YAML/plist сводятся к `SafeMetadata` до persistence; raw keys/values и secret-like inputs отсутствуют в observations и test output. Отмена закрывает writers, фиксирует один terminal state и пустые actions. Реальные пути, bundle IDs, app inventory и секреты владельца отсутствуют в fixtures и PR evidence.

### Проверка

Запустить synthetic field fixtures, redaction, protected-root, inspection-only, cancellation и read-only tree-comparison tests, затем root `pnpm check`.

### Ограничения

Запрещены whole-home scan, shell interpolation, real-Mac fixtures, policy decisions, mutation, merge и release.

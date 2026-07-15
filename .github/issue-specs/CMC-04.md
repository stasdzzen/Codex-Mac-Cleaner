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

Collect read-only observations and produce an honest capability and coverage report.

### Scope

Implement installed-app, allowlisted Library, process/open-file, autostart, receipt and filesystem metadata adapters plus Snapshot A/B coordination.

### Acceptance criteria

Adapters never mutate scanned data. One adapter failure becomes a typed warning and coverage gap. The scan stays inside approved roots, excludes quarantine/developer/external/network areas, and marks changed objects stale with no actions.

### Verification

Run all synthetic fixture tests, read-only tree comparison tests and root `pnpm check`.

### Constraints

No whole-home scan, shell interpolation, user data fixtures, policy decisions, mutation, merge or release.

## Русский

### Цель

Собрать read-only observations и сформировать честный capability/coverage report.

### Объём

Реализовать adapters приложений, allowlisted Library, processes/open files, autostart, receipts, filesystem metadata и координацию Snapshot A/B.

### Критерии приёмки

Adapters не меняют данные. Ошибка одного источника становится typed warning и coverage gap. Обход не выходит за утверждённые корни, исключает карантин/developer/external/network области и помечает изменения stale без actions.

### Проверка

Запустить synthetic fixtures, read-only tree comparison tests и root `pnpm check`.

### Ограничения

Запрещены whole-home scan, shell interpolation, реальные пользовательские fixtures, policy, mutation, merge и release.

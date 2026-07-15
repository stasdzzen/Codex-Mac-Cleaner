```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: LICENSE; README.md; docs/decisions/ADR-0008-apache-license.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Replace the temporary MIT license with the exact Apache License 2.0 text before any implementation commit.

### Scope

Change `LICENSE` and the license section of `README.md`. Verify ADR-0008 without changing its decision. Create `NOTICE` only when a real attribution requires it.

### Acceptance criteria

`LICENSE` contains the complete official Apache-2.0 text. README and repository metadata do not claim MIT. No runtime code or unrelated documentation changes are included.

### Verification

Run the license header search and `git diff --check` from the CMC-01 implementation plan. Attach the direct owner authorization for this protected legal action to the Worker report.

### Constraints

Do not start without a separate direct owner authorization. Do not create an empty `NOTICE`, change product scope, merge, publish, or release.

## Русский

### Цель

Заменить временную MIT License точным текстом Apache License 2.0 до первого коммита с реализацией.

### Объём

Изменить `LICENSE` и раздел лицензии `README.md`. Проверить ADR-0008 без смены решения. Создать `NOTICE` только при реальной необходимости attribution.

### Критерии приёмки

`LICENSE` содержит полный официальный текст Apache-2.0. README и metadata не заявляют MIT. Runtime-код и несвязанные документы не изменены.

### Проверка

Выполнить поиск заголовков лицензии и `git diff --check` из плана CMC-01. В отчёте Worker указать прямое разрешение владельца на protected legal action.

### Ограничения

Без отдельного прямого разрешения владельца остановиться без изменений. Не создавать пустой `NOTICE`, не менять scope, не выполнять merge, publication или release.

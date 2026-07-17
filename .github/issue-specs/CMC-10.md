```cto-issue
schema: 1
dependencies: #9
conflicts: none
touched_paths: .github/workflows/; scripts/; tests/security/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Complete security and privacy verification and produce deterministic release evidence without publishing a release.

### Scope

Add security tests, audit-cancellation race tests, quarantine-metric and purge-failure tests, non-publishing CI, deterministic packaging verification, SBOM/checksum/provenance inputs and an uncompleted real-Mac smoke protocol from CMC-10.

### Acceptance criteria

Automated gates A–H that do not require a real Mac pass on the final SHA. They prove a cancelled partial report has no actions, a terminal-state cancellation race is idempotent, a failed purge leaves the entry and storage summary unchanged, no bulk purge exists, and UI copy does not claim an exact APFS free-space delta. The package contains only approved production files and no secrets or build paths. Manual smoke, tag and release remain explicitly incomplete.

### Verification

Run the exact security, plugin, build, package `--verify-only` and diff checks from CMC-10. Attach outputs to the PR at its final head SHA.

### Constraints

Do not create a tag, release, publication, deploy, credential change, false manual result, merge or self-review.

## Русский

### Цель

Завершить security/privacy verification и подготовить deterministic release evidence без публикации релиза.

### Объём

Добавить security tests, tests гонки отмены аудита, метрик карантина и неуспешного purge, CI без публикации, packaging verification, SBOM/checksum/provenance inputs и незаполненный real-Mac smoke protocol из CMC-10.

### Критерии приёмки

Автоматические части gates A–H проходят на финальном SHA. Они доказывают, что частичный отменённый отчёт не содержит actions, гонка отмены с terminal state идемпотентна, неуспешный purge не меняет запись и сводку места, bulk purge отсутствует, а UI не заявляет точное изменение свободного места APFS. Package содержит только утверждённые production files без secrets/build paths. Manual smoke, tag и release явно остаются незавершёнными.

### Проверка

Запустить точные security/plugin/build/package `--verify-only` и diff checks из CMC-10; приложить outputs к PR на финальном head SHA.

### Ограничения

Не создавать tag, release, publication, deploy, credential change, ложный manual result, merge или self-review.

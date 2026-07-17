```cto-issue
schema: 1
dependencies: #9
conflicts: none
touched_paths: .github/workflows/; scripts/; tests/security/; tests/plugin/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Complete protected-scope, privacy, field-E2E and clean-room verification and produce deterministic release evidence without publishing.

### Scope

Add CMC-10 security tests for protected scopes, safe metadata, synthetic field fixtures, cancellation races, quarantine metrics, purge failures and visibility; add no-terminal clean-room/new-task tests, non-publishing CI, deterministic packaging, SBOM/checksum/provenance inputs and an uncompleted real-Mac owner protocol.

### Acceptance criteria

Automated gates A–H pass on the final SHA. Forged findings for `~/APPS`, `~/.codex`, a protected owner and a local Git project return `PROTECTED_SCOPE` and cannot produce a preview. Raw JSON/YAML/plist values, passwords, tokens, subscription URLs, real paths, owner app inventory and local bundle IDs are absent from outputs, logs, snapshots, fixtures, package and PR evidence. Synthetic field E2E proves candidate/analysis-only/unsupported behavior. `Keep` calls no tool; unsupported findings have no shell/sudo; no bulk exists. Storage/disk UI makes no causal APFS claim. Clean-room installation opens an audit and Dashboard in a new Codex task and completes button-only leave/move/restore/purge without terminal copy or `ready` messages. Package contains only approved production files. Manual real-Mac smoke, tag and release remain explicitly incomplete owner gates.

### Verification

Run the exact protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` and diff checks from CMC-10. Attach sanitized outputs to the PR at its final head SHA.

### Constraints

Do not create a tag, release, publication, deploy, credential change, real-Mac mutation outside the owner protocol, false manual result, merge or self-review.

## Русский

### Цель

Завершить protected-scope, privacy, field-E2E и clean-room verification и подготовить deterministic release evidence без публикации.

### Объём

Добавить security tests CMC-10 для protected scopes, SafeMetadata, synthetic field fixtures, cancellation races, quarantine metrics, purge failures и visibility; no-terminal clean-room/new-task tests, CI без публикации, deterministic packaging, SBOM/checksum/provenance inputs и незаполненный real-Mac owner protocol.

### Критерии приёмки

Автоматические части gates A–H проходят на финальном SHA. Forged findings для `~/APPS`, `~/.codex`, protected owner и local Git project возвращают `PROTECTED_SCOPE` и не создают preview. Raw JSON/YAML/plist values, passwords, tokens, subscription URLs, реальные пути, owner app inventory и local bundle IDs отсутствуют в outputs, logs, snapshots, fixtures, package и PR evidence. Synthetic field E2E доказывает candidate/analysis-only/unsupported behavior. «Оставить» не вызывает tool; unsupported findings без shell/sudo; bulk отсутствует. Storage/disk UI не делает причинного APFS claim. Clean-room установка в новой задаче Codex открывает аудит и Dashboard и выполняет button-only leave/move/restore/purge без terminal copy или сообщений «готово». Package содержит только утверждённые production files. Manual real-Mac smoke, tag и release явно остаются незавершёнными owner gates.

### Проверка

Запустить точные protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` и diff checks из CMC-10; приложить sanitized outputs к PR на финальном head SHA.

### Ограничения

Не создавать tag, release, publication, deploy, credential change, real-Mac mutation вне owner protocol, ложный manual result, merge или self-review.

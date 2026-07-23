```cto-issue
schema: 1
dependencies: #96
conflicts: none
touched_paths: .github/issue-specs/CMC-51.md; docs/log.md; docs/product/requirements-traceability.md
risk: low
parallel_safety: safe
execution_profile: fast
```

## English

### Goal

Record the completed beta.12 publication in canonical project history after
CMC-50 is closed.

### Scope

Add the CMC-51 Issue spec, replace the pre-release CMC-50 status in the
architecture log with the published tag and exact merge SHA, and mark CMC-50
closed with PR and release evidence in requirements traceability.

### Acceptance criteria

Documentation names `v0.1.0-beta.12`, merge SHA
`afe603dd9e26bca221ea6496a8f2e51ea40f7a4b`, merged PR #97 and the published
release without claiming owner real-Mac smoke. Repository validation and policy
tests pass. No runtime, package, tag or release asset changes occur.

### Verification

Run repository validator, repository policy tests, `git diff --check`, verify
the live release URL and exact tag target, and obtain independent review of the
exact head.

### Constraints

Do not change runtime, README, release assets, tag, safety policy, audit
behavior or installed plugin. Do not claim the owner real-Mac smoke has passed.

## Русский

### Цель

Зафиксировать завершённую публикацию beta.12 в канонической истории проекта
после закрытия CMC-50.

### Объём

Добавить Issue spec CMC-51, заменить предварительный статус CMC-50 в
архитектурном журнале на опубликованный тег и точный merge SHA, а в
requirements traceability отметить закрытую CMC-50, слитый PR и опубликованный
выпуск.

### Критерии приёмки

Документация указывает `v0.1.0-beta.12`, merge SHA
`afe603dd9e26bca221ea6496a8f2e51ea40f7a4b`, слитый PR #97 и опубликованный
выпуск, не заявляя выполненный real-Mac smoke владельца. Repository validator и
policy tests проходят. Runtime, package, tag и release assets не меняются.

### Проверка

Запустить repository validator, repository policy tests, `git diff --check`,
проверить live release URL и точную цель тега, получить независимый review
exact head.

### Ограничения

Не менять runtime, README, release assets, tag, safety policy, поведение аудита
и установленный плагин. Не заявлять выполненным real-Mac smoke владельца.

```cto-issue
schema: 1
dependencies: #98
conflicts: none
touched_paths: README.md; ACKNOWLEDGEMENTS.md; .migration/; .github/issue-specs/CMC-16.md; .github/issue-specs/CMC-33.md; .github/issue-specs/CMC-36.md; .github/issue-specs/CMC-38.md; .github/issue-specs/CMC-39.md; .github/issue-specs/CMC-49.md; .github/issue-specs/CMC-52.md; docs/index.md; docs/prompts/CMC-16-public-repository-hardening.md; docs/quality/plugin-capability-matrix.md; docs/product/requirements-traceability.md; docs/release/v0.1.0-beta.8.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Make the public repository presentation concise, privacy-safe and suitable for
an open-source beta without changing the plugin runtime or release.

### Scope

Replace the README opening with a centered open-source hero that uses the
existing icon, a simple Russian product promise, centered badges and compact
navigation. Remove unreferenced migration notes, redact raw owner task and
audit identifiers from tracked issue specifications, move internal research
details to a local archive outside the repository, and synchronize requirements
traceability through CMC-52. Sanitize the matching historical beta.8 release
copy without changing its tag or assets. Synchronize the live GitHub repository
description with the concise Russian promise. Keep the required pinned OKF
references to GoogleCloudPlatform/knowledge-catalog.

### Acceptance criteria

The first README screen is centered and explains in plain Russian that the
plugin finds cleanup remnants that even paid App Store utilities can miss and
helps free disk space directly in Codex. The copy does not promise guaranteed
reclaimed APFS space or support outside the documented Codex plugin surface.
Tracked documentation contains no raw Codex task IDs or audit UUIDs. The
unreferenced `.migration` notes are removed. Internal comparative, research and
rejected-design references are absent from tracked public documents and remain
only in a local archive outside the repository. `ACKNOWLEDGEMENTS.md` contains
only required public provenance and framework credits. Required Google OKF
provenance remains pinned. CMC-51 is marked closed and CMC-52 is traced. The
beta.8 release text matches the sanitized tracked note. Plugin runtime,
packaged assets, versions, tags and release assets are unchanged. The live
repository description is concise Russian and matches the README promise.

### Verification

Run the repository validator and policy tests, focused README/privacy/reference
searches, Markdown link checks, `pnpm check`, package verification and
`git diff --check` on the final head. Obtain independent review of the exact
head.

### Constraints

Do not modify plugin runtime, Dashboard assets, safety policy, package
allowlist, plugin version, tag, release assets, installed plugin or GitHub
security alerts. The only permitted historical release mutation is
synchronizing the existing beta.8 public text. Do not remove required license
notices or the pinned Google OKF references. Apart from the repository
description, do not change other GitHub settings. Do not merge or publish.

## Русский

### Цель

Сделать публичное оформление репозитория лаконичным, безопасным для приватности
и достойным открытой бета-версии без изменения runtime плагина или выпуска.

### Объём

Заменить начало README на центрированный open-source hero с существующей
иконкой, простым русским обещанием продукта, центрированными бейджами и
компактной навигацией. Удалить неиспользуемые заметки миграции, обезличить
реальные идентификаторы задач владельца и аудитов в tracked Issue specs,
перенести внутренние исследовательские детали в локальный архив вне
репозитория и синхронизировать трассировку требований до CMC-52. Обезличить
соответствующий текст исторического выпуска beta.8 без изменения его тега и
assets. Синхронизировать live-описание GitHub-репозитория с коротким русским
обещанием продукта. Обязательные ссылки на
GoogleCloudPlatform/knowledge-catalog для OKF сохранить с фиксацией точной
ревизии.

### Критерии приёмки

Первый экран README выровнен по центру и простым русским языком объясняет, что
плагин находит мусор, который могут пропустить даже платные приложения из App
Store, и помогает освободить место прямо в Codex. Текст не обещает
гарантированный прирост свободного места APFS или поддержку вне документированной
поверхности плагина Codex. В tracked-документах нет реальных ID задач Codex и
UUID аудитов. Неиспользуемые заметки `.migration` удалены. Внутренние
сравнительные, исследовательские и отклонённые дизайн-ссылки отсутствуют в
tracked public docs и сохраняются только в локальном архиве вне репозитория.
`ACKNOWLEDGEMENTS.md` содержит только обязательную публичную provenance и
благодарность авторам framework. Обязательная provenance Google OKF сохранена
с pinned revision. CMC-51 отмечена закрытой, CMC-52 добавлена в трассировку.
Текст выпуска beta.8 совпадает с очищенной tracked-заметкой. Runtime,
упакованные assets, версии, теги и release assets не меняются. Live-описание
репозитория написано кратко по-русски и соответствует обещанию README.

### Проверка

Запустить repository validator и policy tests, точечные проверки README,
приватности и внешних ссылок, проверку Markdown-ссылок, `pnpm check`, проверку
пакета и `git diff --check` на финальном head. Получить независимый review
точного head.

### Ограничения

Не менять runtime плагина, assets Dashboard, safety policy, package allowlist,
версию плагина, tag, release assets, установленный плагин и GitHub security
alerts. Единственное допустимое изменение исторического выпуска —
синхронизация уже опубликованного текста beta.8. Не удалять обязательные
license notices или pinned-ссылки Google OKF. Кроме description репозитория, не
менять другие GitHub settings. Не выполнять merge и публикацию.

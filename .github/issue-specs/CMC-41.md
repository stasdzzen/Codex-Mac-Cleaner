```cto-issue
schema: 1
dependencies: #76
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/; docs/product/requirements-traceability.md; README.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Publish the installable v0.1.0-beta.9 prerelease containing the clear Russian user experience accepted in CMC-40.

### Scope

Bump every public plugin, MCP server and deterministic package version to 0.1.0-beta.9. Rebuild the checked-in runtime and Dashboard. Update the Russian README with exact installation and beta.8 to beta.9 upgrade guidance. Add plain-Russian beta.9 release notes and synchronize requirements traceability. Validate the exact release commit. After PR merge create the immutable tag, deterministic archive, checksums, dependency inventory, provenance, notices and GitHub prerelease.

### Acceptance criteria

Every public version reports 0.1.0-beta.9. The packaged plugin includes the Russian author/developer metadata, plain-Russian Dashboard actions, MCP tool descriptions, README and public documentation accepted in CMC-40. README explains installation, launch and one-command update without removing the plugin source or installed plugin. Release notes do not claim a completed owner real-Mac test. Published assets match a local assembly byte-for-byte. A temporary CODEX_HOME clean-room update from beta.8 to beta.9 succeeds without changing the owner's installed plugin.

### Verification

Run root pnpm check, plugin/security suites, widget and MCP/plugin builds, deterministic package verification, explicit release assembly in a temporary output directory, repository validators and diff checks on the final commit. Require all PR checks and CodeQL green. After merge verify the exact main SHA, create v0.1.0-beta.9 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.8 to beta.9 clean-room installation.

### Constraints

Do not change product behavior, safety policy, classifier decisions, tool schemas or mutation authority. Do not edit or reinstall the owner's plugin. Do not run a real Mac audit or cleanup. Do not merge, tag or publish before all required checks pass. Do not claim the separate owner real-Mac gate is complete.

## Русский

### Цель

Опубликовать устанавливаемую предварительную версию v0.1.0-beta.9 с понятными русскими текстами, принятыми в CMC-40.

### Объём

Обновить все публичные версии плагина, MCP-сервера и воспроизводимого пакета до 0.1.0-beta.9. Пересобрать отслеживаемые файлы сервера и интерфейса. Обновить русский README с точными инструкциями установки и обновления beta.8 → beta.9. Добавить понятные русские заметки о выпуске beta.9 и синхронизировать матрицу требований. Проверить точный релизный коммит. После слияния запроса создать неизменяемый тег, архив, контрольные суммы, перечень зависимостей, сведения о происхождении сборки, сторонние лицензии и предварительный выпуск GitHub.

### Критерии приёмки

Все публичные версии сообщают 0.1.0-beta.9. Упакованный плагин содержит русское имя разработчика, понятные русские действия интерфейса, описания инструментов MCP, README и публичные документы из CMC-40. README объясняет установку, запуск и обновление одной командой без удаления источника или установленного плагина. Заметки о выпуске не заявляют о завершённой ручной проверке владельца на реальном Mac. Опубликованные материалы побайтно совпадают с локальной сборкой. Обновление beta.8 → beta.9 проходит в отдельной временной папке Codex и не меняет установленный плагин владельца.

### Проверка

На финальном коммите запустить `pnpm check`, наборы plugin/security, сборки widget и MCP/plugin, проверку воспроизводимого пакета, явную сборку материалов выпуска во временный каталог, валидаторы репозитория и проверки diff. Потребовать зелёные проверки запроса и CodeQL. После слияния проверить точный SHA `main`, однократно создать v0.1.0-beta.9, загрузить все материалы выпуска, побайтно сравнить опубликованные файлы и выполнить обновление beta.8 → beta.9 во временном `CODEX_HOME`.

### Ограничения

Не менять поведение продукта, правила безопасности, решения классификатора, схемы инструментов и полномочия на изменение файлов. Не изменять и не переустанавливать плагин владельца. Не запускать реальную проверку или очистку Mac. Не выполнять слияние, тег и публикацию до прохождения всех обязательных проверок. Не объявлять завершённой отдельную ручную проверку владельца на реальном Mac.

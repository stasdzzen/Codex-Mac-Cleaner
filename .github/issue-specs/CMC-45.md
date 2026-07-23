```cto-issue
schema: 1
dependencies: #84
conflicts: none
touched_paths: .github/issue-specs/CMC-45.md; .codex-plugin/; apps/mcp-server/; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/; docs/product/requirements-traceability.md; README.md
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Publish the installable v0.1.0-beta.10 prerelease containing the accepted Dashboard refinements, complete audit behavior and patched runtime dependencies from CMC-42, CMC-43 and CMC-44.

### Scope

Bump every public plugin, MCP server and deterministic package version to 0.1.0-beta.10. Rebuild the checked-in runtime and Dashboard. Update the Russian README with exact installation and beta.9 to beta.10 one-command upgrade guidance. Add plain-Russian beta.10 release notes covering the final Dashboard title/animation cleanup, removal of the overall audit time limit, per-command timeout warnings, and the pinned safe runtime dependencies. Synchronize requirements traceability. Validate the exact release commit. After PR merge create the immutable tag, deterministic archive, checksums, dependency inventory, provenance, notices and GitHub prerelease.

### Acceptance criteria

Every public version reports 0.1.0-beta.10. The packaged plugin contains the accepted Dashboard from CMC-42, completes application-remnants audits without an overall deadline as accepted in CMC-43, and resolves only `fast-uri@3.1.4` plus `@hono/node-server@2.0.10` as accepted in CMC-44. README explains installation, launch and one-command beta.9 to beta.10 update without removing the marketplace or installed plugin. Release notes do not claim a completed owner real-Mac test. Published assets match a local assembly byte-for-byte. A temporary CODEX_HOME clean-room update from beta.9 to beta.10 succeeds without changing the owner's installed plugin. No open production dependency alert is dismissed or ignored.

### Verification

Run frozen install, production audit at severity moderate, exact dependency-resolution assertions, root pnpm check, plugin/security suites, widget and MCP/plugin builds, deterministic package verification, explicit release assembly in a temporary output directory, repository validators and diff checks on the final commit. Require all PR checks and CodeQL green plus independent review of the exact head. After merge verify the exact main SHA, create v0.1.0-beta.10 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.9 to beta.10 clean-room installation.

### Constraints

Do not change product behavior, safety policy, classifier decisions, tool schemas or mutation authority. Do not edit or reinstall the owner's plugin. Do not run a real Mac audit or cleanup. Do not merge, tag or publish before all required checks pass. Do not dismiss Dependabot alerts or add audit exceptions. Do not claim the separate owner real-Mac gate is complete.

## Русский

### Цель

Опубликовать устанавливаемую предварительную версию v0.1.0-beta.10 с принятыми улучшениями Dashboard, полным аудитом без общего лимита времени и исправленными runtime-зависимостями из CMC-42, CMC-43 и CMC-44.

### Объём

Обновить все публичные версии плагина, MCP-сервера и воспроизводимого пакета до 0.1.0-beta.10. Пересобрать отслеживаемые runtime и Dashboard. Обновить русский README с точными инструкциями установки и обновления beta.9 → beta.10 одной командой. Добавить понятные русские заметки beta.10: финальный заголовок Dashboard и удаление лишней анимации, отсутствие общего тайм-лимита аудита, предупреждения при лимите отдельной системной команды и зафиксированные безопасные runtime-зависимости. Синхронизировать матрицу требований. Проверить точный релизный коммит. После слияния запроса создать неизменяемый тег, архив, контрольные суммы, перечень зависимостей, сведения о происхождении сборки, сторонние лицензии и предварительный выпуск GitHub.

### Критерии приёмки

Все публичные версии сообщают 0.1.0-beta.10. Упакованный плагин содержит принятый Dashboard из CMC-42, завершает аудит остатков приложений без общего дедлайна по CMC-43 и разрешает только `fast-uri@3.1.4` и `@hono/node-server@2.0.10` по CMC-44. README объясняет установку, запуск и обновление beta.9 → beta.10 одной командой без удаления marketplace или установленного плагина. Заметки не заявляют о завершённой ручной проверке владельца на реальном Mac. Опубликованные материалы побайтно совпадают с локальной сборкой. Обновление beta.9 → beta.10 проходит во временном `CODEX_HOME` и не меняет установленный плагин владельца. Ни один открытый production dependency alert не закрывается вручную и не игнорируется.

### Проверка

На финальном коммите запустить frozen install, production audit с порогом moderate, проверки точных разрешений зависимостей, корневой `pnpm check`, наборы plugin/security, сборки widget и MCP/plugin, проверку воспроизводимого пакета, явную сборку материалов выпуска во временный каталог, валидаторы репозитория и `git diff --check`. Потребовать зелёные PR checks и CodeQL, а также независимый review точного head. После слияния проверить точный SHA `main`, однократно создать v0.1.0-beta.10, загрузить все материалы выпуска, побайтно сравнить опубликованные файлы и выполнить обновление beta.9 → beta.10 во временном `CODEX_HOME`.

### Ограничения

Не менять поведение продукта, правила безопасности, решения классификатора, схемы инструментов и полномочия на изменение файлов. Не изменять и не переустанавливать плагин владельца. Не запускать реальную проверку или очистку Mac. Не выполнять слияние, тег и публикацию до прохождения всех обязательных проверок. Не закрывать Dependabot alerts вручную и не добавлять исключения аудита. Не объявлять завершённой отдельную ручную проверку владельца на реальном Mac.

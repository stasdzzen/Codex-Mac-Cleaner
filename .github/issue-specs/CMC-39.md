```cto-issue
schema: 1
dependencies: #72
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/; docs/product/requirements-traceability.md; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.8 as the installable prerelease containing the Base UI/base-mira Dashboard and clear Russian user experience accepted in CMC-38.

### Scope

Bump every public plugin, MCP server and deterministic package version to 0.1.0-beta.8; rebuild the checked-in runtime and Dashboard; update the Russian README with exact installation and beta.7 to beta.8 upgrade guidance; add Russian beta.8 release notes; synchronize requirements traceability; validate the exact release commit; after PR merge create the immutable tag, deterministic archive, checksums, SBOM, provenance, notices and GitHub prerelease.

### Acceptance criteria

Every public version reports 0.1.0-beta.8. The packaged Dashboard uses shadcn Base UI with style base-mira and the accepted OKLCH theme; no Radix UI or Superdesign runtime dependency remains; all user-facing Dashboard, plugin, skill, README and release texts are clear Russian. README explains installation, launch and one-command update without removing the marketplace or installed plugin. Release notes do not claim completed owner Real-Mac smoke.

### Verification

Run root pnpm check, security/plugin suites, widget and MCP/plugin builds, deterministic package verification, explicit release assembly in a temporary output directory, repository validators and diff checks on the final commit. Require all PR checks and CodeQL green. After merge verify the exact main SHA, create v0.1.0-beta.8 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.7 to beta.8 clean-room installation.

### Constraints

Do not change safety policy, classifier, cleanup categories, mutation semantics, audit deadline or updater trust boundaries. Do not remove or modify the owner's installed plugin. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim owner Real-Mac smoke completion.

## Русский

### Цель

Опубликовать устанавливаемую предварительную версию v0.1.0-beta.8 с принятым в CMC-38 интерфейсом Dashboard на shadcn Base UI/base-mira и понятным русским языком.

### Объём

Обновить все публичные версии плагина, MCP-сервера и детерминированного пакета до 0.1.0-beta.8; пересобрать отслеживаемые runtime и Dashboard; обновить русский README с точными инструкциями установки, запуска и обновления beta.7 → beta.8; добавить русские заметки о выпуске beta.8; синхронизировать матрицу требований; проверить точный релизный коммит; после слияния PR создать неизменяемый тег, детерминированный архив, контрольные суммы, SBOM, provenance, сведения о сторонних лицензиях и GitHub prerelease.

### Критерии приёмки

Все публичные версии сообщают 0.1.0-beta.8. Упакованный Dashboard использует shadcn Base UI со стилем base-mira и согласованной OKLCH-темой; runtime-зависимостей от Radix UI и Superdesign нет; все пользовательские тексты Dashboard, плагина, навыков, README и заметок о выпуске написаны понятным русским языком. README объясняет установку, запуск и обновление одной командой без удаления marketplace или установленного плагина. Заметки о выпуске не заявляют о завершённом ручном smoke-тесте владельца на реальном Mac.

### Проверка

На финальном коммите запустить корневой `pnpm check`, наборы security/plugin, сборки widget и MCP/plugin, проверку детерминированного пакета, явную сборку релизных материалов во временный каталог, валидаторы репозитория и проверки diff. Потребовать зелёные проверки PR и CodeQL. После слияния проверить точный SHA `main`, однократно создать v0.1.0-beta.8, загрузить все release evidence assets, побайтно сравнить опубликованные материалы и выполнить clean-room обновление beta.7 → beta.8 во временном `CODEX_HOME`.

### Ограничения

Не менять safety policy, классификатор, категории очистки, семантику изменений, срок аудита и границы доверия updater. Не удалять и не изменять установленный у владельца плагин. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий релизный тег. Не заявлять о завершённом ручном smoke-тесте владельца.

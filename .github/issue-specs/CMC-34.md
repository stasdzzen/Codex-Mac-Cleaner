```cto-issue
schema: 1
dependencies: #62
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/; tests/plugin/; tests/security/; docs/release/; docs/product/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.6 as the installable prerelease containing user-requested Dashboard display modes and the large-audit timeout fix.

### Scope

Bump public plugin, MCP server and deterministic package metadata to 0.1.0-beta.6; rebuild the checked-in runtime and Dashboard asset; update README installation and one-command beta.5 to beta.6 upgrade guidance; add user-facing beta.6 release notes; synchronize requirements traceability; validate the exact release commit; after PR merge create the immutable tag, deterministic archive, checksums, SBOM, provenance and GitHub prerelease.

### Acceptance criteria

Every public runtime and package version reports 0.1.0-beta.6. The release includes inline-by-default Dashboard display controls for host-supported fullscreen/PiP and reuses package inventory once per Snapshot A/B while processing candidates with fixed bounded concurrency four and deterministic result order. The five-minute fail-closed deadline remains unchanged. README installs beta.6 and explains an explicit beta.5 to beta.6 update request without removing the marketplace or plugin. Release notes state that panel placement remains host-controlled and owner Real-Mac smoke is still pending.

### Verification

Run root pnpm check, security/plugin suites, updater matrix, focused runtime regressions, widget and plugin builds, deterministic package verification, explicit release assembly in a temporary output directory, repository validator, policy tests and diff checks on the final commit. Require all PR checks green. After merge verify the exact main SHA, create v0.1.0-beta.6 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.5 to beta.6 clean-room installation.

### Constraints

Do not change safety policy, classifier, cleanup categories, mutation semantics, audit deadline or updater trust boundaries. Do not remove the installed plugin during upgrade. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim owner Real-Mac smoke completion.

## Русский

### Цель

Опубликовать устанавливаемый prerelease v0.1.0-beta.6 с пользовательскими режимами отображения Dashboard и исправлением тайм-аута большого аудита.

### Объём

Обновить публичные версии plugin, MCP server и deterministic package до 0.1.0-beta.6; пересобрать отслеживаемый runtime и Dashboard asset; обновить README с установкой и обновлением beta.5 → beta.6 одной командой; добавить пользовательские release notes beta.6; синхронизировать requirements traceability; проверить точный release commit; после merge PR создать неизменяемый tag, deterministic archive, checksums, SBOM, provenance и GitHub prerelease.

### Критерии приёмки

Все публичные runtime и package versions сообщают 0.1.0-beta.6. Выпуск включает inline Dashboard по умолчанию с пользовательскими запросами поддерживаемых host режимов fullscreen/PiP, переиспользует package inventory один раз на Snapshot A/B и обрабатывает кандидаты с фиксированной bounded concurrency четыре при детерминированном порядке результатов. Пятиминутный fail-closed deadline не меняется. README устанавливает beta.6 и объясняет явный запрос обновления beta.5 → beta.6 без удаления marketplace или plugin. Release notes честно сообщают, что размещение панели контролирует host, а owner Real-Mac smoke ещё не выполнен.

### Проверка

На финальном commit запустить корневой pnpm check, security/plugin suites, updater matrix, focused runtime regressions, сборки widget и plugin, deterministic package verification, явную release-сборку во временный output, repository validator, policy tests и diff checks. Потребовать зелёные PR checks. После merge проверить exact main SHA, однократно создать v0.1.0-beta.6, загрузить release evidence assets, byte-for-byte сравнить скачанные публичные assets и выполнить clean-room установку beta.5 → beta.6 во временном CODEX_HOME.

### Ограничения

Не менять safety policy, classifier, категории очистки, mutation semantics, audit deadline и trust boundaries updater. Не удалять установленный plugin при обновлении. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий release tag. Не заявлять о завершённом owner Real-Mac smoke.

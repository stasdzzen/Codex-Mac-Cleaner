```cto-issue
schema: 1
dependencies: #68
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/src/server.ts; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/; docs/product/requirements-traceability.md; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.7 as the installable prerelease containing the corrected Real-Mac audit, readable storage units and the finalized Dashboard controls/footer.

### Scope

Bump every public plugin, MCP server and deterministic package version to 0.1.0-beta.7; rebuild the checked-in runtime and Dashboard; update README installation and beta.6 to beta.7 one-command upgrade guidance; add user-facing beta.7 release notes; synchronize requirements traceability; validate the exact release commit; after PR merge create the immutable tag, deterministic archive, checksums, SBOM, provenance, notices and GitHub prerelease.

### Acceptance criteria

Every public version reports 0.1.0-beta.7. The release removes the Mini-window/PiP action, keeps explicit fullscreen, adds the Dzzen/GitHub/Ideas/support footer, renders byte metrics in decimal MB/GB, uses bounded candidate concurrency eight under the unchanged five-minute fail-closed deadline, and shows safe read-only missing-target LaunchAgent/LaunchDaemon/process diagnostics without mutation authority. README installs beta.7 and explains an explicit beta.6 to beta.7 update request without removing the marketplace or installed plugin. Release notes do not claim completed owner Real-Mac smoke.

### Verification

Run root pnpm check, security/plugin suites, updater matrix, focused runtime/widget regressions, plugin build, deterministic package verification, explicit release assembly in a temporary output directory, repository validators and diff checks on the final commit. Require all PR checks and CodeQL green. After merge verify the exact main SHA, create v0.1.0-beta.7 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.6 to beta.7 clean-room installation.

### Constraints

Do not change safety policy, classifier, cleanup categories, mutation semantics, audit deadline or updater trust boundaries. Do not remove the installed plugin during upgrade. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim owner Real-Mac smoke completion.

## Русский

### Цель

Опубликовать устанавливаемый prerelease v0.1.0-beta.7 с исправленным Real-Mac аудитом, читаемыми единицами размера и финальными элементами управления/подвалом Dashboard.

### Объём

Обновить все публичные версии plugin, MCP server и deterministic package до 0.1.0-beta.7; пересобрать отслеживаемые runtime и Dashboard; обновить README с установкой и обновлением beta.6 → beta.7 одной командой; добавить пользовательские release notes beta.7; синхронизировать requirements traceability; проверить точный release commit; после merge PR создать неизменяемый tag, deterministic archive, checksums, SBOM, provenance, notices и GitHub prerelease.

### Критерии приёмки

Все публичные версии сообщают 0.1.0-beta.7. Выпуск удаляет действие «Мини-окно»/PiP, сохраняет явный fullscreen, добавляет подвал Dzzen/GitHub/Ideas/support, показывает byte-метрики в десятичных МБ/ГБ, использует bounded concurrency восемь при неизменном пятиминутном fail-closed deadline и показывает безопасную read-only диагностику missing-target LaunchAgent/LaunchDaemon/process без mutation authority. README устанавливает beta.7 и объясняет явный запрос обновления beta.6 → beta.7 без удаления marketplace или установленного plugin. Release notes не заявляют о завершённом owner Real-Mac smoke.

### Проверка

На финальном commit запустить корневой pnpm check, security/plugin suites, updater matrix, focused runtime/widget regressions, сборку plugin, deterministic package verification, явную release-сборку во временный output, repository validators и diff checks. Потребовать зелёные PR checks и CodeQL. После merge проверить exact main SHA, однократно создать v0.1.0-beta.7, загрузить release evidence assets, byte-for-byte сравнить скачанные публичные assets и выполнить clean-room установку beta.6 → beta.7 во временном CODEX_HOME.

### Ограничения

Не менять safety policy, classifier, категории очистки, mutation semantics, audit deadline и trust boundaries updater. Не удалять установленный plugin при обновлении. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий release tag. Не заявлять о завершённом owner Real-Mac smoke.

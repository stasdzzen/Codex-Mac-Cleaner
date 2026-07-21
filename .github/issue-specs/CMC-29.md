```cto-issue
schema: 1
dependencies: #52
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/; tests/plugin/; tests/security/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.4 as the installable prerelease that adds explicit one-command updates for all releases after beta.4 while preserving the safe marketplace migration from beta.3.

### Scope

Bump public plugin, MCP server and deterministic package metadata to 0.1.0-beta.4; rebuild the checked-in runtime; update README installation and upgrade guidance; add user-facing beta.4 release notes; validate the exact release commit; after PR merge create the protected tag, deterministic archive, checksums, SBOM, provenance and GitHub prerelease.

### Acceptance criteria

Every public runtime and package version reports 0.1.0-beta.4. The production artifact contains both cleaner and update skills plus the updater command. README installs beta.4, explains that beta.3 must replace only the pinned marketplace snapshot without removing the installed plugin, and states that releases after beta.4 can be installed by an explicit chat request with an exact tag. Release notes lead with the user benefit and do not claim that beta.3 can invoke a skill it does not contain. A clean-room beta.3 to beta.4 migration succeeds and the installed beta.4 exposes the expected plugin/MCP surface.

### Verification

Run root pnpm check, security/plugin suites, updater matrix, deterministic package verification, explicit release assembly in a temporary output directory, repository validator, policy tests and diff checks on the final commit. Require independent review and all PR checks green. After merge verify the exact main SHA, create v0.1.0-beta.4 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.3 to beta.4 clean-room installation.

### Constraints

Do not change safety policy, classifier, cleanup categories, mutation semantics or updater trust boundaries. Do not remove the installed plugin during upgrade. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim owner Real-Mac smoke completion.

## Русский

### Цель

Опубликовать устанавливаемый prerelease v0.1.0-beta.4 с явным обновлением одной командой для всех версий после beta.4 и сохранить безопасный переход marketplace с beta.3.

### Объём

Обновить публичные версии plugin, MCP server и deterministic package до 0.1.0-beta.4; пересобрать отслеживаемый runtime; обновить README с установкой и обновлением; добавить пользовательские release notes beta.4; проверить точный release commit; после merge PR создать защищённый tag, deterministic archive, checksums, SBOM, provenance и GitHub prerelease.

### Критерии приёмки

Все публичные runtime и package versions сообщают 0.1.0-beta.4. Production artifact содержит cleaner-skill, update-skill и updater-команду. README устанавливает beta.4, объясняет, что при переходе с beta.3 заменяется только закреплённый marketplace snapshot без удаления установленного плагина, и сообщает, что версии после beta.4 можно установить явным запросом в чате с точным тегом. Release notes начинаются с пользы пользователю и не заявляют, что beta.3 может вызвать отсутствующий в ней навык. Clean-room переход beta.3 → beta.4 проходит, а установленная beta.4 показывает ожидаемые plugin/MCP surfaces.

### Проверка

На финальном commit запустить корневой pnpm check, security/plugin suites, updater matrix, deterministic package verification, явную release-сборку во временный output, repository validator, policy tests и diff checks. Потребовать независимую проверку и зелёные PR checks. После merge проверить exact main SHA, однократно создать v0.1.0-beta.4, загрузить release evidence assets, byte-for-byte сравнить скачанные публичные assets и выполнить clean-room установку beta.3 → beta.4 во временном CODEX_HOME.

### Ограничения

Не менять safety policy, classifier, категории очистки, mutation semantics и trust boundaries updater. Не удалять установленный плагин при обновлении. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий release tag. Не заявлять о завершённом owner Real-Mac smoke.

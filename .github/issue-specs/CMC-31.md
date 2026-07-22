```cto-issue
schema: 1
dependencies: #56
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/; tests/plugin/; tests/security/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.5 as the installable prerelease that restores the visual Audit Dashboard and requests the Codex app surface instead of exposing minified JavaScript as text.

### Scope

Bump public plugin, MCP server and deterministic package metadata to 0.1.0-beta.5; rebuild the checked-in runtime and corrected standalone Dashboard asset; update README installation and one-command beta.4 to beta.5 upgrade guidance; add user-facing beta.5 release notes; validate the exact release commit; after PR merge create the immutable tag, deterministic archive, checksums, SBOM, provenance and GitHub prerelease.

### Acceptance criteria

Every public runtime and package version reports 0.1.0-beta.5. The packaged Dashboard contains one document shell, one module script, one closing script, one style block and no external script source. dashboard_open retains current and compatibility app-surface metadata. README installs beta.5 and explains that beta.4 users update by an explicit chat request with the exact tag without removing the marketplace or plugin. Release notes state that physical panel placement remains host-controlled and owner Real-Mac smoke is still pending.

### Verification

Run root pnpm check, security/plugin suites, updater matrix, focused MCP integration regression, widget and plugin builds, deterministic package verification, explicit release assembly in a temporary output directory, repository validator, policy tests and diff checks on the final commit. Require all PR checks green. After merge verify the exact main SHA, create v0.1.0-beta.5 once, upload all release evidence assets, compare downloaded public assets byte-for-byte and run a temporary-CODEX_HOME beta.4 to beta.5 clean-room installation.

### Constraints

Do not change safety policy, classifier, cleanup categories, mutation semantics or updater trust boundaries. Do not remove the installed plugin during upgrade. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim owner Real-Mac smoke completion.

## Русский

### Цель

Опубликовать устанавливаемый prerelease v0.1.0-beta.5, который восстанавливает визуальный Audit Dashboard и запрашивает app surface Codex вместо показа минифицированного JavaScript текстом.

### Объём

Обновить публичные версии plugin, MCP server и deterministic package до 0.1.0-beta.5; пересобрать отслеживаемый runtime и исправленный автономный Dashboard asset; обновить README с установкой и обновлением beta.4 → beta.5 одной командой; добавить пользовательские release notes beta.5; проверить точный release commit; после merge PR создать неизменяемый tag, deterministic archive, checksums, SBOM, provenance и GitHub prerelease.

### Критерии приёмки

Все публичные runtime и package versions сообщают 0.1.0-beta.5. Упакованный Dashboard содержит один document shell, один module script, один closing script, один style block и не содержит внешнего script source. dashboard_open сохраняет текущие и совместимые app-surface metadata. README устанавливает beta.5 и объясняет, что пользователи beta.4 обновляются явным запросом в чате с точным тегом без удаления marketplace или plugin. Release notes честно сообщают, что физическое размещение панели контролирует host, а owner Real-Mac smoke ещё не выполнен.

### Проверка

На финальном commit запустить корневой pnpm check, security/plugin suites, updater matrix, focused MCP integration regression, сборки widget и plugin, deterministic package verification, явную release-сборку во временный output, repository validator, policy tests и diff checks. Потребовать зелёные PR checks. После merge проверить exact main SHA, однократно создать v0.1.0-beta.5, загрузить release evidence assets, byte-for-byte сравнить скачанные публичные assets и выполнить clean-room установку beta.4 → beta.5 во временном CODEX_HOME.

### Ограничения

Не менять safety policy, classifier, категории очистки, mutation semantics и trust boundaries updater. Не удалять установленный plugin при обновлении. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий release tag. Не заявлять о завершённом owner Real-Mac smoke.

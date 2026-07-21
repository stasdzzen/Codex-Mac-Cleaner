```cto-issue
schema: 1
dependencies: #48
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/; scripts/; tests/plugin/; tests/security/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Publish v0.1.0-beta.3 as the installable prerelease containing the live Audit Dashboard, bounded evidence collection and fail-closed timeout fixes accepted in CMC-26.

### Scope

Bump public plugin, MCP server and deterministic package metadata to 0.1.0-beta.3; update installation and upgrade guidance; add user-facing beta.3 release notes; rebuild the checked-in runtime; validate the exact release commit; after PR merge create the protected tag, deterministic archive, checksums, SBOM, provenance and GitHub prerelease.

### Acceptance criteria

Every public runtime and package version reports 0.1.0-beta.3. README installation pins v0.1.0-beta.3 and explains a clean marketplace refresh from beta.2. Release notes describe immediate live Dashboard progress, shared bounded inventories, the five-minute server deadline, and the revision:null fail-closed boundary without claiming owner Real-Mac smoke completion. The packaged manifest completes MCP handshake, exposes tools, reads Dashboard v2 and preserves manual cancel separately from AUDIT_TIMEOUT. The archive checksum, file checksums, SBOM and provenance bind to the exact release tag commit.

### Verification

Run root pnpm check, security/plugin suites, repeated deadline regression, deterministic package verification, explicit release assembly in a temporary output directory, repository validator, repository policy tests and diff checks on the final commit. Require all PR checks green and independent review. Verify merged main SHA, create v0.1.0-beta.3 once, upload all release evidence assets, compare the downloaded public archive and checksums byte-for-byte, and read back the public prerelease.

### Constraints

Do not change safety policy, classifier, cleanup categories or mutation semantics. Do not perform a real Mac audit or cleanup. Do not publish to the shared Plugin Directory. Never move, recreate or force-update an existing release tag. Do not claim the owner smoke gate has passed.

## Русский

### Цель

Опубликовать устанавливаемый prerelease v0.1.0-beta.3 с живым Audit Dashboard, ограниченным сбором evidence и fail-closed исправлениями тайм-аута из принятой CMC-26.

### Объём

Обновить публичные версии plugin, MCP server и deterministic package до 0.1.0-beta.3; обновить инструкции установки и перехода; добавить пользовательские release notes beta.3; пересобрать отслеживаемый runtime; проверить точный release commit; после merge PR создать защищённый tag, deterministic archive, checksums, SBOM, provenance и GitHub prerelease.

### Критерии приёмки

Все публичные runtime и package версии сообщают 0.1.0-beta.3. README фиксирует установку на v0.1.0-beta.3 и объясняет чистое обновление marketplace с beta.2. Release notes описывают немедленный живой Dashboard, общий ограниченный сбор inventories, пятиминутный server deadline и fail-closed границу revision:null без ложного заявления о завершённом owner Real-Mac smoke. Packaged manifest проходит MCP handshake, отдаёт tools и Dashboard v2 и отличает ручную отмену от AUDIT_TIMEOUT. Checksum архива, file checksums, SBOM и provenance привязаны к точному commit release tag.

### Проверка

На финальном commit запустить корневой pnpm check, security/plugin suites, повторяемый deadline regression, deterministic package verification, явную release-сборку во временный output, repository validator, repository policy tests и diff checks. Потребовать зелёные PR checks и независимую проверку. Проверить merged main SHA, однократно создать v0.1.0-beta.3, загрузить все release evidence assets, byte-for-byte сравнить публично скачанный архив и checksums и прочитать опубликованный prerelease обратно.

### Ограничения

Не менять safety policy, classifier, категории очистки и семантику mutation. Не выполнять реальный аудит или очистку Mac. Не публиковать в общую Plugin Directory. Никогда не перемещать, не пересоздавать и не force-update существующий release tag. Не заявлять о прохождении owner smoke gate.

```cto-issue
schema: 1
dependencies: #94
conflicts: none
touched_paths: .github/issue-specs/CMC-50.md; .codex-plugin/plugin.json; .codex-plugin/runtime/server.js; apps/mcp-server/src/server.ts; README.md; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/v0.1.0-beta.12.md; docs/product/requirements-traceability.md; docs/log.md
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Publish installable `v0.1.0-beta.12` after CMC-49 so the privacy-safe
plugin-surface diagnostics, troubleshooting runbook and capability matrix are
included in a verifiable prerelease.

### Scope

Bump all current public versions to beta.12 without changing audit behavior or
safety invariants, rebuild the tracked MCP runtime, update Russian README and
release notes, validate the packaged MCP surface and privacy-safe error
handling, test clean-room install and beta.11-to-beta.12 update in a temporary
`CODEX_HOME`, then publish deterministic release evidence and a GitHub
prerelease from the exact merged SHA.

### Acceptance criteria

Every current public surface reports beta.12. The packaged handshake exposes
the canonical 9 model-visible and 15 app-only tools with matching Dashboard v3
URI, MIME and CSP. Missing-root diagnostics expose only a safe typed code.
Root, plugin, security, privacy, dependency, deterministic package, repository,
CI and CodeQL gates pass. Clean-room install/update passes without modifying
the owner-installed plugin. Published assets match the release SHA
byte-for-byte. Owner real-Mac smoke remains a separate post-release gate.

### Verification

Run frozen install, production audit at severity moderate, root checks,
plugin-surface probe, plugin/security/privacy suites, tracked build,
deterministic double-build/package, plugin validator, temporary clean-room
install/update, repository validators, PR checks, CodeQL and independent review
of the exact head. After publication, download and compare release assets
byte-for-byte.

### Constraints

Do not change classifier, policy, quarantine, protected scopes, Dashboard UX
or audit semantics. Do not modify the owner-installed plugin, run real-Mac
cleanup, or tag/publish before green gates. Owner authorization to merge and
publish beta.12 was provided on 2026-07-23.

## Русский

### Цель

Выпустить устанавливаемую `v0.1.0-beta.12` после принятия CMC-49, чтобы
privacy-safe диагностика поверхности плагина, актуальный runbook и capability
matrix были закреплены в проверяемом публичном prerelease.

### Объём

Обновить все текущие публичные версии до `0.1.0-beta.12` без изменения
поведения аудита и safety-инвариантов, пересобрать отслеживаемый MCP runtime,
обновить русский README и заметки выпуска, проверить packaged MCP surface и
privacy-safe ошибки, выполнить clean-room установку и обновление beta.11 →
beta.12 во временном `CODEX_HOME`, затем опубликовать воспроизводимые материалы
и GitHub prerelease из точного merge SHA.

### Критерии приёмки

Все текущие публичные поверхности сообщают beta.12. Packaged handshake содержит
ровно канонические 9 model-visible и 15 app-only tools, а Dashboard v3
URI/MIME/CSP совпадают с матрицей. Missing-root probe возвращает только
безопасный typed code без абсолютного пути. Root, plugin, security, privacy,
dependency, deterministic package, repository, CI и CodeQL gates проходят.
Clean-room install/update не изменяет установленный плагин владельца.
Опубликованные assets побайтно совпадают со сборкой release SHA. Реальная
проверка на Mac владельца остаётся отдельным post-release gate.

### Проверка

Выполнить frozen install, production audit severity moderate, корневые
проверки, plugin-surface probe, plugin/security/privacy suites, tracked build,
deterministic double-build/package, plugin validator, временную clean-room
install/update, repository validators, PR checks, CodeQL и независимый review
exact head. После публикации скачать и побайтно сравнить release assets.

### Ограничения

Не менять classifier, policy, quarantine, protected scopes, Dashboard UX и
семантику аудита. Не изменять установленный плагин владельца, не запускать
реальную очистку Mac и не выполнять tag/publish до зелёных gates. Разрешение
владельца на merge и выпуск beta.12 получено 23 июля 2026 года.

```cto-issue
schema: 1
dependencies: #88, #89
conflicts: none
touched_paths: .github/issue-specs/CMC-48.md; .codex-plugin/; .mcp.json; apps/mcp-server/; apps/widget/; skills/codex-mac-cleaner/; scripts/package-release.mjs; tests/plugin/; tests/security/; docs/release/; docs/product/requirements-traceability.md; README.md
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Publish installable v0.1.0-beta.11 after CMC-46 and CMC-47 deliver the native
one-run terminal-revision flow, fail-closed missing-tool behavior and bounded
paginated Dashboard v3.

### Scope

Bump every public version to 0.1.0-beta.11, rebuild the tracked MCP runtime and
Dashboard v3, update the Russian README and release notes, validate a temporary
clean-room installation and beta.10-to-beta.11 update, then publish deterministic
release evidence and a GitHub prerelease from the exact merged SHA.

### Acceptance criteria

Every public surface reports beta.11. The packaged handshake exposes the
required model and app tools. A 2,767-finding synthetic run remains bounded and
fully traversable. The Skill has no terminal, direct stdio, local-HTML or
automatic-rescan fallback. Clean-room install/update, production dependency
audit, CI/CodeQL, plugin/security/privacy and deterministic packaging gates
pass. Published assets match the release SHA byte-for-byte. Owner real-Mac smoke
remains a separate post-release gate.

### Verification

Run frozen install, production audit at severity moderate, exact vulnerable
dependency-resolution checks, root checks, contract/runtime/widget/plugin,
security and privacy suites, builds, deterministic packaging, plugin validator,
temporary-CODEX-HOME install/update, repository validators, PR checks, CodeQL
and independent review of the exact head. After publication download and compare
release assets byte-for-byte.

### Constraints

Do not alter the owner's installed plugin, run real-Mac cleanup, dismiss
dependency alerts, merge, tag or publish before green gates, or claim to fix
Codex host internals.

## Русский

### Цель

Опубликовать устанавливаемую v0.1.0-beta.11 после принятия CMC-46 и CMC-47:
штатный однопроходный audit flow с terminal revision, fail-closed поведением при
отсутствии инструментов и bounded Dashboard v3 с серверной пагинацией.

### Объём

Обновить все публичные версии до `0.1.0-beta.11`, пересобрать отслеживаемые MCP
runtime и Dashboard v3, обновить русский README и заметки выпуска, проверить
чистую установку и обновление beta.10 → beta.11 во временном `CODEX_HOME`, затем
опубликовать воспроизводимые материалы и GitHub prerelease из точного merge SHA.

### Критерии приёмки

Все публичные поверхности сообщают beta.11. Упакованный MCP объявляет
обязательные model- и app-инструменты. Синтетические 2 767 находок выдаются
страницами без пропусков и oversized response. Навык не использует Terminal,
прямой stdio, local HTML или автоматический повторный аудит. Clean-room
установка/обновление, production dependency audit, CI/CodeQL,
plugin/security/privacy и deterministic packaging проходят. Опубликованные
файлы побайтно совпадают со сборкой release SHA. Реальный owner smoke остаётся
отдельным этапом после выпуска.

### Проверка

Выполнить frozen install, production audit с порогом moderate, проверку точных
версий уязвимых зависимостей, корневые тесты, contract/runtime/widget/plugin,
security и privacy suites, сборки, воспроизводимую упаковку, валидатор плагина,
временную clean-room установку/обновление, валидаторы репозитория, PR checks,
CodeQL и независимый review точного head. После публикации скачать и побайтно
сравнить материалы выпуска.

### Ограничения

Не изменять установленный плагин владельца, не запускать очистку реального Mac,
не закрывать dependency alerts вручную, не выполнять merge/tag/publish до
зелёных gates и не обещать исправление внутренних дефектов хоста Codex.

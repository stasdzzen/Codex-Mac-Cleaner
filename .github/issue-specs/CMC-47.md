```cto-issue
schema: 1
dependencies: #88
conflicts: none
touched_paths: .github/issue-specs/CMC-47.md; SPEC.md; docs/decisions/ADR-0020-bounded-dashboard-pagination.md; docs/decisions/index.md; docs/index.md; docs/contracts/mcp-tools.md; docs/architecture/components.md; docs/architecture/runtime-flows.md; docs/product/requirements-traceability.md; packages/contracts/src/audit.ts; packages/contracts/src/tools.ts; packages/contracts/test/; apps/mcp-server/; apps/widget/; .codex-plugin/; scripts/package-release.mjs; scripts/release-license-metadata.mjs; tests/plugin/; tests/security/
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Replace oversized all-findings responses with real server pagination and a bounded Dashboard v3 that loads safe pages on demand without losing findings or exposing paths.

### Scope

Add ADR-0020. Limit `audit_results` to 100 model-safe findings and 512 KiB of serialized findings per call with a server-validated opaque cursor bound to audit, immutable revision and normalized filters. Make `dashboard_open` return server-owned aggregates plus a bounded first model page and an independent first widget-safe page in `_meta`. Add an app-visible read-only `dashboard_page` tool for subsequent widget-safe pages. Move the breaking resource contract to `ui://codex-mac-cleaner/dashboard-v3.html`. Update the package boundary and MCP App specification.

### Acceptance criteria

No results or Dashboard page returns more than 100 findings or 512 KiB of serialized findings. All 2767 synthetic findings can be traversed in deterministic order without a multi-megabyte single response, gaps or duplicates. Cursor tampering, cross-channel reuse, filter mismatch and stale bindings fail closed. The page tool is app-only. Paths, identities, secrets, tokens and mutation authority remain server-only. The UI shows server-owned total and support-level aggregates, loads another page only after user action and preserves one-object actions. No bulk or automatic cleanup is added.

### Verification

Run RED→GREEN contracts/runtime/widget tests, a 2767-finding regression, cursor tampering and payload-size checks, plugin clean-room, privacy/security suites, builds, root checks and repository validators.

### Constraints

Do not add HTTP/local-site fallbacks, persisted raw reports, model-visible bulk tools, automatic page draining, automatic cleanup, classifier changes or real-Mac cleanup tests. Do not redefine Dashboard v2.

## Русский

### Цель

Не передавать тысячи находок одним MCP-ответом. Сделать настоящую серверную пагинацию и bounded Dashboard v3, который по запросу пользователя загружает безопасные страницы без потери находок и раскрытия путей.

### Объём

Добавить ADR-0020. `audit_results` возвращает не более 100 model-safe находок и 512 КиБ сериализованного массива за вызов и opaque cursor, привязанный к audit, immutable revision и нормализованным filters. `dashboard_open` возвращает server-owned агрегаты, bounded первую model-страницу и независимую первую widget-safe страницу в `_meta`. Остальные widget-safe страницы отдаёт новый app-visible read-only tool `dashboard_page`; модель его не видит. Новый ресурс получает URI `ui://codex-mac-cleaner/dashboard-v3.html`. Синхронизировать package boundary и спецификацию MCP App.

### Критерии приёмки

Ни `audit_results`, ни страница Dashboard не возвращают более 100 findings или 512 КиБ сериализованного массива. Все 2767 synthetic findings обходятся в детерминированном порядке без многомегабайтного единичного ответа, пропусков и дублей. Подмена cursor, использование между model/widget каналами, несовпадение filters и stale binding завершаются fail closed. `dashboard_page` остаётся app-only. Пути, identities, secrets, tokens и mutation authority не выходят за server boundary. UI показывает server-owned total и агрегаты по support level, загружает следующую страницу только по нажатию пользователя и сохраняет поэлементные действия. Bulk и автоматическая очистка не добавляются.

### Проверка

Выполнить RED→GREEN contract/runtime/widget тесты, regression на 2767 synthetic findings, проверки cursor tampering и размера payload, plugin clean-room, privacy/security suites, сборки, корневые проверки и валидаторы репозитория.

### Ограничения

Не добавлять HTTP/local-site fallback, persisted raw report, model-visible bulk tools, автоматическую выгрузку всех страниц, автоматическую очистку, изменения классификатора или тесты очистки реального Mac. Dashboard v2 не переопределять.

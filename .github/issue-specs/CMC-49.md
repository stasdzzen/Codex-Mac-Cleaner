```cto-issue
schema: 1
dependencies: #90
conflicts: none
touched_paths: .github/issue-specs/CMC-49.md; package.json; scripts/probe-plugin-surface.mjs; tests/plugin/plugin-surface-probe.test.ts; docs/index.md; docs/log.md; docs/development/audit-runtime-troubleshooting.md; docs/quality/plugin-capability-matrix.md; docs/quality/test-strategy.md; docs/quality/acceptance-gates.md; docs/product/requirements-traceability.md
risk: medium
parallel_safety: safe
execution_profile: default
```

## English

### Goal

Prevent regressions of the beta.11 native-tool, terminal-revision and
bounded-Dashboard fixes by making the operational response and packaged plugin
surface directly verifiable.

### Scope

Synchronize the canonical log and requirements traceability through CMC-48, add
a privacy-safe audit runtime troubleshooting runbook, add a capability matrix
mapping the Skill, model-visible tools, app-only tools and Dashboard resource,
and add a read-only packaged stdio probe. The probe must validate the exact 9
model-visible and 15 app-only tools, their visibility metadata, Dashboard v3
URI/MIME/CSP boundary and the absence of HTTP/terminal fallback in the plugin
launch contract. Add a plugin test that executes the probe. Update the test
strategy and Gate H with the beta.11 regressions.

Use the useful verification patterns found in `nexu-io/codex-slides` without
adopting its Browser-first local HTTP server, runtime build/install, large
model-visible tool surface or persisted raw project-state design.

### Acceptance criteria

The canonical log contains the decisions and incidents through 2026-07-23.
CMC-48 is marked closed and released. The runbook maps missing native tools,
nullable running revision, exact terminal revision, process loss/AUDIT_STALE
and oversized-response prevention to a fail-closed operator response without
terminal, direct stdio, local HTML or automatic rescan. The capability matrix
exactly matches the packaged plugin surface. The standalone probe passes
against the repository plugin root and fails on tool/resource/visibility drift.
Root, plugin, repository and diff checks pass.

### Verification

Run the standalone probe, its focused plugin test, `pnpm check`, the full
`tests/plugin` suite, repository validators and `git diff --check` on the final
head.

### Constraints

Do not modify the audit/classifier/policy/quarantine runtime, bundled
Dashboard/runtime assets, plugin version, release artifacts or owner-installed
plugin. Do not persist raw audit identities, add HTTP/terminal fallbacks, add
automatic rescan, create a new ADR, merge or publish a release.

## Русский

### Цель

Не допустить регрессии исправлений beta.11 — штатного получения инструментов,
точной завершённой ревизии и bounded Dashboard — за счёт явного
эксплуатационного контракта и проверяемой поверхности упакованного плагина.

### Объём

Синхронизировать журнал канона и трассировку требований до CMC-48, добавить
privacy-safe runbook диагностики аудита, матрицу соответствия Skill,
model-visible tools, app-only tools и Dashboard resource, а также read-only
probe упакованного stdio-плагина. Probe проверяет точные 9 model-visible и 15
app-only инструментов, metadata видимости, URI/MIME/CSP Dashboard v3 и
отсутствие HTTP/terminal fallback в контракте запуска. Добавить plugin-test,
который выполняет probe. Дополнить стратегию тестирования и Gate H регрессиями
beta.11.

Из `nexu-io/codex-slides` использовать только полезные паттерны проверки
поверхности. Не переносить Browser-first локальный HTTP-сервер, runtime
build/install, широкую model-visible поверхность или сохранение raw project
state.

### Критерии приёмки

Журнал канона содержит решения и инциденты до 23 июля 2026 года. CMC-48
отмечена закрытой с опубликованным выпуском. Runbook связывает отсутствие native
tools, nullable revision во время работы, exact terminal revision, потерю
процесса/AUDIT_STALE и защиту от oversized response с fail-closed реакцией без
terminal, direct stdio, local HTML и автоматического повтора аудита. Матрица
точно совпадает с packaged plugin surface. Отдельный probe проходит на корне
репозитория и падает при drift tools/resource/visibility. Корневые, plugin,
repository и diff-проверки зелёные.

### Проверка

Запустить самостоятельный probe, его focused plugin-test, `pnpm check`, полный
`tests/plugin`, repository validators и `git diff --check` на финальном head.

### Ограничения

Не менять runtime аудита/classifier/policy/quarantine, собранные
Dashboard/runtime assets, версию плагина, release artifacts и установленный
плагин владельца. Не сохранять raw audit identities, не добавлять HTTP/terminal
fallback, автоматический повтор аудита или новый ADR, не выполнять merge и не
публиковать выпуск.

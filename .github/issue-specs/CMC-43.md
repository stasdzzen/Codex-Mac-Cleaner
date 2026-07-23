```cto-issue
schema: 1
dependencies: #78
conflicts: #80
touched_paths: .github/issue-specs/CMC-43.md; SPEC.md; docs/index.md; docs/decisions/ADR-0019-complete-audit-without-overall-deadline.md; docs/architecture/components.md; docs/architecture/runtime-flows.md; docs/contracts/errors.md; docs/safety/threat-model.md; docs/product/PRD-codex-mac-cleaner.md; docs/product/implementation-roadmap.md; docs/product/requirements-traceability.md; packages/contracts/src/errors.ts; packages/adapters/src/command-runner.ts; packages/adapters/src/macos-production-correlation.ts; apps/mcp-server/src/runtime.ts; apps/mcp-server/test/runtime-services.test.ts; apps/mcp-server/test/plugin-integration.test.ts; .codex-plugin/runtime/server.js; tests/plugin/plugin-contract.test.ts
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Complete every discovered audit candidate without an automatic whole-run deadline,
so a large real-Mac audit reaches a full immutable result instead of failing after
five minutes.

### Scope

Supersede only the whole-run deadline decision in ADR-0018 with ADR-0019. Remove
the five-minute audit timer, the runtime timeout option and the current
`AUDIT_TIMEOUT` product error. Keep bounded candidate concurrency, deterministic
result order, Snapshot A/B, source coverage semantics and explicit `audit_cancel`.
Keep bounded timeouts for individual macOS commands: one failed or timed-out source
query becomes a safe coverage gap and the audit continues, rather than aborting
the complete run. Rebuild the checked-in plugin runtime and update canonical
documentation and regression tests.

### Acceptance criteria

A running audit is never cancelled or failed because of elapsed wall-clock time.
All discovered candidates are processed before a completed immutable revision is
published. Explicit user cancellation remains cooperative and terminal
`cancelled`; cancellation, source gaps and internal errors never expose partial
actionable findings. A delayed candidate test remains running beyond a formerly
injected deadline and then completes after the dependency resolves. The packaged
runtime contains no five-minute whole-audit timer or `AUDIT_TIMEOUT` branch.
Per-command safety timeouts, bounded concurrency eight and server-owned progress
remain intact.

### Verification

Run focused MCP runtime and plugin integration tests, contract and plugin
regression tests, rebuild the packaged runtime, run root `pnpm check`,
plugin/security suites, repository policy checks, deterministic package
verification and `git diff --check`. Require all Pull Request checks and CodeQL
green before merge. The separate owner real-Mac audit remains a post-release manual
gate and is not executed in this Issue.

### Constraints

Do not change protected scopes, correlation/classification/policy decisions,
mutation authority, quarantine behavior, tool inputs, Dashboard design, package
version or release tag. Do not merge, publish, reinstall the owner's plugin, run a
real-Mac audit or clean the Mac. Do not replace the removed whole-run deadline
with another hard or soft automatic limit.

## Русский

### Цель

Обрабатывать все найденные кандидаты без автоматического общего лимита времени,
чтобы большой аудит реального Mac завершался полным неизменяемым результатом, а не
падал через пять минут.

### Объём

Новым ADR-0019 заменить только решение ADR-0018 об общем таймере аудита. Удалить
пятиминутный таймер всего запуска, runtime-настройку этого таймера и текущую
продуктовую ошибку `AUDIT_TIMEOUT`. Сохранить ограниченную параллельность кандидатов,
детерминированный порядок результатов, Snapshot A/B, семантику покрытия источников
и явную команду `audit_cancel`. Сохранить защитные таймауты отдельных системных
команд macOS: недоступный или зависший запрос одного источника становится
безопасным пробелом покрытия, а аудит продолжает работу и не обрывается целиком.
Пересобрать отслеживаемый runtime плагина, обновить канонические документы и
регрессионные тесты.

### Критерии приёмки

Аудит не отменяется и не получает ошибку из-за прошедшего времени. До публикации
завершённой immutable revision обрабатываются все найденные кандидаты. Явная отмена
пользователя остаётся кооперативной и переводит запуск в `cancelled`; отмена,
пробелы источников и внутренние ошибки не открывают частичные изменяющие действия.
Тест с задержанным кандидатом остаётся в состоянии `running` дольше прежнего
внедряемого порога и завершается после продолжения зависимости. В собранном
runtime отсутствуют пятиминутный общий таймер и ветка `AUDIT_TIMEOUT`. Таймауты
отдельных системных команд, bounded concurrency восемь и server-owned progress
сохраняются.

### Проверка

Запустить целевые тесты runtime MCP и интеграции плагина, контрактные и plugin
regression tests, пересобрать packaged runtime, выполнить корневой `pnpm check`,
наборы plugin/security, проверки политики репозитория, проверку воспроизводимого
пакета и `git diff --check`. До слияния потребовать зелёные проверки Pull Request
и CodeQL. Отдельная ручная проверка полного аудита владельцем на реальном Mac
остаётся последующим gate и в этой Issue не запускается.

### Ограничения

Не менять protected scopes, решения correlation/classifier/policy, полномочия
mutation, поведение карантина, входы tools, дизайн Dashboard, версию пакета и
release tag. Не выполнять merge, публикацию, переустановку плагина владельца,
реальный аудит или очистку Mac. Не заменять удалённый общий deadline другим
жёстким или мягким автоматическим лимитом.

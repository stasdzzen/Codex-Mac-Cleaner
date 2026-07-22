```cto-issue
schema: 1
dependencies: #66
conflicts: none
touched_paths: .github/issue-specs/; SPEC.md; docs/architecture/; docs/contracts/; docs/decisions/; docs/product/; docs/safety/; packages/adapters/; apps/mcp-server/; apps/widget/; tests/plugin/; tests/security/; .codex-plugin/assets/; .codex-plugin/runtime/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Restore a useful Real-Mac `application_remnants` audit after beta.6 timed out twice, and make Dashboard storage values readable in MB/GB.

### Scope

Fix the production bottleneck evidenced by Codex task `019f8930-713c-70c1-b547-9e1c3c08ea88`: audit `audit-8b2b18e1-de94-47f3-a927-faf36bb6d620` failed at 2,044/2,766 and retry `audit-52f7eacd-d8f3-4445-8a94-21af1e5982c0` failed at 2,016/2,766 with `AUDIT_TIMEOUT`. Replace the disproven concurrency-four production assumption with a measured fixed bound of eight while retaining A/B receipt revalidation, deterministic ordering, cancellation and the five-minute deadline. Render every byte-valued Dashboard metric in decimal MB or GB. Restore useful local-only component presentation and read-only orphaned-autostart diagnostics from the original concept without exposing full paths or app inventory to the model and without enabling system mutation.

### Acceptance criteria

The packaged runtime defaults to at most eight concurrent candidate correlations, captures global package inventory at most once per A/B phase, keeps candidate-specific `pkgutil --file-info` A/B checks, deterministic result order and common-signal cancellation, and still fails closed with no revision on timeout. A deterministic 2,766-candidate throughput regression proves the new bound can finish under the unchanged five-minute budget at the observed per-candidate cost model. All Dashboard storage values use only `MB`/`GB` units with decimal conversion and safe handling below 0.01 MB. Model-visible findings retain generic safe labels; widget-only metadata may show a sanitized top-level component label but never a full path, installed-app inventory, bundle/package/signing claim, token or secret. Missing-target user LaunchAgents are shown as analysis-only diagnostics; missing-target system LaunchAgents/LaunchDaemons, including a daemon target under PrivilegedHelperTools, are unsupported-manual diagnostics. A standalone helper is never classified by name alone. An active user process whose absolute executable has an exact `ENOENT` is an analysis-only diagnostic; other-owner processes are unsupported-manual. PID/path stay server-only, activity/open files remain blocking counter-evidence, and no process receives terminate or cleanup actions. No autostart/system finding receives quarantine, delete, disable or shell actions.

### Verification

Add RED-to-GREEN runtime, adapter, widget and privacy tests for the two Real-Mac timeout counts, the 2,766-candidate throughput model, maximum concurrency eight, deterministic ordering, cancellation, MB/GB formatting, model/widget label separation and read-only autostart diagnostics. Rebuild the autonomous Dashboard and plugin runtime. Run root typecheck/tests, security/plugin suites, deterministic package verification, repository validators and diff checks. Owner Real-Mac smoke remains a separate gate.

### Constraints

Do not increase/remove the five-minute deadline, truncate candidates, skip Snapshot A/B receipt validation, turn incomplete coverage into complete, expose raw paths/inventory/identity, add telemetry/network/sudo, mutate LaunchAgents/LaunchDaemons/helpers, clean this Mac, merge, release or publish. The current #67 draft remains unmerged and this Issue is stacked on it.

## Русский

### Цель

Восстановить полезный Real-Mac аудит `application_remnants` после двух тайм-аутов beta.6 и сделать размеры Dashboard читаемыми в МБ/ГБ.

### Объём

Исправить production bottleneck, подтверждённый задачей Codex `019f8930-713c-70c1-b547-9e1c3c08ea88`: аудит `audit-8b2b18e1-de94-47f3-a927-faf36bb6d620` завершился `AUDIT_TIMEOUT` на 2 044/2 766, повтор `audit-52f7eacd-d8f3-4445-8a94-21af1e5982c0` — на 2 016/2 766. Заменить опровергнутое production-предположение concurrency четыре на измеренную фиксированную границу восемь, сохранив A/B-проверку receipts, детерминированный порядок, cancellation и пятиминутный deadline. Показывать все byte-метрики Dashboard только в десятичных МБ или ГБ. Вернуть полезное локальное отображение компонентов и read-only диагностику осиротевшего автозапуска из исходной концепции без передачи модели полного пути/app inventory и без системных mutation.

### Критерии приёмки

Packaged runtime по умолчанию выполняет не более восьми candidate correlations одновременно, снимает глобальный package inventory максимум один раз на фазу A/B, сохраняет candidate-specific `pkgutil --file-info` в обеих фазах, порядок результатов, общий cancellation signal и прежний fail-closed timeout без revision. Детерминированная regression на 2 766 candidates доказывает завершение в неизменном пятиминутном бюджете при наблюдаемой модели стоимости. Все размеры Dashboard используют только `МБ`/`ГБ` и десятичное преобразование, включая безопасный вывод значений меньше 0,01 МБ. Model-visible finding сохраняет generic safe label; widget-only metadata может показать очищенное имя верхнеуровневого компонента, но не полный путь, установленный app inventory, bundle/package/signing claims, token или secret. User LaunchAgent с отсутствующим target отображается только как analysis-only diagnostic; системные LaunchAgents/LaunchDaemons с отсутствующим target, включая daemon target в PrivilegedHelperTools, — только unsupported-manual. Отдельный helper никогда не классифицируется только по имени. Активный user process, чей абсолютный executable возвращает точный `ENOENT`, становится analysis-only diagnostic; процесс другого OS owner — unsupported-manual. PID/путь остаются server-only, активность/open files блокируют mutation, terminate и cleanup actions отсутствуют. Autostart/system findings не получают quarantine, delete, disable или shell actions.

### Проверка

Добавить RED-to-GREEN runtime, adapter, widget и privacy tests для двух Real-Mac timeout counts, throughput-модели 2 766 candidates, максимальной concurrency восемь, порядка, cancellation, формата МБ/ГБ, разделения model/widget labels и read-only autostart diagnostics. Пересобрать автономный Dashboard и plugin runtime. Запустить root typecheck/tests, security/plugin suites, deterministic package verification, repository validators и diff checks. Owner Real-Mac smoke остаётся отдельным gate.

### Ограничения

Не увеличивать и не удалять пятиминутный deadline, не обрезать candidates, не пропускать Snapshot A/B receipt validation, не превращать incomplete coverage в complete, не раскрывать raw paths/inventory/identity, не добавлять telemetry/network/sudo, не изменять LaunchAgents/LaunchDaemons/helpers, не очищать этот Mac, не выполнять merge/release/publication. Текущий draft #67 остаётся неслитым; эта Issue строится поверх него.

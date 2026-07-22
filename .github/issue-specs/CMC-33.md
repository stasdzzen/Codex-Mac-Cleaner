```cto-issue
schema: 1
dependencies: #60
conflicts: none
touched_paths: .github/issue-specs/; SPEC.md; docs/architecture/; docs/product/; packages/adapters/; apps/mcp-server/; tests/security/; tests/plugin/; .codex-plugin/runtime/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Make large application_remnants audits complete within the existing five-minute server deadline without reducing coverage or weakening fail-closed safety.

### Scope

Fix the production bottleneck evidenced by owner audit audit-83ab409b-a94a-49b8-9d62-0794f1f94115, which timed out after 947 of 2,766 candidates. Reuse the canonical package inventory once per Snapshot A/B phase instead of running pkgutil --pkgs for every candidate, process candidate correlations with fixed bounded concurrency four, preserve deterministic result order and progress, and serialize owner-binding-history updates.

### Acceptance criteria

The five-minute deadline remains unchanged. Candidate discovery is not truncated and no Library category is silently skipped. Global package inventory is captured at most once per phase, candidate-specific file-info remains A/B revalidated, no more than four candidates are processed concurrently, results keep input order, cancellation aborts active work, and history writes cannot lose concurrent records. Timeout still produces failed/AUDIT_TIMEOUT with no actionable revision. A deterministic multi-candidate regression that deadlocks under serial processing completes with bounded concurrency. Owner Real-Mac smoke remains a separate post-release gate.

### Verification

Add RED to GREEN adapter and runtime tests for package inventory call counts, candidate concurrency bounds, deterministic ordering, cancellation, history merge and timeout semantics. Run focused adapter/runtime tests, root pnpm check, security/plugin suites, widget and plugin builds, deterministic package verification, repository validators and diff checks on the final SHA.

### Constraints

Do not increase or remove the server deadline. Do not truncate candidates, convert partial coverage to complete, weaken Snapshot A/B, skip receipt validation, expose paths or command output, add network access, mutate user files, change cleanup policy or merge/release/publish. Automated tests must use synthetic fixtures; no real Mac cleanup.

## Русский

### Цель

Обеспечить завершение больших аудитов application_remnants в существующем пятиминутном server deadline без сокращения покрытия и ослабления fail-closed безопасности.

### Объём

Исправить production bottleneck, доказанный аудитом владельца audit-83ab409b-a94a-49b8-9d62-0794f1f94115, который остановился после 947 из 2 766 кандидатов. Переиспользовать канонический package inventory один раз на фазу Snapshot A/B вместо запуска pkgutil --pkgs для каждого кандидата, обрабатывать candidate correlations с фиксированной bounded concurrency четыре, сохранять детерминированный порядок результатов и прогресс, сериализовать обновления owner-binding history.

### Критерии приёмки

Пятиминутный deadline не меняется. Candidate discovery не обрезается, ни одна Library category молча не пропускается. Глобальный package inventory снимается не более одного раза на фазу, candidate-specific file-info повторно проверяется в A/B, одновременно обрабатываются не более четырёх кандидатов, результаты сохраняют входной порядок, cancellation отменяет активную работу, history writes не теряют конкурентные записи. Timeout по-прежнему даёт failed/AUDIT_TIMEOUT без actionable revision. Детерминированная multi-candidate regression, которая блокируется при последовательной обработке, завершается с bounded concurrency. Owner Real-Mac smoke остаётся отдельным post-release gate.

### Проверка

Добавить RED to GREEN adapter и runtime tests для количества package inventory calls, границы candidate concurrency, детерминированного порядка, cancellation, history merge и timeout semantics. Запустить focused adapter/runtime tests, корневой pnpm check, security/plugin suites, сборки widget и plugin, deterministic package verification, repository validators и diff checks на финальном SHA.

### Ограничения

Не увеличивать и не удалять server deadline. Не обрезать candidates, не превращать partial coverage в complete, не ослаблять Snapshot A/B, не пропускать receipt validation, не раскрывать paths или command output, не добавлять сеть, не изменять пользовательские файлы, cleanup policy и не выполнять merge/release/publication. Automated tests используют только synthetic fixtures; real Mac cleanup запрещена.

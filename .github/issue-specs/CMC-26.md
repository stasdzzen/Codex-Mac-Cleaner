```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: .github/issue-specs/; docs/decisions/; docs/architecture/; docs/contracts/; docs/product/; skills/; packages/contracts/; packages/adapters/; packages/policy/; apps/mcp-server/; apps/widget/; .codex-plugin/; scripts/; tests/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Make the application_remnants audit visibly start inside Codex and complete within a bounded, observable pipeline instead of remaining at an opaque 0/1 state.

### Scope

Add an ADR for a live pre-result Dashboard v2. Allow dashboard_open to return a safe non-actionable snapshot while an audit is queued, running, cancelling, cancelled or failed; make the plugin skill open it immediately after audit_start; let the App poll server-owned status and render stage-aware progress. Refactor runtime collection so global macOS inventories are captured once per audit phase and reused across candidates, and bound expensive filesystem traversal without weakening fail-closed protected-scope, correlation or mutation rules.

### Acceptance criteria

Dashboard appears immediately after audit_start and visibly shows queued/running progress, current safe phase, cancellation and terminal failure/warning state. Pre-result snapshots contain no findings or mutation actions and have no actionable revision. Progress advances with real server work and never remains a fabricated 0/1 counter for the full run. A multi-candidate regression proves global inventories are not recollected per candidate. Cancellation remains cooperative. No path, secret, raw identity, command or token becomes model-visible or widget-visible.

### Verification

Run contract, runtime, adapter, widget, plugin clean-room, privacy, policy, quarantine and repository gates on the final head. Add RED to GREEN tests for opening revision-null Dashboard at start, App status polling, stage progress, shared phase inventories, bounded failure and cancellation. Do not use a real Mac cleanup as automated evidence.

### Constraints

Do not weaken protected scopes, server-owned correlation, complete-coverage requirements, per-object confirmation or quarantine semantics. Do not add bulk actions, shell commands, sudo, TCC bypasses or automatic cleanup. Do not merge, tag, release or publish in this Issue.

## Русский

### Цель

Сделать запуск аудита application_remnants видимым внутри Codex и обеспечить ограниченный, наблюдаемый конвейер вместо непрозрачного состояния 0/1.

### Объём

Добавить ADR для живого Dashboard v2 до появления результатов. Разрешить dashboard_open возвращать безопасный snapshot без действий, пока аудит queued, running, cancelling, cancelled или failed; открывать Dashboard из skill сразу после audit_start; дать App возможность опрашивать server-owned status и показывать прогресс по фазам. Переработать runtime так, чтобы глобальные macOS inventories снимались один раз на фазу аудита и переиспользовались между кандидатами, а дорогое filesystem-сканирование имело строгие границы без ослабления fail-closed protected scope, correlation и mutation правил.

### Критерии приёмки

Dashboard появляется сразу после audit_start и визуально показывает queued/running прогресс, безопасное название текущей фазы, отмену и terminal failure/warning. Snapshot до результатов не содержит находок и mutation actions и не имеет actionable revision. Прогресс отражает реальную работу сервера и не остаётся фиктивным 0/1 на весь запуск. Multi-candidate regression доказывает, что глобальные inventories не собираются заново для каждого кандидата. Отмена остаётся кооперативной. Полные пути, секреты, raw identities, команды и tokens не попадают model-visible или widget-visible.

### Проверка

На финальном head запустить contract, runtime, adapter, widget, plugin clean-room, privacy, policy, quarantine и repository gates. Добавить RED to GREEN тесты для открытия Dashboard с revision=null при старте, App polling статуса, пофазного прогресса, shared phase inventories, bounded failure и отмены. Не использовать реальную очистку Mac как автоматизированное доказательство.

### Ограничения

Не ослаблять protected scopes, server-owned correlation, требования полного покрытия, пообъектное подтверждение и семантику карантина. Не добавлять bulk actions, shell-команды, sudo, обход TCC или автоматическую очистку. Не выполнять merge, tag, release или публикацию в этой Issue.

```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: SPEC.md; docs/; .github/issue-specs/; .codex-plugin/; apps/mcp-server/; apps/widget/; packages/contracts/; packages/storage/; packages/policy/; packages/adapters/; scripts/; skills/; tests/security/; tests/plugin/; pnpm-lock.yaml
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Make the audit result understandable and resumable across Codex tasks while repairing the production exclusion path and preserving per-object mutation safety.

### Scope

Add the approved ADR and synchronized contracts; persist the latest immutable completed audit revision in protected local Application Support state; reconnect production runtime to keyed exclusions and fail-closed corrupt-state handling; expose grouped dashboard rows for cache and removed-application remnants; move the compact findings register to Overview; add quarantine actions and a sequentially confirmed quarantine-emptying flow; implement a host-capability-aware Expand/Collapse toggle; remove obsolete dashboard/widget paths and detached production code proven unused by tests.

### Acceptance criteria

The dashboard reopens the latest completed audit after a new Codex task or MCP process without silently starting a new audit. Persisted state uses versioned validation, atomic writes and 0700/0600 permissions; stale files remain visible but cannot reuse mutation authority. While an audit runs, the standalone disk-space card is hidden. Available disk space appears compactly in the header. After completion, Overview shows a bounded, viewport-sized, grouped table: caches are summarized as cleanup groups and removed-application remnants are grouped by application; the separate Findings tab is absent. Every actionable group offers an explicit quarantine action that expands to individually policy-authorized objects and never converts analysis-only cache into a mutation. Quarantine offers an empty action implemented as sequential confirmation and per-entry purge, with partial failures visible and no one-click bulk authority. The display button reads Expand or Collapse according to observed host mode and never closes an expanded dashboard when an audit finishes. Unknown/corrupt exclusion state keeps findings visible and blocks destructive authorization; runtime uses the keyed exclusion store/matcher. Production and test widget entrypoints are unified; obsolete duplicate bundles and unused detached production code are removed only with usage and regression evidence. The 2,767-item audit class stays bounded and usable without multi-megabyte tool responses.

### Verification

Add RED-to-GREEN contract, migration, persistence/restart, stale-authority, exclusion, grouping, pagination, host-display, widget interaction, quarantine and security tests. Run focused tests, root `pnpm check`, security/plugin suites, widget and MCP builds, deterministic package verification, repository validators and `git diff --check` on the final SHA. Obtain independent review of the exact head.

### Constraints

Do not weaken protected scopes, private-regenerable-remnant evidence, per-object policy authorization or confirmation. Do not implement one-confirmation permanent bulk purge, auto-clean, client-owned paths/identities, cloud sync, telemetry or a hidden scheduler. Do not mutate the real Mac, install or publish the plugin, tag, release, merge or self-approve the PR.

## Русский

### Цель

Сделать результат аудита понятным и доступным между задачами Codex, исправив production-путь исключений и сохранив безопасность файловых действий по каждому объекту.

### Объём

Добавить утверждённый ADR и синхронизированные контракты; сохранять последнюю immutable завершённую ревизию аудита в защищённом локальном Application Support state; подключить production runtime к keyed exclusions и fail-closed обработке повреждённого state; выдавать сгруппированные строки Dashboard для кешей и остатков удалённых приложений; перенести компактный реестр находок на «Обзор»; добавить действия карантина и последовательное подтверждение полной очистки карантина; реализовать capability-aware переключатель «Развернуть»/«Свернуть»; удалить устаревшие dashboard/widget пути и доказанно неиспользуемый production-код.

### Критерии приёмки

Dashboard открывает последнюю завершённую ревизию после новой задачи Codex или нового MCP-процесса и сам не запускает новый аудит. Persisted state имеет версионируемую валидацию, атомарную запись и права 0700/0600; устаревшие файлы остаются видимыми, но не переиспользуют mutation authority. Во время аудита отдельная карточка места на диске скрыта. Доступное место компактно показано в шапке. После завершения «Обзор» содержит ограниченную по высоте сгруппированную таблицу: кеши объединены в понятные группы очистки, а остатки удалённых приложений — по приложению; отдельной вкладки «Находки» нет. Каждая actionable-группа предлагает явное перемещение в карантин, раскрывается в отдельно разрешённые policy engine объекты и никогда не превращает analysis-only кеш в mutation. В карантине есть очистка через последовательные подтверждения и поэлементный purge; частичные ошибки видимы, общей однокнопочной mutation-authority нет. Кнопка отображения называется «Развернуть» или «Свернуть» по наблюдаемому режиму host и завершение аудита не закрывает развёрнутый Dashboard. Unknown/corrupt exclusion state не скрывает findings и блокирует destructive authorization; runtime использует keyed exclusion store/matcher. Production и test widget entrypoints объединены; устаревшие дубли bundles и неиспользуемый production-код удаляются только с usage- и regression-доказательствами. Аудит класса 2 767 объектов остаётся bounded и удобным без многомегабайтных tool-ответов.

### Проверка

Добавить RED→GREEN contract, migration, persistence/restart, stale-authority, exclusion, grouping, pagination, host-display, widget interaction, quarantine и security-тесты. Запустить focused tests, root `pnpm check`, security/plugin suites, сборки widget и MCP, deterministic package verification, repository validators и `git diff --check` на финальном SHA. Получить независимую проверку точного head.

### Ограничения

Не ослаблять protected scopes, доказательство private-regenerable-remnant, пообъектную policy authorization и подтверждение. Не добавлять необратимый bulk purge с одним подтверждением, auto-clean, client-owned paths/identities, cloud sync, telemetry или скрытое расписание. Не менять реальный Mac, не устанавливать и не публиковать плагин, не создавать tag/release, не выполнять merge и self-approve PR.

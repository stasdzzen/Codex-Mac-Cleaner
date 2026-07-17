```cto-issue
schema: 1
dependencies: #7, #8
conflicts: none
touched_paths: packages/contracts/; packages/storage/; packages/policy/; apps/mcp-server/; apps/widget/; tests/security/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement persistent identity-based user exclusions and the Exclusions management UI without weakening protected scopes.

### Scope

Add strict `UserExclusion` contracts, sequential schema migrations, atomic user-Application-Support storage, stable identity matching, audit prefiltering, pre-token exclusion checks, app-visible exclusion tools and the Exclusions tab defined in CMC-12.

### Acceptance criteria

Exclusions persist after restart in a 0700/0600 local state outside the repository and Codex state. Matching uses rule/type/normalized-target and applicable owner/bundle-package/signing identity, never a path alone. Replaced identity appears again. Matched exclusions are filtered before expensive analysis, increment only `excludedCount` and never receive destructive tokens. Unknown/corrupt schema does not hide findings and blocks token issuance. UI supports search/filter, date/reason, `Check again`, one-entry removal and separately confirmed reset-all with no raw path input.

### Verification

Run contract, migration, atomic-write/permission, matcher, server-tool, widget and excluded-finding security tests plus root `pnpm check` and `git diff --check` on the final SHA.

### Constraints

Do not modify built-in protected classes, accept client path/identity fields, add cloud sync/telemetry, implement scheduling, merge or release.

## Русский

### Цель

Реализовать постоянные identity-based пользовательские исключения и вкладку управления без ослабления protected scopes.

### Объём

Добавить строгие контракты `UserExclusion`, последовательные schema migrations, атомарное хранилище в user Application Support, stable identity matching, prefilter аудита, проверку exclusion до token, app-visible tools и вкладку «Исключения» из CMC-12.

### Критерии приёмки

Исключения переживают restart в локальном state с правами 0700/0600 вне репозитория и состояния Codex. Match использует rule/type/normalized-target и применимые owner/bundle-package/signing identity, но не один path. Заменённая identity снова видна. Совпавшее exclusion фильтруется до дорогого анализа, увеличивает только `excludedCount` и не получает destructive token. Unknown/corrupt schema не скрывает findings и блокирует token issuance. UI поддерживает search/filter, дату/reason, «Снова проверять», удаление одной записи и отдельно подтверждаемый reset all без raw path input.

### Проверка

Запустить contract, migration, atomic-write/permission, matcher, server-tool, widget и excluded-finding security tests, затем root `pnpm check` и `git diff --check` на финальном SHA.

### Ограничения

Не менять built-in protected classes, не принимать client path/identity fields, не добавлять cloud sync/telemetry, scheduling, merge или release.

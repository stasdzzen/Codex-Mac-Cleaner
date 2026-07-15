```cto-issue
schema: 1
dependencies: #4
conflicts: none
touched_paths: packages/evidence/; packages/classifier/; packages/policy/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement deterministic evidence normalization, named classification rules and an independent fail-closed server policy.

### Scope

Create evidence, classifier and policy packages, golden tests, the action matrix and property-based path tests defined in CMC-05.

### Acceptance criteria

No LLM or hidden score is used. Classification never grants actions. Risk categories remain analysis-only. Stale, incomplete, active, open-file, link, mount, ownership and path-boundary cases block mutation.

### Verification

Run golden, policy matrix, property-based and full root checks. Map every blocking case to a stable rule or error code.

### Constraints

Do not weaken the safety model, accept UI policy, add bypass flags, implement quarantine/UI, merge or release.

## Русский

### Цель

Реализовать deterministic evidence normalization, named classifier rules и независимую fail-closed server policy.

### Объём

Создать evidence, classifier и policy packages, golden tests, action matrix и property-based path tests из CMC-05.

### Критерии приёмки

LLM и hidden score отсутствуют. Classification не разрешает действия. Risk-категории analysis-only. Stale, incomplete, active, open-file, link, mount, owner и path boundary блокируют mutation.

### Проверка

Запустить golden, policy matrix, property-based tests и root check. Каждый блокирующий случай связан со стабильным rule/error code.

### Ограничения

Не ослаблять safety model, не доверять UI policy, не добавлять bypass, quarantine/UI, merge или release.

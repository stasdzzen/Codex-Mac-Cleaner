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

Implement deterministic evidence, name-resistant classification and immutable fail-closed protected-scope policy.

### Scope

Create evidence, classifier and policy packages, golden tests, the owner/evidence action matrix, immutable Protected Scope Registry and property-based path tests defined in CMC-05.

### Acceptance criteria

No LLM, hidden score or name-only classification is used. Owner identity, installed state, active/open-file state, receipt, dependencies, temporal evidence and data kind are evaluated separately. `~/APPS`, `~/.codex`, the protected product identities in ADR-0010, active Python.org 3.12 and every local Git project are server-side protected and return stable `PROTECTED_SCOPE` behavior; UI/config cannot bypass them and real bundle IDs are not guessed. Personal/sensitive data, secret flags, active-app caches, stale/incomplete/ownership/link/mount cases block mutation. `analysis_only` and `unsupported_manual` allow inspect only.

### Verification

Run golden, owner/evidence matrix, protected-scope, sensitivity, active-cache, property-based path and root checks. Map every block to a stable rule or error code.

### Constraints

Do not weaken safety, trust UI policy, add bypass flags or real local identities, implement quarantine/UI, merge or release.

## Русский

### Цель

Реализовать deterministic evidence, устойчивую к совпадению имени классификацию и неизменяемую fail-closed policy защищённых областей.

### Объём

Создать evidence, classifier и policy packages, golden tests, owner/evidence action matrix, immutable Protected Scope Registry и property-based path tests из CMC-05.

### Критерии приёмки

LLM, hidden score и name-only classification отсутствуют. Owner identity, installed state, active/open-file state, receipt, dependencies, temporal evidence и data kind проверяются отдельно. `~/APPS`, `~/.codex`, product identities ADR-0010, используемый Python.org 3.12 и любой локальный Git-проект защищены server-side и дают стабильный `PROTECTED_SCOPE`; UI/config не обходят правила, реальные bundle IDs не угадываются. Personal/sensitive data, secret flags, active-app cache, stale/incomplete/owner/link/mount cases блокируют mutation. `analysis_only` и `unsupported_manual` допускают только inspect.

### Проверка

Запустить golden, owner/evidence matrix, protected-scope, sensitivity, active-cache, property-based path и root checks. Каждый блок связан со стабильным rule/error code.

### Ограничения

Не ослаблять safety, не доверять UI policy, не добавлять bypass или реальные local identities, quarantine/UI, merge или release.

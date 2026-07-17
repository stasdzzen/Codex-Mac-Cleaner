```cto-issue
schema: 1
dependencies: #4
conflicts: none
touched_paths: packages/evidence/; packages/classifier/; packages/policy/; pnpm-lock.yaml
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement deterministic evidence, name-resistant classification and immutable fail-closed universal public-product policy.

### Scope

Create evidence, classifier and policy packages, golden tests, owner/evidence/action/removal-method matrix, universal immutable Protected Scope Registry, exclusion pre-token guard and property-based path tests defined in CMC-05.

### Acceptance criteria

No LLM, hidden score or name-only classification is used. Owner identity, installed state, active/open-file state, target existence, receipt, dependencies, temporal evidence and data kind are evaluated separately. Universal system/credential/browser-profile/personal/current-project/plugin/Codex classes and every local Git project are server-side protected; UI/config cannot bypass them and personal app/path rules are absent. A matched `UserExclusion` or applicable official uninstaller blocks preview; identity mismatch shows the finding again. Personal/sensitive data, active caches and stale/incomplete/ownership/link/mount cases block mutation. `analysis_only` and `unsupported_manual` allow inspect/exclude but no filesystem mutation.

### Verification

Run golden, owner/evidence/removal-method matrix, universal-protected-scope, exclusion, uninstaller, sensitivity, active-cache, property-based path and root checks. Map every block to a stable rule or error code.

### Constraints

Do not weaken safety, trust UI policy, add bypass flags or real local identities, implement quarantine/UI, merge or release.

## Русский

### Цель

Реализовать deterministic evidence, устойчивую к совпадению имени классификацию и неизменяемую fail-closed universal policy публичного продукта.

### Объём

Создать evidence, classifier и policy packages, golden tests, owner/evidence/action/removal-method matrix, universal immutable Protected Scope Registry, exclusion pre-token guard и property-based path tests из CMC-05.

### Критерии приёмки

LLM, hidden score и name-only classification отсутствуют. Owner identity, installed state, active/open-file state, target existence, receipt, dependencies, temporal evidence и data kind проверяются отдельно. Universal system/credential/browser-profile/personal/current-project/plugin/Codex classes и любой локальный Git-проект защищены server-side; UI/config не обходят правила, а персональные app/path rules отсутствуют. Совпавший `UserExclusion` или применимый official uninstaller блокирует preview; identity mismatch снова показывает finding. Personal/sensitive data, active cache, stale/incomplete/owner/link/mount cases блокируют mutation. `analysis_only` и `unsupported_manual` допускают inspect/exclude, но не filesystem mutation.

### Проверка

Запустить golden, owner/evidence/removal-method matrix, universal-protected-scope, exclusion, uninstaller, sensitivity, active-cache, property-based path и root checks. Каждый блок связан со стабильным rule/error code.

### Ограничения

Не ослаблять safety, не доверять UI policy, не добавлять bypass или реальные local identities, quarantine/UI, merge или release.

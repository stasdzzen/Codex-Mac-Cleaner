```cto-issue
schema: 1
dependencies: #4, #5, #12
conflicts: #9
touched_paths: docs/decisions/; docs/contracts/; docs/architecture/; docs/safety/; docs/quality/; docs/product/; docs/prompts/; docs/superpowers/specs/; docs/superpowers/plans/; docs/handoff/; docs/index.md; .github/issue-specs/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Approve the server-owned correlation identity and negative-evidence architecture required to connect Library candidates with installed applications, processes/open files, receipts and dependencies without name-only matching or model-visible private identifiers.

### Scope

Create the next ADR and canonical correlation contract; update components, runtime flows, safety/threat rules, quality gates, roadmap and traceability; define privacy-safe persistence, coverage and snapshot semantics; prepare the implementation specification, Worker prompt and follow-up implementation Issue that will unblock CMC-09.

### Acceptance criteria

The contract defines opaque correlation subjects/edges, source provenance, same-snapshot fingerprints, ambiguity handling and completeness certificates for negative evidence. Missing permission, unavailable capability, partial inventory or ambiguous identity always produce `unknown`, never `absent`. Raw paths, application inventory, bundle/package/signing identities, secrets and personal names never enter model-visible output, telemetry, fixtures or public evidence. Path-only and display-name matching cannot enable mutation. The ADR defines how CMC-09 resumes after the implementation dependency merges.

### Verification

Run repository documentation/frontmatter/link validators, Issue contract/policy tests and `git diff --check`; prove traceability from ADR through contracts, safety invariants, tests and the follow-up implementation Issue.

### Constraints

Architecture and documentation only. Do not implement runtime code, weaken fail-closed policy, modify or merge PR #34, run a Worker for the implementation, release, publish, or touch the real Mac cleanup state.

## Русский

### Цель

Утвердить server-owned correlation identity и архитектуру отрицательных evidence, необходимую для связи Library candidates с установленными приложениями, процессами/open files, receipts и dependencies без name-only сопоставления и без раскрытия приватных идентификаторов модели.

### Объём

Создать следующий ADR и канонический correlation contract; обновить components, runtime flows, safety/threat rules, quality gates, roadmap и traceability; определить privacy-safe persistence, coverage и snapshot semantics; подготовить implementation spec, Worker prompt и следующую implementation Issue, которая разблокирует CMC-09.

### Критерии приёмки

Контракт определяет opaque correlation subjects/edges, provenance источника, fingerprints одного snapshot, обработку неоднозначности и completeness certificates для negative evidence. Отсутствие permission, недоступная capability, частичный inventory или неоднозначная identity всегда дают `unknown`, а не `absent`. Raw paths, application inventory, bundle/package/signing identities, секреты и персональные имена не попадают в model-visible output, telemetry, fixtures или публичные evidence. Path-only и display-name matching не могут разрешать mutation. ADR определяет порядок возобновления CMC-09 после merge implementation dependency.

### Проверка

Запустить validators документации/frontmatter/links, Issue contract/policy tests и `git diff --check`; доказать traceability от ADR через contracts, safety-инварианты и тесты до следующей implementation Issue.

### Ограничения

Только архитектура и документация. Не реализовывать runtime-код, не ослаблять fail-closed policy, не изменять и не сливать PR #34, не запускать Worker реализации, не выполнять release/публикацию и не изменять реальное состояние очистки Mac.

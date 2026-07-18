```cto-issue
schema: 1
dependencies: #35
conflicts: #36
touched_paths: docs/decisions/; docs/contracts/; docs/architecture/; docs/safety/; docs/quality/; docs/product/; docs/foundation/; docs/prompts/; docs/superpowers/specs/; docs/superpowers/plans/; docs/handoff/; docs/index.md; docs/log.md; .github/issue-specs/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Approve the actionable user-Library remnant correlation architecture required to unblock CMC-21 without treating a cleanup artifact as an application bundle or weakening complete-negative evidence.

### Scope

Add ADR-0013 and update the correlation, domain, runtime, safety, quality and product canon. Separate the Library artifact from its owner application, define authoritative remnant ownership bindings and a versioned correlation requirement profile, separate artifact existence from owner executable state, distinguish receipt lifecycle and source applicability, define the narrow actionable v0.1 cache/log subset, and update CMC-21/CMC-09/CMC-10 specifications, plans, prompts and dependency handoff. Clarify the reversible action label as “Move to quarantine”. Do not implement runtime code or modify PR #38/#34.

### Acceptance criteria

LibraryArtifact and OwnerApplication are distinct server-only subject roles connected only by a resolved authoritative remnant_of edge. Path, basename, display name, bundle ID alone and user attestation are non-authoritative. Initial authoritative sources are exact package payload mapping, OS-owned container metadata, or an installation-local keyed historical binding created from a signed process/open-file relation. target_existence describes the Library artifact; owner executable state is separate. The private_regenerable_remnant_v1 profile permits one-object quarantine only for cache/log candidates with resolved owner binding, complete owner-app absence and activity/open/startup/uninstaller coverage, stable Snapshot A/B, known non-sensitive data and no protected scope. Receipt lifecycle distinguishes live, stale, absent and unknown. not_applicable is a server-owned profile decision, never a synonym for absent and never overrides positive evidence. All unsupported or ambiguous candidates remain inspect-only. The existing CMC-21 Worker/worktree/branch/PR remains the only implementation identity.

### Verification

Run repository documentation/frontmatter/link validators, Issue contract/policy tests, exact local/live Issue comparison and git diff --check. Prove traceability from ADR-0013 through contracts, safety invariants, tests and the amended CMC-21 plan, including a required production integration Library candidate that reaches orphaned and prepare_move without path/name-only authority.

### Constraints

Architecture and documentation only. Do not implement runtime, weaken protected/sensitive/coverage rules, modify or merge PR #38/#34, start another CMC-21 or CMC-09 Worker, release, publish or touch real-Mac cleanup state.

## Русский

### Цель

Утвердить архитектуру actionable-корреляции остатков в пользовательской Library, необходимую для разблокировки CMC-21 без подмены cleanup-артефакта приложением и без ослабления complete-negative evidence.

### Объём

Добавить ADR-0013 и обновить correlation/domain/runtime/safety/quality/product канон. Разделить Library-артефакт и приложение-владельца, определить authoritative binding остатка и версионированный профиль требований корреляции, отделить существование артефакта от состояния executable владельца, различить lifecycle receipt и применимость источников, определить узкий actionable-набор cache/log для v0.1 и обновить спецификации, планы, промпты и dependency handoff CMC-21/CMC-09/CMC-10. Уточнить название обратимого действия как «Переместить в карантин». Runtime-код и PR #38/#34 не менять.

### Критерии приёмки

LibraryArtifact и OwnerApplication являются разными server-only ролями subject и связываются только resolved authoritative edge remnant_of. Path, basename, display name, bundle ID по отдельности и user attestation не являются authority. Начальные authoritative-источники: exact package payload mapping, OS-owned container metadata либо installation-local keyed historical binding, созданный из signed process/open-file relation. target_existence описывает Library-артефакт; owner executable state существует отдельно. Профиль private_regenerable_remnant_v1 разрешает только поэлементный quarantine cache/log-кандидатов при resolved owner binding, полном доказательстве отсутствия owner app и activity/open/startup/uninstaller, стабильном Snapshot A/B, известном несекретном типе данных и отсутствии protected scope. Receipt lifecycle различает live, stale, absent и unknown. not_applicable является server-owned решением профиля, не означает absent и не отменяет positive evidence. Все unsupported или ambiguous candidates остаются inspect-only. Существующий Worker/worktree/branch/PR CMC-21 остаётся единственной implementation identity.

### Проверка

Запустить validators документации/frontmatter/links, Issue contract/policy tests, точное сравнение local/live Issue и git diff --check. Доказать трассировку от ADR-0013 через contracts, safety-инварианты и tests к обновлённому плану CMC-21, включая обязательный production integration с Library candidate, который получает orphaned и prepare_move без path/name-only authority.

### Ограничения

Только архитектура и документация. Не реализовывать runtime, не ослаблять protected/sensitive/coverage rules, не менять и не сливать PR #38/#34, не запускать другой CMC-21 или CMC-09 Worker, не выполнять release, публикацию или реальную очистку Mac.

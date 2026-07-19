```cto-issue
schema: 1
dependencies: #9
conflicts: none
touched_paths: docs/decisions/; docs/product/; docs/foundation/; docs/quality/; docs/superpowers/specs/; docs/prompts/; .github/issue-specs/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Defer host-native monthly audit automation from v0.1 without weakening cleanup, privacy, quarantine, no-terminal or no-hidden-scheduler safety invariants, and unblock the final security/release-evidence Issue CMC-10.

### Scope

Add a superseding ADR that keeps the existing schedule intent skeleton and honest disabled fallback but moves schedule creation/update/pause/resume/delete and scheduled-prompt behavior to a post-v0.1 capability release. Synchronize the PRD, roadmap, traceability, release checklist, quality/design references, prompts and local Issue specs. Update live Issues #10 and #13 to exactly match the approved dependency order and local specs.

### Acceptance criteria

CMC-10 no longer depends on CMC-13 and contains no claim that host automation lifecycle is implemented in v0.1. CMC-13 depends on CMC-10, is explicitly deferred and blocked until a later owner decision. The v0.1 UI may retain the Schedule tab only as an honest unavailable/manual-run fallback; it creates no automation, cron, LaunchAgent or hidden scheduler. Existing schedule schemas/intents remain inert compatibility groundwork and do not become release claims. All cleanup safety, protected-scope, redaction, one-object quarantine, restore/purge and owner-gate requirements remain unchanged. Canon, local Issue specs and live GitHub Issues agree.

### Verification

Run the OKF/documentation validators, Issue-contract validation for #10, #13 and this Issue, repository checks applicable to documentation, `git diff --check`, and compare live Issue bodies with local specs on the final SHA.

### Constraints

Do not implement scheduling or security runtime, weaken any safety invariant, publish, release, tag, mutate the real Mac, merge, or self-review.

## Русский

### Цель

Перенести нативную ежемесячную автоматизацию аудита за границу v0.1 без ослабления инвариантов очистки, privacy, карантина, no-terminal и запрета скрытого scheduler, а также разблокировать финальную Issue CMC-10 по security и release evidence.

### Объём

Добавить заменяющий ADR: сохранить существующий schedule-intent skeleton и честный disabled fallback, но перенести создание, update, pause, resume, delete automation и scheduled prompt в capability-релиз после v0.1. Синхронизировать PRD, roadmap, traceability, release checklist, quality/design references, промпты и локальные Issue-спеки. Обновить живые Issues #10 и #13 в точном соответствии с утверждённым порядком зависимостей и локальными спеками.

### Критерии приёмки

CMC-10 больше не зависит от CMC-13 и не заявляет реализацию host automation lifecycle в v0.1. CMC-13 зависит от CMC-10, явно отложена и заблокирована до будущего решения владельца. UI v0.1 может сохранять вкладку «Расписание» только как честный unavailable/manual-run fallback; она не создаёт automation, cron, LaunchAgent или скрытый scheduler. Существующие schedule schemas/intents остаются инертной основой совместимости и не считаются release claim. Все требования к cleanup safety, protected scopes, redaction, поэлементному quarantine, restore/purge и owner gates остаются без изменений. Канон, локальные Issue-спеки и живые GitHub Issues совпадают.

### Проверка

Запустить OKF/documentation validators, валидацию Issue-контрактов #10, #13 и этой Issue, применимые repository checks, `git diff --check` и сравнить живые Issue bodies с локальными спеками на финальном SHA.

### Ограничения

Не реализовывать scheduling или security runtime, не ослаблять safety-инварианты, не выполнять publication, release, tag, mutation реального Mac, merge или self-review.

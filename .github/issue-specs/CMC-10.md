```cto-issue
schema: 1
dependencies: #13
conflicts: none
touched_paths: .github/workflows/; scripts/; tests/security/; tests/plugin/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Complete universal-policy, privacy, exclusions/schedule, field-E2E and clean-room verification and produce deterministic release evidence without publishing.

### Scope

Add CMC-10 security tests for universal protected scopes, SafeMetadata, FindingFacts, authoritative owner bindings, requirement profiles/applicability, public synthetic fixtures, exclusions/migrations/identity mismatch, official uninstaller, receipt lifecycle, protected metadata, schedule lifecycle/fallback/read-only prompt, cancellation races, quarantine metrics, purge failures and visibility; add no-terminal clean-room/new-task tests, non-publishing CI, deterministic packaging and an uncompleted real-Mac owner protocol.

### Acceptance criteria

Automated gates A–H pass on the final SHA. Forged findings for credential/browser-profile/personal/current-project/plugin/Codex/Git scopes cannot produce preview. Owner binding cannot be forged from path/name/bundle-only hints or user attestation; profile/applicability cannot be selected by the client; `not_applicable` never suppresses positive evidence. A production-adapter generated user-Library cache/log completes audit → prepare → move → restore, while Application Support/Containers/Preferences/WebKit/HTTPStorages/Saved State/database/sync/VPN/personal/autostart remain inspect-only. Excluded findings cannot mutate; identity mismatch is visible; migrations and corrupt-state fail-closed behavior pass. Official uninstaller, receipt lifecycle, protected metadata, active process and missing executable cases are proven. Schedule creates one automation, supports update/pause/resume/delete, runs read-only and has an honest no-capability fallback. Skip now calls no tool; Move to quarantine affects one object; no bulk exists. Public package contains no username, home paths, personal app names/decisions, real inventory, raw secrets, historical bindings or local identities. Clean-room completes button-only quarantine/exclude/skip/restore/purge without terminal. Manual smoke, tag and release remain incomplete owner gates.

### Verification

Run the exact protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` and diff checks from CMC-10. Attach sanitized outputs to the PR at its final head SHA.

### Constraints

Do not create a tag, release, publication, deploy, credential change, real-Mac mutation outside the owner protocol, false manual result, merge or self-review.

## Русский

### Цель

Завершить universal-policy, privacy, exclusions/schedule, field-E2E и clean-room verification и подготовить deterministic release evidence без публикации.

### Объём

Добавить security tests CMC-10 для universal protected scopes, SafeMetadata, FindingFacts, authoritative owner bindings, requirement profiles/applicability, public synthetic fixtures, exclusions/migrations/identity mismatch, official uninstaller, receipt lifecycle, protected metadata, schedule lifecycle/fallback/read-only prompt, cancellation races, quarantine metrics, purge failures и visibility; no-terminal clean-room/new-task tests, CI без публикации, deterministic packaging и незаполненный real-Mac owner protocol.

### Критерии приёмки

Автоматические части gates A–H проходят на финальном SHA. Forged findings для credential/browser-profile/personal/current-project/plugin/Codex/Git scopes не создают preview. Owner binding нельзя подделать path/name/bundle-only hint или user attestation; клиент не выбирает profile/applicability; `not_applicable` не подавляет positive evidence. Generated user-Library cache/log через production adapters проходит audit → prepare → move → restore, а Application Support/Containers/Preferences/WebKit/HTTPStorages/Saved State/database/sync/VPN/personal/autostart остаются inspect-only. Excluded finding не мутируется; identity mismatch видим; migrations и corrupt-state fail-closed behavior проходят. Official uninstaller, receipt lifecycle, protected metadata, active process и missing executable cases доказаны. Schedule создаёт одну automation, поддерживает update/pause/resume/delete, запускает только read-only audit и имеет честный no-capability fallback. «Пропустить сейчас» без tool; «Переместить в карантин» действует на один объект; bulk отсутствует. Public package не содержит username, home paths, personal app names/decisions, real inventory, raw secrets, historical bindings или local identities. Clean-room выполняет button-only quarantine/exclude/skip/restore/purge без terminal. Manual smoke, tag и release остаются незавершёнными owner gates.

### Проверка

Запустить точные protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` и diff checks из CMC-10; приложить sanitized outputs к PR на финальном head SHA.

### Ограничения

Не создавать tag, release, publication, deploy, credential change, real-Mac mutation вне owner protocol, ложный manual result, merge или self-review.

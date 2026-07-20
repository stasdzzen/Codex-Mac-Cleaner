```cto-issue
schema: 1
dependencies: #41
conflicts: none
touched_paths: .codex-plugin/; .github/issue-specs/CMC-10.md; packages/contracts/; packages/storage/; apps/mcp-server/; apps/widget/; skills/; .github/workflows/; scripts/; tests/security/; tests/plugin/; docs/release/; README.md
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Complete universal-policy, privacy, exclusions, field-E2E and clean-room verification, prove the v0.1 schedule surface is inert and disabled, and produce deterministic release evidence without publishing.

### Scope

Add CMC-10 security tests for universal protected scopes, SafeMetadata, FindingFacts, authoritative owner bindings, requirement profiles/applicability, public synthetic fixtures, exclusions/migrations/identity mismatch, official uninstaller, receipt lifecycle, protected metadata, inert schedule schemas/state and the disabled/manual-run fallback, cancellation races, quarantine metrics, purge failures and visibility; add no-terminal clean-room/new-task tests, non-publishing CI, deterministic packaging and an uncompleted real-Mac owner protocol. When a gate proves an existing defect, first add a failing regression test and then apply only the minimum security/release hardening fix within the declared touched paths that is required to pass the gate, including deactivation of any successful v0.1 schedule lifecycle outcome or automation ID. This does not authorize feature expansion.

### Acceptance criteria

Automated gates A–H pass on the final SHA. Forged findings for credential/browser-profile/personal/current-project/plugin/Codex/Git scopes cannot produce preview. Owner binding cannot be forged from path/name/bundle-only hints or user attestation; profile/applicability cannot be selected by the client; `not_applicable` never suppresses positive evidence. A production-adapter generated user-Library cache/log completes audit → prepare → move → restore, while Application Support/Containers/Preferences/WebKit/HTTPStorages/Saved State/database/sync/VPN/personal/autostart remain inspect-only. Excluded findings cannot mutate; identity mismatch is visible; migrations and corrupt-state fail-closed behavior pass. Official uninstaller, receipt lifecycle, protected metadata, active process and missing executable cases are proven. The Schedule tab is an honest disabled/manual-run fallback: lifecycle controls and next/last scheduled run are absent, manual run uses the ordinary read-only audit, inert schemas/intents create no successful host outcome or automation ID, and no cron, LaunchAgent or hidden scheduler is created. Skip now calls no tool; Move to quarantine affects one object; no bulk exists. Public package contains no username, home paths, personal app names/decisions, real inventory, raw secrets, historical bindings or local identities. Clean-room completes button-only quarantine/exclude/skip/restore/purge without terminal. Manual smoke, tag and release remain incomplete owner gates.

### Verification

Run the exact protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` and diff checks from CMC-10. Attach sanitized outputs to the PR at its final head SHA.

### Constraints

Runtime changes are allowed only after a failing gate/regression test proves an existing defect and only as the minimum hardening needed to restore the approved v0.1 canon within the declared touched paths. Do not add features, broaden cleanup categories or perform unrelated refactors. Do not create a tag, release, publication, deploy, credential change, real-Mac mutation outside the owner protocol, false manual result, merge or self-review.

## Русский

### Цель

Завершить universal-policy, privacy, exclusions, field-E2E и clean-room verification, доказать инертность и disabled-состояние schedule surface v0.1 и подготовить deterministic release evidence без публикации.

### Объём

Добавить security tests CMC-10 для universal protected scopes, SafeMetadata, FindingFacts, authoritative owner bindings, requirement profiles/applicability, public synthetic fixtures, exclusions/migrations/identity mismatch, official uninstaller, receipt lifecycle, protected metadata, инертных schedule schemas/state и disabled/manual-run fallback, cancellation races, quarantine metrics, purge failures и visibility; no-terminal clean-room/new-task tests, CI без публикации, deterministic packaging и незаполненный real-Mac owner protocol. Когда gate доказывает существующий дефект, сначала добавить падающий regression test, затем внести только минимальный security/release hardening fix в объявленных touched paths, необходимый для прохождения gate, включая деактивацию любого успешного schedule lifecycle outcome или automation ID в v0.1. Это не разрешает расширение функций.

### Критерии приёмки

Автоматические части gates A–H проходят на финальном SHA. Forged findings для credential/browser-profile/personal/current-project/plugin/Codex/Git scopes не создают preview. Owner binding нельзя подделать path/name/bundle-only hint или user attestation; клиент не выбирает profile/applicability; `not_applicable` не подавляет positive evidence. Generated user-Library cache/log через production adapters проходит audit → prepare → move → restore, а Application Support/Containers/Preferences/WebKit/HTTPStorages/Saved State/database/sync/VPN/personal/autostart остаются inspect-only. Excluded finding не мутируется; identity mismatch видим; migrations и corrupt-state fail-closed behavior проходят. Official uninstaller, receipt lifecycle, protected metadata, active process и missing executable cases доказаны. Вкладка «Расписание» — честный disabled/manual-run fallback: lifecycle controls и next/last scheduled run отсутствуют, manual run использует обычный read-only audit, инертные schemas/intents не создают успешный host outcome или automation ID, cron, LaunchAgent и скрытый scheduler не создаются. «Пропустить сейчас» без tool; «Переместить в карантин» действует на один объект; bulk отсутствует. Public package не содержит username, home paths, personal app names/decisions, real inventory, raw secrets, historical bindings или local identities. Clean-room выполняет button-only quarantine/exclude/skip/restore/purge без terminal. Manual smoke, tag и release остаются незавершёнными owner gates.

### Проверка

Запустить точные protected-scope, privacy, field-E2E, no-terminal, security, plugin, build, package `--verify-only` и diff checks из CMC-10; приложить sanitized outputs к PR на финальном head SHA.

### Ограничения

Runtime-изменения разрешены только после доказательства существующего дефекта падающим gate/regression test и только как минимальный hardening для восстановления утверждённого канона v0.1 в объявленных touched paths. Не добавлять функции, не расширять cleanup-категории и не выполнять несвязанные refactors. Не создавать tag, release, publication, deploy, credential change, real-Mac mutation вне owner protocol, ложный manual result, merge или self-review.

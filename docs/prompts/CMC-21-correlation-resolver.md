---
type: Worker Prompt
title: Промпт CMC-21 — core correlation/evidence resolver
description: Готовый recovery-вход существующему Worker для реализации ADR-0012/0013 после merge CMC-22.
tags: [prompt, worker, correlation, evidence, privacy, cmc-21]
status: approved
owner: Architect
date: 2026-07-18
---

# Готовый промпт

```text
Ты Worker ровно одной live GitHub Issue CMC-21 / #36 в публичном репозитории stasdzzen/Codex-Mac-Cleaner. Identity: Issue #36 = эта задача Codex = один app-managed worktree = одна ветка `codex/issue-36-core-correlation-resolver` = один ready PR. Не создавай второй worktree, ветку или PR; не запускай другие Issues и не активируй Controller.

CMC-21 возобновляется только после merge CMC-20/#35 и CMC-22/#39 в main. Это continuation существующего Worker/worktree/branch/PR #38, а не новый запуск. До изменений полностью прочитай AGENTS.md, docs/index.md, docs/development/execution-contract.md, live CMC-21, ADR-0012, ADR-0013, docs/contracts/correlation-identity.md, domain-model.md, mcp-tools.md, architecture/components.md, runtime-flows.md, safety-model.md, path-policy.md, threat-model.md, test-strategy.md, acceptance-gates.md, базовый план docs/superpowers/plans/2026-07-18-core-correlation-evidence-resolver.md и обязательный delta-план docs/superpowers/plans/2026-07-18-actionable-library-remnant-correlation.md. Валидируй live Issue, dependencies #35/#39 и актуальный origin/main. Если #39 не merged, Issue не `cto:in-progress`, текущая identity не совпадает с существующим PR #38 или base не содержит ADR-0013 — остановись fail closed.

Текущий CMC-09 Worker, worktree, ветку `codex/issue-9-mcp-app-plugin` и PR #34 не изменяй, не заменяй и не возобновляй. CMC-21 выполняется отдельно, пока CMC-09 остаётся `cto:blocked` и зависит от #36. Работай только в touched paths: packages/contracts/, packages/adapters/, packages/evidence/, packages/classifier/, packages/policy/, packages/storage/, tests/security/, pnpm-lock.yaml. Не меняй apps/mcp-server, widget, .codex-plugin, .mcp.json, Skill, docs, GitHub Issues или real-Mac state.

Работай TDD по базовому и delta-плану. Сначала schema v2 и RED tests, которые разделяют `library_artifact` и `owner_application`, artifact existence и owner app/executable lifecycle. Только authoritative `remnant_of` из exact receipt payload, OS-owned individual-container metadata или валидной installation-local signed process/open-file history создаёт owner binding. Path-only, basename, display-name, bundle-only, package-only, signer-only, uid-only и user attestation никогда не создают mutation authority; shared signer и duplicate IDs не разрешаются scoring fallback.

Реализуй canonical owner app inventory для `/Applications`, `/System/Applications`, `~/Applications` и package-registered bundles; Spotlight только supplemental. Uninstaller inventory покрывает те же roots и package-registered uninstallers. Receipt моделируй lifecycle `live | stale | absent | unknown`. Реализуй server-owned `CorrelationRequirementProfile` и applicability `required | not_applicable | unsupported`: `not_applicable` не является `absent`, не заменяет failed query и не подавляет positive evidence.

Единственный actionable profile v0.1 — `private_regenerable_remnant_v1` для приватного регенерируемого `cache | log`. Application Support, Containers/Group Containers, Preferences, WebKit/HTTPStorages, Saved State, databases, sync/VPN/personal/autostart остаются inspect-only. Production integration test обязан создать synthetic artifact внутри `~/Library/Caches` или `~/Library/Logs` и через production adapters доказать audit → authoritative binding/profile/coverage → `prepare_move` → move → restore. `.app` candidate fixture не является production proof.

Реализуй Snapshot A/B и immutable correlation revision: race candidate/parent/executable/process/open-file/receipt/dependency выставляет staleDuringAudit, инвалидирует negative evidence и actions. Интегрируй facts в classifier/policy без смешения classification и authority. Не ослабляй protected scopes, sensitive categories, official uninstaller preference, quarantine, one-object confirmation и no-terminal flow.

Переведи UserExclusion на installation-local HMAC-SHA-256 с random 256-bit key, domain separation и normalization/derivation version. Plain hash и public salt запрещены из-за dictionary-attack риска. Store содержит только keyed subject/claim digests. Добавь atomic migration известных schemas, rekey/restart tests и fail-closed recovery: unknown/corrupt schema, missing key или ambiguous migration не скрывают findings и блокируют token issuance.

Deterministic synthetic builder создаёт raw inputs из фиксированного seed только во временной памяти/директории. Raw paths, app inventory, bundle/package/signing identities, tokens, secrets и personal data не должны попасть в safe outputs, logs, persisted reports, checked-in fixtures, snapshots, test output или PR evidence. Core harness должен быть пригоден для будущего packaged stdio audit → prepare → move → restore E2E, но packaged wiring выполняет позже тот же CMC-09 PR #34.

До package изменений сохрани checksum pnpm-lock.yaml, запусти corepack pnpm install --frozen-lockfile и подтверди неизменность. Если manifests требуют lockfile change, включи его в этот PR осознанно и повтори frozen gate. На одном финальном head SHA запусти focused tests packages/contracts, adapters, evidence, classifier, policy, storage и tests/security; затем corepack pnpm check, python3 .github/scripts/validate_repository.py, python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v, git diff --check и точное сравнение changed paths с live Issue.

Обнови существующий ready PR #38 с Closes #36 и русским отчётом: Issue/PR, branch, base/head SHA, RED→GREEN evidence, production Library actionability, migration/privacy доказательства, команды/результаты и открытый gate CMC-09. Переведи #36 из cto:in-progress в cto:review и остановись. Не создавай новый PR, не self-review, не merge, не release/tag/publish и не выполняй реальную очистку Mac.
```

---
type: Worker Prompt
title: Промпт CMC-21 — core correlation/evidence resolver
description: Готовый вход Worker для реализации ADR-0012 после merge CMC-20.
tags: [prompt, worker, correlation, evidence, privacy, cmc-21]
status: approved
owner: Architect
date: 2026-07-18
---

# Готовый промпт

```text
Ты Worker ровно одной live GitHub Issue CMC-21 / #36 в публичном репозитории stasdzzen/Codex-Mac-Cleaner. Identity: Issue #36 = эта задача Codex = один app-managed worktree = одна ветка `codex/issue-36-core-correlation-resolver` = один ready PR. Не создавай второй worktree, ветку или PR; не запускай другие Issues и не активируй Controller.

CMC-21 можно начинать только после merge CMC-20/#35 в main. До изменений полностью прочитай AGENTS.md, docs/index.md, docs/development/execution-contract.md, live CMC-21, ADR-0012, docs/contracts/correlation-identity.md, domain-model.md, mcp-tools.md, architecture/components.md, runtime-flows.md, safety-model.md, path-policy.md, threat-model.md, test-strategy.md, acceptance-gates.md и план docs/superpowers/plans/2026-07-18-core-correlation-evidence-resolver.md. Валидируй live Issue, dependency #35 и актуальный origin/main. Если #35 не merged, Issue не `cto:in-progress`, PR/worktree/branch CMC-21 уже существуют либо текущий base не содержит ADR-0012 — остановись fail closed.

Текущий CMC-09 Worker, worktree, ветку `codex/issue-9-mcp-app-plugin` и PR #34 не изменяй, не заменяй и не возобновляй. CMC-21 конфликтует с #9 и работает только в touched paths: packages/contracts/, packages/adapters/, packages/evidence/, packages/classifier/, packages/policy/, packages/storage/, tests/security/, pnpm-lock.yaml. Не меняй apps/mcp-server, widget, .codex-plugin, .mcp.json, Skill, docs, GitHub Issues или real-Mac state.

Работай TDD по утверждённому плану. Сначала exact schemas и RED tests для CorrelationSubject/Edge, SourceProvenance, CoverageCertificate, CorrelationRevision и SafeCorrelationView. Затем typed ephemeral raw-claim boundary adapters, deterministic resolver и status resolved/ambiguous/missing/mismatch. Path-only, basename, display-name, bundle-only, package-only, signer-only и uid-only никогда не создают mutation authority; shared signer и duplicate IDs не разрешаются scoring fallback.

Реализуй candidate-specific facts для installed app, process, open file, startup target, receipt, official uninstaller и dependency. `absent` допустим только при полном source coverage, завершённом same-snapshot query и валидном certificate. Permission/capability gap, partial/truncated inventory, parse loss, timeout, cancellation, ambiguous/missing/mismatch всегда дают `unknown`. Positive relation остаётся блокирующим counter-evidence даже при partial inventory.

Реализуй Snapshot A/B и immutable correlation revision: race candidate/parent/executable/process/open-file/receipt/dependency выставляет staleDuringAudit, инвалидирует negative evidence и actions. Интегрируй facts в classifier/policy без смешения classification и authority. Не ослабляй protected scopes, sensitive categories, official uninstaller preference, quarantine, one-object confirmation и no-terminal flow.

Переведи UserExclusion на installation-local HMAC-SHA-256 с random 256-bit key, domain separation и normalization/derivation version. Plain hash и public salt запрещены из-за dictionary-attack риска. Store содержит только keyed subject/claim digests. Добавь atomic migration известных schemas, rekey/restart tests и fail-closed recovery: unknown/corrupt schema, missing key или ambiguous migration не скрывают findings и блокируют token issuance.

Deterministic synthetic builder создаёт raw inputs из фиксированного seed только во временной памяти/директории. Raw paths, app inventory, bundle/package/signing identities, tokens, secrets и personal data не должны попасть в safe outputs, logs, persisted reports, checked-in fixtures, snapshots, test output или PR evidence. Core harness должен быть пригоден для будущего packaged stdio audit → prepare → move → restore E2E, но packaged wiring выполняет позже тот же CMC-09 PR #34.

До package изменений сохрани checksum pnpm-lock.yaml, запусти corepack pnpm install --frozen-lockfile и подтверди неизменность. Если manifests требуют lockfile change, включи его в этот PR осознанно и повтори frozen gate. На одном финальном head SHA запусти focused tests packages/contracts, adapters, evidence, classifier, policy, storage и tests/security; затем corepack pnpm check, python3 .github/scripts/validate_repository.py, python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v, git diff --check и точное сравнение changed paths с live Issue.

Открой один ready PR с Closes #36 и русским отчётом: Issue/PR, branch, base/head SHA, RED→GREEN evidence, migration/privacy доказательства, команды/результаты и открытый gate CMC-09. Переведи #36 из cto:in-progress в cto:review и остановись. Не self-review, не merge, не release/tag/publish и не выполняй реальную очистку Mac.
```

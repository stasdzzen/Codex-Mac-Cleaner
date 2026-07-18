---
type: Implementation Plan
title: План CMC-21 — core correlation/evidence resolver
description: Базовый TDD-план CMC-21, дополненный обязательным ADR-0013 delta-планом после merge CMC-22.
tags: [plan, correlation, evidence, tdd, cmc-21]
status: approved
owner: Architect
date: 2026-07-18
---

# Граница плана

План продолжает существующий Worker CMC-21/#36 и PR #38 только после merge #35 и #39. Разрешённые paths: `packages/contracts/`, `packages/adapters/`, `packages/evidence/`, `packages/classifier/`, `packages/policy/`, `packages/storage/`, `tests/security/`, `pnpm-lock.yaml`.

Этот документ остаётся базовым планом ADR-0012. Обязательные изменения ADR-0013 выполняются по [delta-плану actionable Library remnants](2026-07-18-actionable-library-remnant-correlation.md). При расхождении delta-план и ADR-0013 имеют приоритет; старый `.app`-candidate harness не является доказательством production actionability.

`apps/mcp-server`, widget, `.codex-plugin`, `.mcp.json`, Skill и PR #34 не меняются. Packaged stdio wiring/E2E выполняются позже тем же CMC-09 Worker в существующем PR #34.

# Task 1 — correlation contracts

**Tests first**

* Добавить schema tests `CorrelationSubject`, `CorrelationEdge`, `SourceProvenance`, `CoverageCertificate`, `CorrelationRevision`, `SafeCorrelationView`.
* RED для unknown fields, raw path/inventory/identity/token fields и invalid version/state.
* RED: `Observation.targetRef` не проходит как persisted correlation identity.

**Implementation**

* Добавить exact schemas/types и exports в `packages/contracts`.
* Добавить typed fail-closed error codes без raw details.
* Сохранить read compatibility legacy contracts, пометив legacy evidence non-actionable.

# Task 2 — adapter raw-claim boundary и provenance

**Tests first**

* Seeded temp builder создаёт candidate, installed bundle, shared signer, duplicate IDs, process/open-file, receipt, startup и dependency claims.
* RED: raw claims появляются в safe `Observation`, warning, log snapshot или serialized report.
* RED: empty/partial source сам объявляет `absent`.

**Implementation**

* Ввести закрытый typed raw-claim/query API и source provenance.
* Обновить adapters так, чтобы claims и query completion передавались resolver, а safe observations оставались redacted.
* Не добавлять произвольные path inputs или shell interpolation.

# Task 3 — deterministic resolver

**Tests first**

* Матрица filesystem/bundle/package/signing/owner для `resolved | ambiguous | missing | mismatch`.
* RED для path-only, basename, display-name, bundle-only, package-only, signer-only и uid-only resolution.
* RED для shared signer и duplicate identity: resolver не выбирает по score/порядку.

**Implementation**

* Реализовать versioned named rules, opaque subjects/edges и deterministic ordering.
* Strong mismatch сохранять как counter-evidence; hints не передавать policy как authority.
* Вычислять keyed subject/claim digests с domain/normalization version.

# Task 4 — completeness certificates и negative evidence

**Tests first**

* Для каждого mandatory source: positive, complete-empty, permission denied, capability missing, partial, truncated, parse loss, timeout, cancel, ambiguous и mismatch.
* RED: любой case кроме complete-empty с certificate даёт `absent`.
* RED: positive evidence теряется из-за incomplete overall coverage.

**Implementation**

* Выпускать `CoverageCertificate` только для полного scope и same `snapshotId`.
* Строить tri-state candidate facts и safe coverage summary.
* Positive facts сохранять как blocking counter-evidence независимо от negative completeness.

# Task 5 — Snapshot A/B и immutable revision

**Tests first**

* Между A/B заменить candidate/parent inode, owner/type, executable, process/open-file, receipt и dependency.
* RED: stale revision сохраняет action или прежний `absent`.
* RED: token/action binding принимает другой graph/coverage/exclusion version.

**Implementation**

* Добавить snapshot/query fingerprints и immutable correlation revision digest.
* На race выставлять `staleDuringAudit`, инвалидировать negative facts и mutation actions.
* Policy принимает только version-compatible correlation revision.

# Task 6 — classifier/policy integration

**Tests first**

* `orphaned` + mandatory `unknown`, ambiguity, mismatch, active/open/installed/receipt/dependency present не получает `prepare_move`.
* Complete certificates удовлетворяют только соответствующие prerequisites и не обходят protected scope/sensitivity/category.

**Implementation**

* Перевести normalization/classifier/policy на typed facts/revision.
* Сохранить независимость classification и action policy.
* Не ослаблять quarantine, one-object confirmation, path guard и official uninstaller preference.

# Task 7 — keyed UserExclusion и migration

**Tests first**

* Persistence/restart, domain separation, rekey, dictionary-attack regression, full-claim match и mismatch.
* Migration каждой known version, unknown/corrupt schema, missing key, ambiguous migration, crash до/после rename.
* RED: store/output содержит plaintext raw identity либо migration скрывает finding.

**Implementation**

* Добавить key lifecycle, keyed derivation и versioned atomic store migration.
* Unknown/missing/migration-required оставляет findings видимыми и блокирует token issuance.
* Silent reset и portable public inventory не создавать.

# Task 8 — privacy/security и core harness

**Tests first**

* Canary scan `content`, `structuredContent`-equivalent safe objects, errors, logs, snapshots и persisted reports.
* Core harness: production `~/Library/Caches|Logs` artifact с authoritative owner binding, `private_regenerable_remnant_v1` и complete required facts становится policy-eligible; active/open/installed/live-receipt/dependency present, unsupported profile или incomplete coverage блокирует.
* Harness экспортирует safe input для будущего packaged stdio E2E без raw identities.

**Implementation**

* Удалить утечки, закрепить deterministic serialization и safe errors.
* Не добавлять app/server wiring в этой Issue.

# Task 9 — обязательный ADR-0013 delta

**Tests first**

* Выполнить все RED cases из [delta-плана](2026-07-18-actionable-library-remnant-correlation.md): schema v2, authoritative binding, production inventory scopes, receipt lifecycle, requirement applicability и Library production integration.
* RED: `.app` candidate остаётся недостаточным acceptance evidence; Application Support/Containers/Preferences/WebKit/HTTPStorages/Saved State/database/sync/VPN/personal/autostart не получают `prepare_move`.

**Implementation**

* Разделить cleanup-target и owner lifecycle, мигрировать legacy target-executable в analysis-only.
* Добавить один actionable `private_regenerable_remnant_v1` и доказать audit → prepare → move → restore на generated user-Library cache/log через production adapters.
* Сохранить ту же Issue/worktree/branch/PR #38 и все privacy/fail-closed инварианты.

# Финальные проверки

На одном финальном head SHA:

1. `corepack pnpm install --frozen-lockfile` и подтверждение неизменности lockfile.
2. Focused tests всех шести packages и `tests/security`.
3. `corepack pnpm check`.
4. `python3 .github/scripts/validate_repository.py`.
5. `python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v`.
6. `git diff --check` и точное сравнение diff paths с CMC-21.

Worker открывает один ready PR, передаёт независимому reviewer и не возобновляет CMC-09. После merge CMC-21 Controller/владелец отдельно возвращает существующий CMC-09 Worker к PR #34.

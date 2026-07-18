---
type: Design Specification
title: Server-owned correlation identity и negative evidence
description: Дизайн CMC-20 для безопасной связи candidate с app/process/open-file/receipt/dependency evidence.
tags: [design, correlation, identity, evidence, privacy, cmc-20]
status: approved
owner: Architect
date: 2026-07-18
---

# Проблема

Production head PR #34 запускает только Library adapter. Даже при подключении остальных adapters их observations не связаны с candidate: Library использует opaque ref от path, installed apps — собственный opaque ref от app path, processes/open files — ref от command output, targeted sources — ref своего record. `normalizeEvidence()` группирует только уже одинаковые refs, а `ServerCorrelationSignal` обязан заранее ссылаться на candidate.

Без нового контракта runtime может оставить states `unknown` либо придумать связь по basename/display name. Первый вариант безопасен, но не даёт production `prepare_move`; второй нарушает канон. Пустой source output также ничего не говорит о полноте inventory.

# Intended vs implemented

| Область | Реализовано на `main`/PR #34 | Требуемое состояние | Маршрут |
|---|---|---|---|
| Observation identity | Независимый opaque `targetRef` | `targetRef` только transport; server-only subjects/edges | CMC-21 |
| Correlation signals | Готовый signal для уже известного candidate ref | Resolver строит candidate-specific facts из typed claims | CMC-21 |
| Negative evidence | Нет completeness semantics | `absent` только с same-snapshot certificate | CMC-21 |
| Production runtime | Library-only; mandatory facts `unknown` | После core merge подключить adapters/resolver в том же PR #34 | Возобновить CMC-09 |
| Exclusion identity | Versioned fields, включая bundle/package/signing values | Installation-keyed digests, migration/recovery | CMC-21 |
| Widget boundary | Safe model view, но канон допускал full path в `_meta` | Только safe facts/actions и opaque handle | CMC-09 после CMC-21 |
| Packaged E2E | Safe-empty stdio и synthetic core flow раздельно | Packaged stdio audit → resolver → move → restore | Тот же PR #34 после CMC-21 |

Ни один planned пункт не считается implemented до merge CMC-21 и последующего обновления PR #34.

# Граница данных

## Ephemeral raw layer

Adapters могут внутри локального процесса передать canonical path, filesystem tuple, bundle/package identifiers, designated signing requirement, executable mapping, pid generation и dependency relation. API типизирован и запрещает произвольный record. Raw claims уничтожаются после derivation/revision build, не попадают в `Observation` safe form и не пересекают MCP boundary.

## Persisted local layer

Сервер создаёт subject/claim digests через installation-local HMAC key, domain и normalization version. Ключ и store разделены. Plain SHA-256 и публичная salt не подходят для low-entropy bundle/package/product/path dictionaries. Persisted audit report хранит safe states и graph/coverage digests, но не claim set. Exclusion store хранит keyed subject/claim digests.

## Safe external layer

Модель и widget получают только opaque finding/revision ID, tri-state facts, coverage gap codes, `staleDuringAudit`, risk, explanation и server-owned actions. Reveal/mutation разрешают local path внутри сервера по ID. App action handle не содержит token или identity.

# Resolution rules

Resolver не использует hidden score. Каждый named/versioned rule возвращает один статус:

* `resolved` — одна цель подтверждена authoritative claim либо независимыми corroborated claims;
* `ambiguous` — подходят несколько целей;
* `missing` — обязательный claim отсутствует;
* `mismatch` — strong claims противоречат друг другу.

Filesystem tuple подтверждает ту же ревизию объекта, а не app ownership. Bundle/package ID и signer задают множества кандидатов; shared signer и duplicate IDs ожидаемы. `uid` подтверждает OS owner, но не приложение. Path, basename, display name и certificate common name — только hints и никогда не входят в mutation-enabling edge.

# Coverage и `absent`

Source query регистрирует scope, capability, permission, start/finish, parse state, truncation, warnings и fingerprint. Certificate выпускается только для полного, завершённого и однозначно применённого query в одном logical snapshot.

Матрица:

| Source result | Fact |
|---|---|
| Positive resolved relation | `present` |
| Empty + complete certificate | `absent` |
| Empty без certificate | `unknown` |
| Permission/capability gap | `unknown` |
| Partial/truncated/parse loss/cancel | `unknown` |
| Ambiguous/missing/mismatch | `unknown` + safe blocking reason |

Positive `present` блокирует действие даже при partial inventory. `absent` является только одним prerequisite и не заменяет остальные policy checks.

# Snapshot и token

Snapshot A фиксирует candidate/parent и source capabilities. Queries получают один `snapshotId`. Snapshot B повторяет candidate/parent и все mutable claims, влияющие на policy. Race даёт `staleDuringAudit` и новую/неactionable revision.

Token остаётся в server session и связан с audit/correlation revision, Snapshot B fingerprints, edge/coverage digests, policy/rule/derivation versions, exclusion state, action, UI session, operation ID и expiry. Widget получает opaque handle. Revalidation повторяет protected scope и mandatory counter-evidence непосредственно перед rename.

# UserExclusion

Новая запись содержит key/derivation version, keyed subject digest и полный обязательный set claim digests. Subset/path/name match запрещён. Rekey или migration version меняют namespace.

Known legacy schema мигрирует через validated reader → HMAC derivation → temp file → fsync → atomic rename → reread → удаление raw active state. Unknown/corrupt/missing key/ambiguous migration не скрывают finding и блокируют token issuance. Silent reset и перенос store между installations запрещены.

# Privacy и тестовый дизайн

Checked-in fixtures не содержат raw path, inventory, bundle/package/signing set или tokens. Seeded builder создаёт synthetic raw claims в temp root/runtime memory; expected files содержат safe states и deterministic digests. Canaries доказывают отсутствие raw input в outputs, errors, snapshots и logs.

Core integration harness CMC-21 должен быть пригоден для следующего packaged stdio E2E, но не меняет `apps/mcp-server`. После core merge тот же CMC-09 PR #34 подключает resolver, строит production package и выполняет synthetic HOME audit → prepare handle → move → restore.

# Fail-closed recovery

Стабильные ошибки разделяют ambiguity, missing, mismatch, incomplete coverage, stale snapshot, unsupported schema, missing key и migration required. Safe message не раскрывает conflicting identities. Любая ошибка очищает mutation actions; audit может сохранить read-only report с gaps.

# Backlog gate

1. CMC-20/#35 merges architecture only.
2. CMC-21/#36 implementation starts in a separate managed worktree/branch/PR and remains blocked until step 1.
3. CMC-21 merges after independent review.
4. The existing CMC-09 Worker resumes in the same worktree, branch `codex/issue-9-mcp-app-plugin` and PR #34.

Ни CMC-20, ни CMC-21 не создают замену PR #34 и не получают merge/release authority.

# Связанные документы

* [ADR-0012](../../decisions/ADR-0012-server-owned-correlation-identity.md)
* [Correlation contract](../../contracts/correlation-identity.md)
* [План CMC-21](../plans/2026-07-18-core-correlation-evidence-resolver.md)
* [Worker prompt CMC-21](../../prompts/CMC-21-correlation-resolver.md)

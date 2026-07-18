---
type: Domain Model
title: Контракт server-owned correlation identity
description: Сущности, состояния, coverage semantics, revision binding и privacy-границы correlation resolver.
tags: [contracts, correlation, identity, evidence, coverage, privacy]
status: approved
owner: Architect
date: 2026-07-18
---

# Назначение

Контракт определяет, как локальный сервер связывает Library candidate с приложениями, executable targets, процессами/open files, startup items, receipts и dependencies. Он не расширяет candidate roots и не выдаёт UI или модели право решать identity.

# Представления identity

## `RawLocalIdentity`

Ephemeral server-only value внутри одного query. Допустимые typed claims:

* `filesystem`: canonical local path, root, device, inode, file type, uid/gid, parent identity и snapshot fingerprint;
* `bundle`: normalized bundle identifier, executable target и bundle metadata fingerprint;
* `package`: normalized package identifier, receipt fingerprint и payload mapping;
* `signing`: designated requirement/team identifier и verified executable fingerprint;
* `process`: pid generation, executable identity и open target identity;
* `dependency`: depender/dependee claims и source-specific relation;
* `owner`: filesystem owner и отдельно app-owner claim.

Raw claim живёт не дольше query/revision build, передаётся только типизированным API без shell interpolation и не сериализуется.

## `PersistedLocalIdentity`

Versioned local-only derivation:

```text
schemaVersion
derivationVersion
keyId
subjectDigest = HMAC(key, domain || canonical-claim-set)
claimDigests[kind] = HMAC(key, domain || kind || normalized-value)
provenanceDigest
```

HMAC key случайный, installation-local, не экспортируется и хранится отдельно с `0600`. Claim normalization и domain обязаны входить в versioned contract. Plain hash, display name и публичная salt не являются допустимой identity.

## `SafeCorrelationView`

Единственный внешний view содержит `findingId`, `auditRevision`, `correlationRevisionId`, безопасные `FindingFacts`, `coverageSummary`, `staleDuringAudit`, blocking reasons и `allowedActions`. Raw identities, edges, certificates и token material отсутствуют.

# `CorrelationSubject`

Server-only сущность:

* `schemaVersion`;
* `subjectId` — opaque stable ID, производный от keyed digest;
* `subjectKind`: `filesystem_object | app_bundle | executable | package | receipt | process | open_file | startup_item | dependency`;
* `claimDigests` — локальные keyed digests;
* `provenanceIds`;
* `snapshotId`;
* `identityFingerprint`;
* `resolutionState`: `resolved | ambiguous | missing | mismatch`.

`subjectId` стабилен только внутри installation key и derivation version. Он не переносится между Mac, профилями или reinstall/rekey.

# `CorrelationEdge`

Server-only relation:

* `schemaVersion`, `edgeId`, `fromSubjectId`, `toSubjectId`;
* `relation`: `belongs_to | installed_as | executes | opens | launches | has_receipt | depends_on | maps_payload`;
* `ruleId`, `ruleVersion` и использованные claim kinds;
* `strength`: `authoritative | corroborated | hint`;
* `resolutionState`: `resolved | ambiguous | missing | mismatch`;
* `provenanceIds`, `snapshotId`, `edgeFingerprint`.

`hint` не входит в mutation policy. Name/display-name/basename match всегда не сильнее `hint`. `resolved` требует rule-specific authoritative либо независимые corroborated claims. Несовместимые strong claims дают `mismatch`; несколько совместимых целей без уникального решения дают `ambiguous`.

# Правила claims

| Claim | Что доказывает | Чего не доказывает |
|---|---|---|
| Filesystem identity | Ту же ревизию локального объекта | Владельца-приложение |
| Bundle ID | Множество app candidates | Уникальное владение candidate |
| Package ID | Множество receipts/packages | Установленность или владение без payload mapping |
| Signing requirement/team | Проверенного signer/executable | Уникальное приложение; signer может быть shared |
| `uid`/`gid` | OS owner объекта | App ownership |
| Path/basename/display name | Только навигационный hint | Identity, `absent`, mutation authority |

Missing required claim даёт `missing`. Неоднозначное множество даёт `ambiguous`. Strong mismatch является counter-evidence. Resolver не выбирает «лучшее» совпадение по score.

# `SourceProvenance`

Каждая claim и edge ссылается на:

* `provenanceId`, `sourceAdapter`, `sourceSchemaVersion`;
* `queryId`, `queryScope`, `snapshotId`, `phase` (`A | query | B`);
* `startedAt`, `completedAt`, `queryFingerprint`;
* `capabilityState`, `permissionState`, `completionState`;
* `parseState`, `truncated`, `warningCodes`.

Raw command, stdout/stderr, path и inventory item в provenance не входят. Persisted report сохраняет digest и safe states.

# `CoverageCertificate`

Сервер выпускает certificate только после полного query:

* `certificateId`, `schemaVersion`, `sourceAdapter`, `queryScope`;
* `subjectId`, если query candidate-specific;
* `snapshotId`, `queryFingerprint`, `coverageFingerprint`;
* `capabilityState=available`, `permissionState=granted`;
* `completionState=complete`, `parseState=complete`;
* `partial=false`, `ambiguous=false`, `issuedAt`.

Отсутствие certificate, пустой output, partial/truncated inventory, permission denial, capability gap, timeout, cancellation, parse loss или ambiguity означают `unknown`.

# Вывод states

| Условие | Fact state | Policy effect |
|---|---|---|
| Однозначный positive edge | `present` | Counter-evidence; mutation блокируется, если fact обязательный |
| Нет edge + валидный same-snapshot certificate | `absent` | Только удовлетворяет один prerequisite; mutation автоматически не разрешает |
| Нет certificate или source partial | `unknown` | Mutation блокируется |
| Несколько целей | `unknown`, reason `ambiguous` | Mutation блокируется |
| Strong claim mismatch | `unknown`, counter-evidence `mismatch` | Mutation блокируется |
| Snapshot A/B различаются | прежний state инвалидирован, `staleDuringAudit=true` | Все mutation actions пусты |

Правило применяется отдельно к `installed_state`, `activity`, `open_file_state`, `receipt_state`, `dependency_state` и target/startup state. Positive evidence не требует полного inventory, но должно пройти identity validation.

# `CorrelationRevision`

Immutable revision содержит:

* `correlationRevisionId`, `schemaVersion`, `derivationVersion`;
* `auditId`, `auditRevision`, `snapshotId`;
* `snapshotAFingerprint`, `snapshotBFingerprint`;
* `subjectSetDigest`, `edgeSetDigest`, `coverageReportDigest`;
* `ruleSetVersion`, `policyVersion`, `exclusionStateVersion`;
* `staleDuringAudit`, `createdAt`.

Revision actionable только для terminal audit `completed | completed_with_warnings`, при `staleDuringAudit=false` и полном coverage всех mandatory facts конкретного policy rule.

# Destructive token binding

Token server-only и одноразово привязан к:

* action и app UI session;
* finding, audit revision и correlation revision;
* candidate и parent Snapshot B fingerprints;
* relevant edge/coverage digests;
* policy/rule/derivation versions;
* exclusion state version;
* expiry и operation ID.

Widget получает opaque action handle, по которому сервер находит token. Handle не содержит identity и не работает вне session/revision. Любое несоответствие возвращает typed fail-closed error.

# Coverage report

Локальный полный report содержит safe per-source states, query/certificate digests и gaps. Model/widget view содержит только агрегированные counts, source class, safe error codes и влияние `unknown`; inventory и claims не раскрываются.

# UserExclusion derivation и миграция

Новая запись хранит `schemaVersion`, `exclusionId`, `ruleId`, `artifactKind`, `keyId`, `derivationVersion`, `subjectDigest`, применимые `claimDigests`, `createdAt` и safe `reasonCategory`.

Match разрешён только при том же key/derivation version и равенстве полного обязательного claim set. Path-only, name-only и subset match запрещены. При mismatch finding показывается снова. Exclusion никогда не создаёт action authority.

Legacy schema мигрирует через validated local-only reader и atomic rewrite. Unknown/corrupt schema, missing key либо неоднозначная derivation дают `migration_required`: exclusions не скрывают findings, а destructive tokens не выпускаются. Recovery — восстановить key из plugin-owned backup, удалить/recreate конкретное exclusion либо выполнить поддержанную migration; silent reset запрещён.

# Privacy и тестовые данные

Запрещены raw identities, paths, inventory, token material и personal data в MCP output, widget state, logs, telemetry, persisted audit report, checked-in fixtures, snapshots, package и PR evidence. Deterministic test builder генерирует raw synthetic claims во временной памяти/директории из фиксированного seed; golden artifacts содержат safe views и digests.

# Ошибки

Resolver использует стабильные коды `CORRELATION_AMBIGUOUS`, `CORRELATION_MISSING`, `CORRELATION_MISMATCH`, `CORRELATION_COVERAGE_INCOMPLETE`, `CORRELATION_SNAPSHOT_STALE`, `CORRELATION_SCHEMA_UNSUPPORTED`, `CORRELATION_KEY_UNAVAILABLE` и `CORRELATION_MIGRATION_REQUIRED`. Ни один код не содержит raw identity в сообщении.

# Связанные концепты

* [ADR-0012](../decisions/ADR-0012-server-owned-correlation-identity.md)
* [Доменная модель](domain-model.md)
* [MCP-tools](mcp-tools.md)
* [Контракт ошибок](errors.md)
* [Стратегия тестирования](../quality/test-strategy.md)

---
type: Domain Model
title: Контракт server-owned correlation identity
description: Сущности, роли cleanup-target и owner, authoritative binding, coverage semantics, requirement profiles и privacy-границы correlation resolver.
tags: [contracts, correlation, identity, evidence, coverage, privacy, library]
status: approved
owner: Architect
date: 2026-07-18
---

# Назначение

Контракт определяет, как локальный сервер связывает Library artifact с приложением-владельцем, executable targets, процессами/open files, startup items, receipts и dependencies. Cleanup-target и приложение-владелец являются разными субъектами. Контракт не расширяет candidate roots и не выдаёт UI или модели право решать identity, applicability или policy profile.

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

Единственный внешний view содержит `findingId`, `auditRevision`, `correlationRevisionId`, безопасные `FindingFacts`, агрегированное состояние owner binding, `requirementProfileId`, `coverageSummary`, `staleDuringAudit`, blocking reasons и `allowedActions`. Raw identities, edges, certificates, historical records и token material отсутствуют.

# `CorrelationSubject`

Server-only сущность:

* `schemaVersion`;
* `subjectId` — opaque stable ID, производный от keyed digest;
* `subjectRole`: `library_artifact | owner_application | evidence_subject`;
* `subjectKind`: `filesystem_object | app_bundle | executable | package | receipt | process | open_file | startup_item | dependency`;
* `claimDigests` — локальные keyed digests;
* `provenanceIds`;
* `snapshotId`;
* `identityFingerprint`;
* `resolutionState`: `resolved | ambiguous | missing | mismatch`.

`library_artifact` является cleanup-target. `owner_application` используется только для проверки владельца и его lifecycle. Эти роли нельзя объединять даже тогда, когда обе сущности представлены filesystem object. `subjectId` стабилен только внутри installation key и derivation version. Он не переносится между Mac, профилями или reinstall/rekey.

# `CorrelationEdge`

Server-only relation:

* `schemaVersion`, `edgeId`, `fromSubjectId`, `toSubjectId`;
* `relation`: `remnant_of | belongs_to | installed_as | executes | opens | launches | has_receipt | depends_on | maps_payload`;
* `ruleId`, `ruleVersion` и использованные claim kinds;
* `strength`: `authoritative | corroborated | hint`;
* `resolutionState`: `resolved | ambiguous | missing | mismatch`;
* `provenanceIds`, `snapshotId`, `edgeFingerprint`.

`remnant_of` — единственная relation, которая создаёт owner binding между `library_artifact` и `owner_application`. Для неё `strength=authoritative` обязателен. `hint` не входит в mutation policy. Name/display-name/basename/bundle-ID-only match всегда не сильнее `hint`. `resolved` требует rule-specific authoritative либо независимые corroborated claims, но corroboration без authoritative `remnant_of` не создаёт owner binding. Несовместимые strong claims дают `mismatch`; несколько совместимых целей без уникального решения дают `ambiguous`.

# `OwnerBinding`

Server-only binding содержит `bindingId`, artifact/owner subject IDs, `ruleId`, `ruleVersion`, `sourceKind`, keyed claim digests, provenance, `createdAt`, `lastValidatedAt`, `bindingFingerprint` и `resolutionState`.

В v0.1 authoritative binding допускают только три источника:

1. exact package-receipt payload mapping от конкретного Library artifact к конкретному package/app owner;
2. OS-owned metadata отдельного container, если adapter проверяет документированную структуру и точное app identity;
3. installation-local historical binding, ранее созданный из подписанного executable/process и точной open-file relation к этому artifact.

Historical binding хранит только keyed digests. Он инвалидируется при rekey/reinstall, смене derivation version, artifact identity/type/root, owner identity или конфликтующем strong evidence. User attestation, path prefix, basename, display name, bundle identifier без payload relation и similarity score являются hints и не создают binding.

Первый аудит может законно оставить finding inspect-only. Отсутствие historical binding не подменяется эвристикой ради actionability.

# Правила claims

| Claim | Что доказывает | Чего не доказывает |
|---|---|---|
| Filesystem identity | Ту же ревизию локального объекта | Владельца-приложение |
| Bundle ID | Множество app candidates | Уникальное владение candidate |
| Package ID | Множество receipts/packages | Установленность или владение без payload mapping |
| Signing requirement/team | Проверенного signer/executable | Уникальное приложение; signer может быть shared |
| `uid`/`gid` | OS owner объекта | App ownership |
| Path/basename/display name | Только навигационный hint | Identity, `absent`, mutation authority |

Bundle ID без точной OS/package relation также остаётся hint. Positive evidence о другом owner или нескольких owners инвалидирует binding и блокирует mutation.

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

# Канонические query scopes v0.1

Проверка установленного owner application обязана покрывать `/Applications`, `/System/Applications`, `~/Applications` и package-registered bundles. Spotlight может дополнять inventory, но не заменяет эти roots и не создаёт `absent`.

Проверка official uninstaller обязана покрывать те же app roots и package-registered uninstallers. Сканирование произвольной файловой системы, shell-команды из UI и sudo не входят в контракт.

# Вывод states

| Условие | Fact state | Policy effect |
|---|---|---|
| Однозначный positive edge | `present` | Counter-evidence; mutation блокируется, если fact обязательный |
| Нет edge + валидный same-snapshot certificate | `absent` | Только удовлетворяет один prerequisite; mutation автоматически не разрешает |
| Нет certificate или source partial | `unknown` | Mutation блокируется |
| Несколько целей | `unknown`, reason `ambiguous` | Mutation блокируется |
| Strong claim mismatch | `unknown`, counter-evidence `mismatch` | Mutation блокируется |
| Snapshot A/B различаются | прежний state инвалидирован, `staleDuringAudit=true` | Все mutation actions пусты |

Правило применяется отдельно к `artifact_existence_state`, `owner_executable_state`, `installed_state`, `activity`, `open_file_state`, `receipt_lifecycle`, `dependency_state`, startup и uninstaller state. Positive evidence не требует полного inventory, но должно пройти identity validation и никогда не подавляется `not_applicable` другого требования.

`artifact_existence_state` описывает cleanup-target. `owner_executable_state` и `installed_state` описывают owner application. Legacy-поле `targetExecutableState` не определяет ни одно из них и допускается только как analysis-only diagnostic до миграции schema.

`receipt_lifecycle`: `live | stale | absent | unknown`.

* `live` означает, что receipt и его owner/payload relation актуальны; mutation блокируется;
* `stale` означает полный receipt query, точное payload mapping и доказанное отсутствие соответствующего installed owner; это не эквивалент `absent`, но допустимо только в узком actionable profile;
* `absent` требует полного query и certificate;
* `unknown` блокирует mutation.

# `CorrelationRequirementProfile`

Versioned server-owned profile определяет обязательные факты и их applicability. Для каждого requirement хранится `requirementId`, `applicability: required | not_applicable | unsupported`, правило applicability и safe reason code.

`not_applicable` означает, что requirement типизированно не относится к artifact/profile. Это не `absent`, не CoverageCertificate и не разрешение проигнорировать positive evidence. `unsupported` всегда блокирует mutation. UI и модель не выбирают profile или applicability.

В v0.1 существует один actionable profile: `private_regenerable_remnant_v1`. Он применим только к category `cache | log`, когда artifact является приватным регенерируемым остатком однозначно связанного отсутствующего owner и не содержит sensitive/protected data. Dependency requirement в этом профиле может быть `not_applicable` только по строгому server-owned правилу profile-owned artifact; shared или неизвестная область даёт `required`/`unsupported` и блокирует mutation.

Категории `application_support`, `container`, `group_container`, `preference`, `webkit`, `http_storage`, `saved_state`, `database`, `sync_data`, `vpn_data`, `personal_file`, `autostart` и `unknown` остаются `analysis_only` в v0.1 независимо от confidence.

# `CorrelationRevision`

Immutable revision содержит:

* `correlationRevisionId`, `schemaVersion`, `derivationVersion`;
* `auditId`, `auditRevision`, `snapshotId`;
* `snapshotAFingerprint`, `snapshotBFingerprint`;
* `subjectSetDigest`, `edgeSetDigest`, `coverageReportDigest`;
* `ruleSetVersion`, `policyVersion`, `exclusionStateVersion`;
* `ownerBindingFingerprint`, `requirementProfileId`, `requirementProfileVersion`;
* `staleDuringAudit`, `createdAt`.

Revision actionable только для terminal audit `completed | completed_with_warnings`, при `staleDuringAudit=false`, валидном authoritative owner binding, поддержанном actionable profile и полном coverage всех `required` facts конкретного policy rule.

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

Resolver использует стабильные коды `CORRELATION_AMBIGUOUS`, `CORRELATION_MISSING`, `CORRELATION_MISMATCH`, `CORRELATION_COVERAGE_INCOMPLETE`, `CORRELATION_SNAPSHOT_STALE`, `CORRELATION_SCHEMA_UNSUPPORTED`, `CORRELATION_KEY_UNAVAILABLE`, `CORRELATION_MIGRATION_REQUIRED`, `OWNER_BINDING_MISSING`, `OWNER_BINDING_STALE` и `REQUIREMENT_PROFILE_UNSUPPORTED`. Ни один код не содержит raw identity в сообщении.

# Связанные концепты

* [ADR-0012](../decisions/ADR-0012-server-owned-correlation-identity.md)
* [ADR-0013](../decisions/ADR-0013-actionable-library-remnant-correlation.md)
* [Доменная модель](domain-model.md)
* [MCP-tools](mcp-tools.md)
* [Контракт ошибок](errors.md)
* [Стратегия тестирования](../quality/test-strategy.md)

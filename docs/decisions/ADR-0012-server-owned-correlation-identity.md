---
type: ADR
title: "ADR-0012: server-owned correlation identity и доказуемое отсутствие"
description: Фиксация локальной correlation layer, полноты negative evidence, snapshot revision и privacy-safe derivation.
tags: [adr, correlation, identity, evidence, privacy, safety]
status: approved
owner: Architect
date: 2026-07-18
---

# Контекст

Канон требует отдельно проверять installed app, процессы, открытые файлы, receipts, зависимости, owner, filesystem state и temporal evidence. Реализованные adapters создают независимые opaque `targetRef`: Library candidate, установленное приложение, процесс и receipt не имеют общего server-only предмета корреляции. Текущий normalizer может объединить только observations, которым заранее выдан один `targetRef`, либо принять готовый signal, уже привязанный к candidate.

Production runtime PR #34 поэтому не может честно выдать candidate-specific negative evidence. Пустой список установленного ПО, процессов, open files или receipts не доказывает отсутствие совпадения. Связывание по basename, display name или единственному похожему bundle/package field нарушило бы запрет name-only resolution и могло бы разрешить mutation личных или shared-данных.

# Решение

## 1. Correlation layer принадлежит только серверу

Локальный сервер вводит versioned `CorrelationSubject`, `CorrelationEdge`, `SourceProvenance`, `CoverageCertificate` и immutable `CorrelationRevision`. Adapters передают resolver типизированные raw local claims внутри процесса. Resolver создаёт stable opaque subjects, связывает observations по named versioned rules и выпускает safe facts. Модель и widget не получают raw claims, correlation graph или локальный inventory.

`targetRef` остаётся opaque ссылкой observation и не считается correlation identity. Совпадение `targetRef`, пути, basename, display name либо имени процесса само по себе не создаёт edge и не разрешает mutation.

## 2. Три представления identity не смешиваются

* `RawLocalIdentity` существует только в памяти resolver на время одного source query. Она может содержать canonical path, filesystem identity, bundle/package claims, code-signing requirement, executable target и OS owner. Она не сериализуется, не логируется и не входит в MCP output.
* `PersistedLocalIdentity` хранит только versioned, domain-separated keyed digests и безопасную техническую provenance. Она локальна для одной установки и не переносится как публичный inventory.
* `SafeCorrelationView` содержит только opaque finding/revision IDs, трёхзначные facts, coverage gaps, `staleDuringAudit`, blocking reasons и разрешённые сервером actions. Это единственное представление для модели и widget.

## 3. Identity claims имеют разные полномочия

* Filesystem identity (`device`, `inode`, type, owner, parent/root containment и fingerprint) идентифицирует текущую ревизию объекта, но не доказывает владельца-приложение. Path-only resolution запрещён.
* Bundle ID формирует множество кандидатов. Для resolved app relation нужны совместимые bundle metadata и signing/executable либо другой независимый authoritative claim. Display name и bundle ID по отдельности недостаточны.
* Package ID формирует множество receipts. Relation требует валидного receipt и payload/target mapping той же snapshot revision; package ID или имя package по отдельности недостаточны.
* Signing identity использует нормализованный designated requirement/team identifier и проверенный executable. Certificate display name не используется; общий signer не доказывает владение конкретным candidate.
* OS `uid`/`gid` доказывают владельца filesystem object, но не app ownership. Unexpected owner или смена type/fingerprint являются counter-evidence и блокируют mutation.

Каждый edge получает результат `resolved | ambiguous | missing | mismatch`. `ambiguous` и `missing` дают `unknown`. `mismatch` сохраняется как counter-evidence, отклоняет edge и блокирует mutation. Ни один из этих результатов не преобразуется в `absent` без отдельного completeness certificate.

## 4. `absent` требует доказуемой полноты

`absent` допустим только для конкретного subject, source и query scope, когда:

1. capability и требуемое permission доступны;
2. источник полностью перечислил канонический scope;
3. query завершился без cancellation, truncation, parse loss или partial inventory;
4. query и candidate относятся к одному logical snapshot;
5. resolver однозначно применил все релевантные identity rules;
6. `CoverageCertificate` и query fingerprint вошли в ту же `CorrelationRevision`.

Пустой ответ без сертификата полноты остаётся `unknown`. Permission denial, unavailable capability, partial inventory, timeout, cancelled query, неоднозначность, несовместимая schema и parse warning всегда дают `unknown`. Positive counter-evidence `present` блокирует действие даже при неполном source coverage.

## 5. Snapshot A/B и immutable revision

Snapshot A фиксирует candidate, parent, source capabilities и начальные fingerprints. Все source queries получают один `snapshotId`. Snapshot B повторно вычисляет candidate/parent identity и fingerprints всех claims, влияющих на policy. Любое различие, появление неоднозначности или невозможность перепроверки выставляет `staleDuringAudit=true`, аннулирует negative evidence и оставляет пустые mutation actions.

Завершённый аудит сохраняет immutable `CorrelationRevision`: digest subject/edge graph, coverage report, source-query fingerprints, snapshot A/B и versioned rules. Destructive token привязан к audit revision, correlation revision, candidate и parent fingerprints, exclusion state version, policy/rule versions, action, UI session и сроку. Изменение любого поля требует нового аудита; token не переносится между revisions.

## 6. Counter-evidence имеет приоритет

Installed app, active process, open file, live startup target, valid receipt, official uninstaller и dependency relation являются отдельными typed facts. Любой однозначный `present` либо identity mismatch блокирует mutation. `absent` разрешает продолжение policy только при полном same-snapshot coverage всех обязательных для правила источников; оно само по себе не разрешает mutation.

## 7. Privacy-safe persistence и UserExclusion

Для derivation используется случайный installation-local 256-bit key и HMAC-SHA-256 с domain separation, normalization version и claim kind. Обычный hash или публичная salt недостаточны: bundle IDs, package IDs, product names и типовые пути имеют малое пространство перебора и уязвимы для dictionary attack. Salt может разделять stores, но не заменяет secret key.

Ключ хранится отдельно в plugin-owned state с правами `0600`; store directory имеет `0700`. `UserExclusion` новой схемы хранит только `keyId`, `derivationVersion`, subject digest и применимые claim digests. Он не содержит plaintext path, bundle/package/signing identity или переносимый список приложений. Потерянный, повреждённый или неизвестный key/schema не скрывает findings и блокирует destructive-token issuance до восстановления, удаления либо повторного создания exclusion.

Известная legacy schema мигрирует локально и атомарно: валидные legacy fields преобразуются в keyed digests, новый файл проходит reread validation, затем raw legacy fields удаляются из active store. Если точная derivation невозможна, запись получает `migration_required`, finding остаётся видимым, а mutation блокируется. Legacy `Observation`/`EvidenceSet` читаются только как analysis-only данные и не образуют actionable revision.

## 8. Raw identity не покидает boundary

Raw paths, app inventory, bundle/package/signing identities, command output, tokens и personal data запрещены в model output, widget hydration, обычных логах, telemetry, persisted audit reports, checked-in fixtures, snapshots и PR evidence. Telemetry отсутствует. Логи содержат только safe error code, opaque revision/source ID и агрегированные counts.

Deterministic tests строят raw synthetic inputs во временном каталоге из фиксированного seed; checked-in golden output содержит только safe view и digests. Reserved synthetic identities не копируют локальный inventory. Package/stdio E2E после core implementation использует synthetic HOME и plugin state, проверяет audit → correlation → prepare → move → restore без реальной mutation Mac и без утечки raw inputs в output.

## 9. UI не имеет authority

Widget получает только `SafeCorrelationView` и server-owned actions. Он не получает raw path, inventory, signing/package claims, correlation edges, coverage certificates или destructive token material. App-only prepare возвращает безопасный preview и opaque action handle; token и его binding остаются в server session. Подделка UI state, safe facts или handle не меняет policy.

# Совместимость и порядок реализации

ADR-0012 расширяет ADR-0010 и ADR-0011, не ослабляя protected scopes, quarantine, one-object confirmation, no-terminal flow или границы v0.1.

* `Observation.targetRef` остаётся допустимым legacy transport reference, но больше не является identity.
* `EvidenceSet` получает correlation revision, provenance и coverage semantics; legacy set не actionable.
* `UserExclusion` переходит на installation-keyed derivation с fail-closed migration.
* Действующие audit revisions и preview tokens старой схемы инвалидируются при включении resolver.

Обязательный порядок: merge CMC-20 → merge CMC-21 с core resolver → возобновление того же CMC-09 Worker/worktree/ветки/PR #34 для production wiring и packaged stdio E2E. Новый CMC-09 Worker, worktree, ветка или PR не создаются.

# Последствия

* Полезное candidate-specific negative evidence становится возможным без раскрытия identity модели или UI.
* Completeness — проверяемое свойство source query, а не вывод из пустого массива.
* Локальная persistence не является переносимым fingerprint пользователя, но компрометация процесса с тем же UID и key file остаётся остаточным риском.
* Core implementation имеет high risk и выполняется последовательно; PR #34 остаётся заблокирован до её merge.

# Связанные концепты

* [Контракт correlation identity](../contracts/correlation-identity.md)
* [Доменная модель](../contracts/domain-model.md)
* [Runtime flows](../architecture/runtime-flows.md)
* [Модель безопасности](../safety/safety-model.md)
* [Модель угроз](../safety/threat-model.md)
* [Спецификация CMC-20](../superpowers/specs/2026-07-18-server-owned-correlation-identity.md)

---
type: Domain Model
title: Доменная модель аудита и карантина
description: Канонические сущности, связи и инварианты данных Codex Mac Cleaner.
tags: [contracts, domain, evidence, policy]
status: approved
owner: Architect
date: 2026-07-19
---

# `AuditRun`

Один запуск аудита.

Обязательные поля: `auditId`, `requestId`, `profile`, `state`, `stateVersion`, `startedAt`, `finishedAt`, `cancelRequestedAt`, `capabilities`, `coverage`, `warnings`, `revision`, `correlationRevisionId`, `schemaVersion`.

Допустимые состояния: `queued`, `running`, `cancelling`, `cancelled`, `completed`, `completed_with_warnings`, `failed`. После terminal state отчёт неизменяем. Только `completed` и `completed_with_warnings` могут содержать actionable revision; в `cancelled` все `allowedActions` пусты.

# `Finding`

Нормализованная находка внутри одной ревизии.

Обязательные поля: `findingId`, `auditId`, `revision`, `correlationRevisionId`, `displayName`, `componentDisplayName`, `canonicalPath`, `artifactKind`, `category`, `supportLevel`, `logicalSize`, `physicalSize`, `findingFacts`, `reclaimEstimate`, `safeMetadata`, `label`, `confidence`, `evidenceSet`, `risk`, `snapshotFingerprint`, `staleDuringAudit`, `allowedActions`.

`artifactKind`: `file`, `directory`, `bundle`, `plist`, `launch_item`, `receipt` или `unknown`. `category`: `cache`, `log`, `webkit`, `http_storage`, `saved_state`, `application_support`, `container`, `group_container`, `preference`, `database`, `sync_data`, `vpn_data`, `personal_file`, `autostart` или `unknown`. Размеры измеряются в байтах и относятся к ревизии аудита.

`canonicalPath` — server-only поле local runtime. Модель, widget hydration, logs и persisted safe report не получают ни исходный, ни обратимо обезличенный путь. Reveal и mutation разрешают path по `findingId` и immutable revision внутри сервера.

`supportLevel`: `candidate`, `analysis_only` или `unsupported_manual`. Для `analysis_only` и `unsupported_manual` из filesystem-действий допустим только `inspect`; локальное `exclude` может быть доступно отдельно, но не разрешает mutation.

# `FindingFacts`

Server-owned safe сводка содержит `lastObservedAt`, `temporalKind`, `artifactExistenceState`, `ownerBindingState`, `ownerApplicationState`, `ownerExecutableState`, `activityState`, `openFileState`, `startupKinds`, `uninstallerState`, `receiptLifecycle`, `dependencyState`, `requirementProfileId`, `requirementApplicability`, `coverageSummary`, `staleDuringAudit`, `sensitivityFlags`, `recommendedRemovalMethod` и `blockingReasons`.

`artifactExistenceState` относится к Library cleanup-target. `ownerApplicationState` и `ownerExecutableState` относятся к отдельно разрешённому owner. `ownerBindingState`: `resolved | ambiguous | missing | mismatch | stale`. Только `resolved` authoritative binding может участвовать в mutation policy. Legacy `targetExecutableState` разрешён только как analysis-only diagnostic и не отображается в actionable policy.

Трёхзначные states используют `present | absent | unknown` либо эквивалентный закрытый enum. `absent` допустим только с полным same-snapshot `CoverageCertificate`; пустой output не является доказательством. Permission/capability gap, partial inventory, parse loss, ambiguous/missing/mismatch и stale snapshot дают `unknown`. `receiptLifecycle` использует `live | stale | absent | unknown`. `recommendedRemovalMethod`: `quarantine`, `official_uninstaller`, `close_and_recheck`, `advanced_mode` или `inspect_only`.

`requirementApplicability` содержит безопасную карту `requirementId → required | not_applicable | unsupported`. `not_applicable` не является `absent`, не выпускает certificate и не подавляет positive evidence. Profile и applicability выбирает только server policy.

# `ReclaimEstimate`

Содержит неотрицательные `estimatedPhysicalBytes`, `confidence`, `basis`, `limitations` и `observedAt`. Это snapshot-оценка, а не обещание изменения `df`; stale receipt может иметь `estimatedPhysicalBytes=0`.

# `SafeMetadata`

Содержит `format`, `parseStatus`, `byteLength`, `modifiedAt`, `declaredOwnerDisplayName` и `sensitivityFlags`. Допустимые sensitivity flags: `credentials`, `tokens`, `subscription_url`, `personal_data`, `database`, `local_project`.

Сырые ключи и значения JSON/YAML/plist, содержимое, секреты, stderr и полный путь в сущность не входят.

# `Evidence`

Структурированное наблюдение:

* `evidenceId`;
* `ruleInputType`;
* `sourceAdapter`;
* `outcome`: `confirmed`, `contradicted` или `unknown`;
* `observedAt`;
* `summary`;
* safe `provenanceId`, `coverageState` и `correlationRevisionId`;
* `details` без raw identity, содержимого пользовательского файла или inventory.

# Correlation entities

`CorrelationSubject`, `CorrelationEdge`, `OwnerBinding`, `CorrelationRequirementProfile`, `SourceProvenance`, `CoverageCertificate` и `CorrelationRevision` являются server-only сущностями [отдельного контракта](correlation-identity.md). `Observation.targetRef` — transport reference, а не identity. External view получает только opaque revision ID, safe facts, profile ID и coverage gaps.

# `Classification`

Содержит `label`, `confidence`, `ruleIds`, `explanation`, `counterEvidence` и `missingEvidence`.

Допустимые метки: `active_required`, `idle_reproducible`, `orphaned`, `duplicate`, `unknown`. Уверенность: `high`, `medium` или `low`.

# `PolicyDecision`

Содержит `allowedActions`, `blockingRuleIds`, `warnings` и `evaluatedFingerprint`.

Допустимые действия: `inspect`, `reveal`, `exclude`, `prepare_move`, `prepare_restore`, `prepare_purge`.

Классификация `orphaned` не гарантирует `prepare_move`. В v0.1 `prepare_move` допускается только для `private_regenerable_remnant_v1` и категорий `cache | log`; остальные категории application remnants остаются inspect-only.

# `ProtectedScopeRule`

Встроенное server-only правило с `ruleId`, `kind: system_scope | credential_store | browser_profile | personal_data | current_project_root | plugin_owned_state | codex_state | local_git_repository`, безопасным объяснением и непустым `effects` из `exclude_from_candidates | block_mutation`. Hard exclusions содержат оба эффекта. Публичного API для изменения правил нет; персональные пути и названия приложений разработчика отсутствуют.

# `UserExclusion`

Изменяемое пользователем локальное правило, отдельное от `ProtectedScopeRule`. Новая схема содержит `schemaVersion`, `exclusionId`, `ruleId`, `artifactKind`, `keyId`, `derivationVersion`, `subjectDigest`, применимые typed `claimDigests`, `createdAt` и безопасную `reasonCategory`.

Path/name-only equality запрещена. Match требует совпадения полного обязательного keyed claim set той же derivation version. Plaintext bundle/package/signing/path fields не сохраняются. Несовпадение снова показывает finding. Совпавший exclusion не получает destructive action token. Model-visible output содержит только общий счётчик исключённых объектов.

# `ScheduleIntent` и `ScheduleState`

`ScheduleIntent` содержит server-generated `intentId`, действие `enable | update | pause | resume | delete`, локальные day/time параметры, `requestId`, `createdAt` и состояние `requested | awaiting_confirmation | completed | capability_unavailable | failed`. Raw RRULE отсутствует.

`ScheduleState` содержит `schemaVersion`, `enabled`, opaque `automationId`, `dayOfMonth`, `localTime`, `nextRunAt`, `lastRunAt`, `updatedAt` и `capabilityState`. MCP-сервер хранит state, но не вызывает host-native automation. Неизвестная schema version работает fail closed для изменения расписания.

По ADR-0014 эти сущности в v0.1 являются только инертной compatibility groundwork. Каноническое состояние v0.1 — `enabled=false`, `automationId=null`, без next/last scheduled run. Вкладка «Расписание» запускает обычный ручной audit; lifecycle transitions и scheduled prompt принадлежат post-v0.1 CMC-13.

# `SnapshotFingerprint`

Содержит признаки, достаточные для обнаружения гонки: `device`, `inode`, `mode`, `uid`, `gid`, `size`, `mtimeNs`, `ctimeNs`, `fileType`, `mountId` и признак симлинка.

Snapshot A/B дополняются server-only fingerprints parent identity, source query и claims, влияющих на policy. Они входят в immutable `CorrelationRevision`; различие выставляет `staleDuringAudit` и инвалидирует actions.

# `QuarantineOperation`

Связывает `operationId`, действие, audit revision, finding, preview token, исходный путь, payload, fingerprint, подтверждение, состояние и журнал событий.

# `StorageSummary`

Серверная сводка содержит `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и `stateVersion`.

* `candidateLogicalBytes` — logical size находок текущей завершённой ревизии;
* `candidatePhysicalBytes` — physical size находок текущей завершённой ревизии;
* `quarantinePhysicalBytes` — physical size payload в состоянии `moved`;
* `purgedPhysicalBytes` — physical size записей `purged` в действующем локальном журнале.

Все поля — неотрицательные целые байты. `purgedPhysicalBytes` не равен изменению свободного места APFS.

# `DiskObservation`

Server-owned наблюдение содержит неотрицательные целые `availableBytes`, `totalBytes`, ISO-время `observedAt` и `source: statfs`. Оно относится к серверному snapshot, но не доказывает, что изменение свободного места вызвано последней операцией. Имена и идентификаторы томов в model-visible форму не входят.

# `CapabilityReport` и coverage

Перечисляет поддержанные источники, доступные корни, query scopes, недоступные области и причину каждого пропуска. Полный server-only coverage report связывает source provenance и completeness certificates с correlation revision. Safe view раскрывает только source class, counts и gap codes. Неполное покрытие не маскируется значением «проверено» и не создаёт `absent`.

# Связанные концепты

* [Модель аудита](../architecture/runtime-flows.md)
* [Correlation identity](correlation-identity.md)
* [Манифест карантина](quarantine-manifest.md)
* [Safety model](../safety/safety-model.md)

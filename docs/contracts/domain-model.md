---
type: Domain Model
title: Доменная модель аудита и карантина
description: Канонические сущности, связи и инварианты данных Codex Mac Cleaner.
tags: [contracts, domain, evidence, policy]
status: approved
owner: Architect
date: 2026-07-15
---

# `AuditRun`

Один запуск аудита.

Обязательные поля: `auditId`, `requestId`, `profile`, `state`, `stateVersion`, `startedAt`, `finishedAt`, `cancelRequestedAt`, `capabilities`, `coverage`, `warnings`, `revision`, `schemaVersion`.

Допустимые состояния: `queued`, `running`, `cancelling`, `cancelled`, `completed`, `completed_with_warnings`, `failed`. После terminal state отчёт неизменяем. Только `completed` и `completed_with_warnings` могут содержать actionable revision; в `cancelled` все `allowedActions` пусты.

# `Finding`

Нормализованная находка внутри одной ревизии.

Обязательные поля: `findingId`, `auditId`, `revision`, `displayName`, `componentDisplayName`, `canonicalPath`, `artifactKind`, `category`, `supportLevel`, `logicalSize`, `physicalSize`, `findingFacts`, `reclaimEstimate`, `ownerCandidates`, `safeMetadata`, `label`, `confidence`, `evidenceSet`, `risk`, `snapshotFingerprint`, `allowedActions`.

`artifactKind`: `file`, `directory`, `bundle`, `plist`, `launch_item`, `receipt` или `unknown`. `category`: `cache`, `log`, `webkit`, `http_storage`, `saved_state`, `application_support`, `container`, `group_container`, `preference`, `database`, `sync_data`, `vpn_data`, `personal_file`, `autostart` или `unknown`. Размеры измеряются в байтах и относятся к ревизии аудита.

`canonicalPath` остаётся локальным и передаётся модели только в обезличенной форме.

`supportLevel`: `candidate`, `analysis_only` или `unsupported_manual`. Для `analysis_only` и `unsupported_manual` из filesystem-действий допустим только `inspect`; локальное `exclude` может быть доступно отдельно, но не разрешает mutation.

# `FindingFacts`

Server-owned сводка содержит `lastObservedAt`, `temporalKind`, `mainBundleState`, `activityState`, `openFileState`, `startupKinds`, `targetExecutableState`, `receiptState`, `dependencyState`, `sensitivityFlags`, `recommendedRemovalMethod` и `blockingReasons`.

Трёхзначные states используют `present | absent | unknown` либо эквивалентный закрытый enum. `recommendedRemovalMethod`: `quarantine`, `official_uninstaller`, `close_and_recheck`, `advanced_mode` или `inspect_only`. Неизвестное состояние не трактуется как отсутствие.

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
* `details` без содержимого пользовательского файла.

# `Classification`

Содержит `label`, `confidence`, `ruleIds`, `explanation`, `counterEvidence` и `missingEvidence`.

Допустимые метки: `active_required`, `idle_reproducible`, `orphaned`, `duplicate`, `unknown`. Уверенность: `high`, `medium` или `low`.

# `PolicyDecision`

Содержит `allowedActions`, `blockingRuleIds`, `warnings` и `evaluatedFingerprint`.

Допустимые действия: `inspect`, `reveal`, `exclude`, `prepare_move`, `prepare_restore`, `prepare_purge`.

Классификация `orphaned` не гарантирует `prepare_move`.

# `ProtectedScopeRule`

Встроенное server-only правило с `ruleId`, `kind: system_scope | credential_store | browser_profile | personal_data | current_project_root | plugin_owned_state | codex_state | local_git_repository`, безопасным объяснением и непустым `effects` из `exclude_from_candidates | block_mutation`. Hard exclusions содержат оба эффекта. Публичного API для изменения правил нет; персональные пути и названия приложений разработчика отсутствуют.

# `UserExclusion`

Изменяемое пользователем локальное правило, отдельное от `ProtectedScopeRule`. Содержит `schemaVersion`, `exclusionId`, `ruleId`, `artifactKind`, `normalizedTargetIdentity`, опциональные `bundleId`/`packageId`, `signingIdentity`, `ownerTypeFingerprint`, `createdAt` и безопасную `reasonCategory`.

Path-only equality запрещена. Match требует совпадения всех применимых identity fields. Несовпадение снова показывает finding. Совпавший exclusion не получает destructive action token. Model-visible output содержит только общий счётчик исключённых объектов.

# `ScheduleIntent` и `ScheduleState`

`ScheduleIntent` содержит server-generated `intentId`, действие `enable | update | pause | resume | delete`, локальные day/time параметры, `requestId`, `createdAt` и состояние `requested | awaiting_confirmation | completed | capability_unavailable | failed`. Raw RRULE отсутствует.

`ScheduleState` содержит `schemaVersion`, `enabled`, opaque `automationId`, `dayOfMonth`, `localTime`, `nextRunAt`, `lastRunAt`, `updatedAt` и `capabilityState`. MCP-сервер хранит state, но не вызывает host-native automation. Неизвестная schema version работает fail closed для изменения расписания.

# `SnapshotFingerprint`

Содержит признаки, достаточные для обнаружения гонки: `device`, `inode`, `mode`, `uid`, `gid`, `size`, `mtimeNs`, `ctimeNs`, `fileType`, `mountId` и признак симлинка.

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

# `CapabilityReport`

Перечисляет поддержанные источники, доступные корни, недоступные области и причину каждого пропуска. Неполное покрытие не маскируется значением «проверено».

# Связанные концепты

* [Модель аудита](../architecture/runtime-flows.md)
* [Манифест карантина](quarantine-manifest.md)
* [Safety model](../safety/safety-model.md)

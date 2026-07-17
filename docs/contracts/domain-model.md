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

Обязательные поля: `findingId`, `auditId`, `revision`, `displayName`, `canonicalPath`, `artifactKind`, `category`, `supportLevel`, `logicalSize`, `physicalSize`, `ownerCandidates`, `safeMetadata`, `label`, `confidence`, `evidenceSet`, `risk`, `snapshotFingerprint`, `allowedActions`.

`artifactKind`: `file`, `directory`, `bundle`, `plist`, `launch_item`, `receipt` или `unknown`. `category`: `cache`, `log`, `webkit`, `http_storage`, `saved_state`, `application_support`, `container`, `group_container`, `preference`, `database`, `sync_data`, `vpn_data`, `personal_file`, `autostart` или `unknown`. Размеры измеряются в байтах и относятся к ревизии аудита.

`canonicalPath` остаётся локальным и передаётся модели только в обезличенной форме.

`supportLevel`: `candidate`, `analysis_only` или `unsupported_manual`. Для `analysis_only` и `unsupported_manual` допустим только `inspect`; остальные действия отсутствуют.

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

Допустимые действия: `inspect`, `reveal`, `prepare_move`, `prepare_restore`, `prepare_purge`.

Классификация `orphaned` не гарантирует `prepare_move`.

# `ProtectedScopeRule`

Встроенное server-only правило с `ruleId`, `kind: canonical_prefix | owner_identity | local_git_repository`, безопасным объяснением и непустым `effects` из `exclude_from_candidates | block_mutation`. Hard exclusions содержат оба эффекта. Публичного API для изменения правил нет.

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

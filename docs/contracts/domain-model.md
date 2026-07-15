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

Обязательные поля: `auditId`, `requestId`, `profile`, `state`, `stateVersion`, `startedAt`, `finishedAt`, `capabilities`, `coverage`, `warnings`, `revision`, `schemaVersion`.

После состояния `completed` или `completed_with_warnings` ревизия неизменяема.

# `Finding`

Нормализованная находка внутри одной ревизии.

Обязательные поля: `findingId`, `auditId`, `revision`, `displayName`, `canonicalPath`, `artifactKind`, `category`, `logicalSize`, `physicalSize`, `ownerCandidates`, `label`, `confidence`, `evidenceSet`, `risk`, `snapshotFingerprint`, `allowedActions`.

`artifactKind`: `file`, `directory`, `bundle`, `plist`, `launch_item`, `receipt` или `unknown`. `category`: `cache`, `log`, `webkit`, `http_storage`, `saved_state`, `application_support`, `container`, `group_container`, `preference`, `database`, `sync_data`, `vpn_data`, `personal_file`, `autostart` или `unknown`. Размеры измеряются в байтах и относятся к ревизии аудита.

`canonicalPath` остаётся локальным и передаётся модели только в обезличенной форме.

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

# `SnapshotFingerprint`

Содержит признаки, достаточные для обнаружения гонки: `device`, `inode`, `mode`, `uid`, `gid`, `size`, `mtimeNs`, `ctimeNs`, `fileType`, `mountId` и признак симлинка.

# `QuarantineOperation`

Связывает `operationId`, действие, audit revision, finding, preview token, исходный путь, payload, fingerprint, подтверждение, состояние и журнал событий.

# `CapabilityReport`

Перечисляет поддержанные источники, доступные корни, недоступные области и причину каждого пропуска. Неполное покрытие не маскируется значением «проверено».

# Связанные концепты

* [Модель аудита](../architecture/runtime-flows.md)
* [Манифест карантина](quarantine-manifest.md)
* [Safety model](../safety/safety-model.md)

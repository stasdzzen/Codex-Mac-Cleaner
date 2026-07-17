---
type: MCP Contract
title: Манифест и журнал карантина
description: Durable формат операции, переходы состояний и recovery-инварианты.
tags: [contracts, quarantine, manifest, recovery]
status: approved
owner: Architect
date: 2026-07-15
---

# Файловая структура

```text
~/Library/Application Support/Codex Mac Cleaner/
├── reports/<audit-id>/
│   ├── manifest.json
│   └── findings.ndjson
├── quarantine/<operation-id>/
│   ├── manifest.json
│   └── payload/
│       └── object
├── state/
│   ├── exclusions.json
│   └── schedule.json
└── journal/
    └── operations.ndjson
```

Каталоги получают права `0700`, файлы — `0600`. `state/exclusions.json` и `state/schedule.json` версионируются и записываются через тот же atomic-write primitive, но не входят в quarantine manifest и никогда не хранятся в репозитории или `~/.codex`.

# Обязательные поля manifest

* `schemaVersion`;
* `operationId`;
* `action`;
* `state`;
* `auditId`, `auditRevision`, `findingId`;
* `sourcePath` и `payloadPath`;
* `sourceFingerprint` и `sourceParentFingerprint`;
* `artifactKind`, `category`, `physicalSize`;
* `classificationRuleIds` и `policyRuleIds`;
* `previewTokenId` без самого секрета;
* `confirmedAt`, `preparedAt`, `movedAt`, `restoredAt`, `purgedAt`;
* `lastErrorCode`;
* `eventSequence`.

# Состояния

Основной путь: `previewed → prepared → moved → restored | purged`.

Аварийные состояния: `aborted`, `conflicted`, `inconsistent`.

`restored` и `purged` — терминальные состояния. `inconsistent` блокирует mutation-контур до ручного разбора.

# Запись

Manifest записывается через временный файл, `fsync` и atomic rename. Journal append-only; каждая запись содержит monotonic `eventSequence` и `operationId`.

Имя `object` фиксировано сервером. Исходное имя хранится в `sourcePath` и не используется для построения пути внутри карантина.

# Recovery

Сервер не доверяет последнему записанному state без сверки source и payload. Правила reconciliation описаны в [runtime-потоках](../architecture/runtime-flows.md).

# Приватность

Манифест не хранит содержимое файлов, content hash, токены, текст документов или сырые диагностические дампы.

---
type: ADR
title: "ADR-0005: файловое хранилище без базы данных"
description: Выбор JSON и NDJSON для отчётов, журналов и manifests карантина.
tags: [adr, storage, json, recovery]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Локальному продукту нужны прозрачные immutable reports, append-only journal и durable manifests. Полноценная база данных добавляет миграции и recovery surface без необходимой пользы для v0.1.

# Решение

Хранить audit metadata и quarantine manifests в JSON, findings и operation journal — в NDJSON. Базу данных не использовать.

# Структура

* `reports/<audit-id>/manifest.json`;
* `reports/<audit-id>/findings.ndjson`;
* `quarantine/<operation-id>/manifest.json`;
* `quarantine/<operation-id>/payload/`;
* `journal/operations.ndjson`.

# Последствия

* Все схемы имеют `schemaVersion`.
* Файлы записываются атомарно, а критический manifest синхронизируется до rename.
* Каталоги имеют права `0700`, файлы — `0600`.
* Повреждение или неизвестная breaking-схема работает fail closed.
* Переход к SQLite или другому хранилищу требует ADR и миграционного плана с проверкой restore.

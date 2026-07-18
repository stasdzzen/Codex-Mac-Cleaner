---
type: Design Specification
title: Actionable correlation для Library remnants
description: Утверждённый design delta ADR-0013 для безопасного production flow CMC-21.
tags: [spec, correlation, library, remnants, safety]
status: approved
owner: Architect
date: 2026-07-18
---

# Проблема

Production collector CMC-21 технически собирал macOS sources, но тестировал `.app` как cleanup candidate. Реальный `application_remnants` candidate — artifact внутри user Library. Текущая модель не могла одновременно сохранить запрет name-only matching, доказать owner relation и получить actionable policy result.

# Утверждённая модель

* Cleanup identity: `LibraryArtifactSubject`.
* Owner identity: `OwnerApplicationSubject`.
* Единственная action-authority связь: authoritative `remnant_of`.
* Источники binding v0.1: exact receipt payload, OS-owned individual-container metadata, installation-local keyed history от signed process/open-file relation.
* `artifactExistenceState` и `ownerExecutableState` независимы.
* Receipt имеет lifecycle `live | stale | absent | unknown`.
* Applicability имеет `required | not_applicable | unsupported`; только server-owned versioned profile назначает `not_applicable`.

# Actionable профиль

`private_regenerable_remnant_v1` поддерживает только `cache` и `log`. Для action нужны resolved binding, stable artifact/parent Snapshot A/B, complete owner-app/process/open-file/startup/uninstaller negative evidence, receipt `absent|stale`, known regenerable data, пустые sensitivity/protection flags и one-object quarantine policy.

Binary dependency graph для private non-executable cache/log получает profile-owned `not_applicable`. Это не negative evidence и не отменяет любой найденный positive relation.

# Inspect-only граница

Name-only findings и категории Application Support, Containers, Group Containers, Preferences, WebKit, HTTPStorages, Saved Application State, database, sync/VPN и personal data не получают `prepare_move` в v0.1. UI показывает безопасную причину: missing/ambiguous owner binding, coverage gap, unsupported category или positive evidence.

# Обязательное production доказательство

Synthetic E2E строит Library artifact, а не `.app`:

1. подписанный synthetic owner process в revision N открывает private cache/log и создаёт keyed historical binding;
2. в revision N+1 owner app/executable отсутствуют при complete canonical inventory;
3. artifact/parent стабильны, activity/open/startup/uninstaller отсутствуют, receipt stale/absent, dependency not applicable по profile;
4. resolver выдаёт `remnant_of=resolved`, classifier — `orphaned`, policy — `prepare_move`;
5. подмена binding, positive process/receipt/uninstaller, partial inventory, sensitive category или Snapshot race очищают action.

# Запрещённые shortcut

* считать имя cache directory bundle ID authority;
* использовать private synthetic Info.plist key как production uninstaller source;
* заменять `partial_inventory` на `complete` без declared scope;
* считать `not_applicable` значением `absent`;
* переносить raw historical mapping в store, output, logs или fixtures;
* расширять actionable categories без нового ADR.

# Delivery

CMC-22/#39 меняет только канон. После его merge тот же CMC-21 Worker обновляет существующий PR #38. Новый CMC-21 Worker/PR запрещён.

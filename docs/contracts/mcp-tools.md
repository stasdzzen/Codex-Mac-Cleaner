---
type: MCP Contract
title: Контракт MCP-tools
description: Имена, видимость, влияние и данные tools Codex Mac Cleaner v0.1.
tags: [contracts, mcp, tools, ui]
status: approved
owner: Architect
date: 2026-07-15
---

# Архитектурный тип

Приложение использует interactive-decoupled pattern. Data tools не подключают UI-шаблон. `dashboard_open` подключает версионированный ресурс, а App вызывает app-visible actions через MCP Apps `tools/call`.

# Model-visible tools

| Tool | Назначение | Главный вход | Главный выход |
|---|---|---|---|
| `audit_start` | Начать read-only аудит | `requestId`, `profile=application_remnants` | `auditId`, `state`, `stateVersion` |
| `audit_status` | Получить прогресс | `auditId` | state, progress, coverage warnings |
| `audit_cancel` | Отменить read-only аудит | `auditId`, `requestId` | state, stateVersion, cancelRequestedAt |
| `audit_results` | Получить страницу результатов | `auditId`, `revision`, `cursor`, filters | summary, finding IDs, next cursor |
| `dashboard_open` | Открыть Audit Dashboard | `auditId`, `revision` | widget snapshot |
| `finding_inspect` | Повторно проверить находку | `findingId`, `auditRevision` | evidence, policy, stale flag |
| `finding_reveal` | Показать объект в Finder | `findingId`, `auditRevision` | outcome |
| `schedule_intent_get` | Получить ожидающий host intent | `intentId` | безопасные day/time/action и capability requirement |
| `schedule_intent_complete` | Записать результат host automation action | `intentId`, `requestId`, outcome, opaque automation ID | schedule state |

# App-visible tools

Эти tools получают `_meta.ui.visibility: ["app"]` и недоступны модели.

| Tool | Назначение | Destructive |
|---|---|---|
| `quarantine_prepare_move` | Подготовить preview token для одной находки | Нет |
| `quarantine_move` | Переместить одну находку в карантин | Да, хотя действие обратимо |
| `quarantine_list` | Получить записи и `StorageSummary` | Нет |
| `quarantine_prepare_restore` | Подготовить восстановление одной записи | Нет |
| `quarantine_restore` | Вернуть payload без перезаписи | Нет |
| `quarantine_prepare_purge` | Подготовить необратимую очистку одной записи | Нет |
| `quarantine_purge` | Удалить один payload из карантина | Да |
| `exclusion_create` | Сохранить identity finding как пользовательское исключение | Нет |
| `exclusion_list` | Получить список исключений и фильтры | Нет |
| `exclusion_remove` | Вернуть одно исключение в будущую проверку | Нет |
| `exclusion_reset_prepare` | Подготовить подтверждение сброса всех исключений | Нет |
| `exclusion_reset` | Удалить все пользовательские исключения из local state | Нет |
| `schedule_request` | Создать enable/update/pause/resume/delete intent | Нет |
| `schedule_state` | Получить capability и безопасное состояние расписания | Нет |

# Аннотации tools

Все tools объявляют `openWorldHint: false`. Остальные значения фиксированы:

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---:|---:|---:|
| `audit_start` | `false` | `false` | `true` |
| `audit_status` | `true` | `false` | `true` |
| `audit_cancel` | `false` | `false` | `true` |
| `audit_results` | `true` | `false` | `true` |
| `dashboard_open` | `true` | `false` | `true` |
| `finding_inspect` | `true` | `false` | `true` |
| `finding_reveal` | `false` | `false` | `true` |
| `schedule_intent_get` | `true` | `false` | `true` |
| `schedule_intent_complete` | `false` | `false` | `true` |
| `quarantine_prepare_move` | `false` | `false` | `true` |
| `quarantine_move` | `false` | `true` | `true` |
| `quarantine_list` | `true` | `false` | `true` |
| `quarantine_prepare_restore` | `false` | `false` | `true` |
| `quarantine_restore` | `false` | `false` | `true` |
| `quarantine_prepare_purge` | `false` | `false` | `true` |
| `quarantine_purge` | `false` | `true` | `true` |
| `exclusion_create` | `false` | `false` | `true` |
| `exclusion_list` | `true` | `false` | `true` |
| `exclusion_remove` | `false` | `false` | `true` |
| `exclusion_reset_prepare` | `false` | `false` | `true` |
| `exclusion_reset` | `false` | `false` | `true` |
| `schedule_request` | `false` | `false` | `true` |
| `schedule_state` | `true` | `false` | `true` |

`audit_start`, `audit_cancel` и `schedule_intent_complete` имеют `readOnlyHint: false`, потому что меняют локальный state, хотя не меняют сканируемые данные. Prepare-tools создают одноразовые tokens. `finding_reveal` меняет состояние Finder. Exclusion-tools меняют только plugin-owned local state. `schedule_request` создаёт intent, но не вызывает host-native automation. Все операции идемпотентны по `requestId`, `operationId` или точному входному snapshot.

# Правила входов

* Mutation-tools не принимают путь.
* Exclusion-tools принимают только `findingId`/revision либо server-generated `exclusionId`; path, owner, bundle ID и signing identity вычисляет сервер.
* `schedule_request` принимает закрытые day/time/action fields и не принимает raw RRULE, cron, LaunchAgent, shell command или arbitrary prompt.
* `schedule_intent_complete` может завершить только существующий pending intent и только записывает host outcome; само создание/изменение automation остаётся обязанностью Skill/host layer.
* `findingId`, `auditRevision`, `correlationRevisionId`, `operationId` и opaque action handle обязательны там, где применимы; preview token остаётся server-side.
* `audit_cancel` не принимает profile, path, revision или mutation-параметры.
* Preview token хранится server-side и привязан к действию, UI session, finding/quarantine entry, immutable audit/correlation revision, candidate/parent fingerprints, edge/coverage digests, policy/derivation versions, exclusion state и сроку пять минут.
* App получает только opaque action handle без identity или token material. Token одноразовый. Повтор с тем же `operationId` возвращает прежний результат.
* Любой неизвестный input field отклоняется schema validation.

# Правила выходов

* `structuredContent` содержит краткие model-visible данные и `stateVersion`.
* `content` содержит короткое русскоязычное объяснение без полного пути.
* `_meta` содержит widget-only `SafeCorrelationView`, presentation state и server-owned actions. Полные пути, raw/digested identity claims, inventory, correlation edges, coverage certificates и token material отсутствуют.
* `audit_results`, `dashboard_open` и `quarantine_list` возвращают серверную `StorageSummary`; UI не пересчитывает её.
* `audit_results`, `dashboard_open` и результаты quarantine actions возвращают `DiskObservation` рядом с `StorageSummary`; UI не вычисляет free-space delta.
* Каждая model-visible находка содержит `supportLevel`, безопасные metadata flags и blocking reason, но не raw config data.
* Widget-only finding содержит safe `FindingFacts`, `coverageSummary`, `staleDuringAudit` и `ReclaimEstimate`; model-visible форма получает более краткую безопасную сводку. Обе формы не содержат full path, app inventory, bundle/package/signing claims или correlation graph.
* Model-visible schedule output не содержит raw RRULE; automation ID считается opaque и возвращается только bridge flow, которому он нужен для update/pause/resume/delete.
* Model-visible audit summary показывает только `excludedCount`, а не identities исключённых объектов.
* `absent` показывается только как server-owned fact с полным same-snapshot coverage; причины `unknown` представлены безопасными gap codes.
* `unsupported_manual` не содержит mutation actions, готовую shell-команду или sudo-рекомендацию.
* Каждый tool с `structuredContent` объявляет точный `outputSchema`.
* Секреты, raw local identities и destructive token material отсутствуют во всех трёх каналах ответа.

# UI resource

Первый URI — `ui://codex-mac-cleaner/dashboard-v1.html`. Breaking change HTML, JS или CSS повышает версию URI.

CSP не содержит `connectDomains`, `resourceDomains` или `frameDomains`: bundle автономен и не загружает CDN.

# Host automation boundary

MCP App не объявляет host-native automation tool и не вызывает его через MCP. Widget создаёт `schedule_request`; Skill читает intent через `schedule_intent_get`, проверяет доступность Codex automation capability, получает отдельное подтверждение пользователя и вызывает host tool. Затем `schedule_intent_complete` сохраняет безопасный outcome. Если capability отсутствует, intent завершается `capability_unavailable`, а UI не создаёт замену через cron или LaunchAgent.

# Источники

1. [OpenAI Apps SDK: Define tools](https://developers.openai.com/apps-sdk/plan/tools/)
2. [OpenAI Apps SDK: Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
3. [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference/)

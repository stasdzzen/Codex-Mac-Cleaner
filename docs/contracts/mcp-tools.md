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
| `audit_results` | Получить страницу результатов | `auditId`, `revision`, `cursor`, filters | summary, finding IDs, next cursor |
| `dashboard_open` | Открыть Audit Dashboard | `auditId`, `revision` | widget snapshot |
| `finding_inspect` | Повторно проверить находку | `findingId`, `auditRevision` | evidence, policy, stale flag |
| `finding_reveal` | Показать объект в Finder | `findingId`, `auditRevision` | outcome |

# App-visible tools

Эти tools получают `_meta.ui.visibility: ["app"]` и недоступны модели.

| Tool | Назначение | Destructive |
|---|---|---|
| `quarantine_prepare_move` | Подготовить preview token для одной находки | Нет |
| `quarantine_move` | Переместить одну находку в карантин | Да, хотя действие обратимо |
| `quarantine_list` | Получить записи карантина | Нет |
| `quarantine_prepare_restore` | Подготовить восстановление одной записи | Нет |
| `quarantine_restore` | Вернуть payload без перезаписи | Нет |
| `quarantine_prepare_purge` | Подготовить необратимую очистку одной записи | Нет |
| `quarantine_purge` | Удалить один payload из карантина | Да |

# Аннотации tools

Все tools объявляют `openWorldHint: false`. Остальные значения фиксированы:

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|---|---:|---:|---:|
| `audit_start` | `false` | `false` | `true` |
| `audit_status` | `true` | `false` | `true` |
| `audit_results` | `true` | `false` | `true` |
| `dashboard_open` | `true` | `false` | `true` |
| `finding_inspect` | `true` | `false` | `true` |
| `finding_reveal` | `false` | `false` | `true` |
| `quarantine_prepare_move` | `false` | `false` | `true` |
| `quarantine_move` | `false` | `true` | `true` |
| `quarantine_list` | `true` | `false` | `true` |
| `quarantine_prepare_restore` | `false` | `false` | `true` |
| `quarantine_restore` | `false` | `false` | `true` |
| `quarantine_prepare_purge` | `false` | `false` | `true` |
| `quarantine_purge` | `false` | `true` | `true` |

`audit_start` имеет `readOnlyHint: false`, потому что создаёт локальный отчёт, хотя не меняет сканируемые данные. Prepare-tools создают одноразовые tokens. `finding_reveal` меняет состояние Finder. Все операции идемпотентны по `requestId`, `operationId` или точному входному snapshot.

# Правила входов

* Mutation-tools не принимают путь.
* `findingId`, `auditRevision`, `operationId` и preview token обязательны там, где применимы.
* Preview token привязан к действию, UI session, finding или quarantine entry, fingerprint и сроку пять минут.
* Token одноразовый. Повтор с тем же `operationId` возвращает прежний результат.
* Любой неизвестный input field отклоняется schema validation.

# Правила выходов

* `structuredContent` содержит краткие model-visible данные и `stateVersion`.
* `content` содержит короткое русскоязычное объяснение без полного пути.
* `_meta` содержит widget-only hydration: полный путь, подробные evidence maps и локальные действия.
* Каждый tool с `structuredContent` объявляет точный `outputSchema`.
* Секреты отсутствуют во всех трёх каналах ответа.

# UI resource

Первый URI — `ui://codex-mac-cleaner/dashboard-v1.html`. Breaking change HTML, JS или CSS повышает версию URI.

CSP не содержит `connectDomains`, `resourceDomains` или `frameDomains`: bundle автономен и не загружает CDN.

# Источники

1. [OpenAI Apps SDK: Define tools](https://developers.openai.com/apps-sdk/plan/tools/)
2. [OpenAI Apps SDK: Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
3. [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference/)

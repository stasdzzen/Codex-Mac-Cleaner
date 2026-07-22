---
type: MCP Contract
title: Контракт MCP-tools
description: Имена, видимость, влияние и данные tools Codex Mac Cleaner v0.1.
tags: [contracts, mcp, tools, ui]
status: approved
owner: Architect
date: 2026-07-21
---

# Архитектурный тип

Приложение использует interactive-decoupled pattern. Data tools не подключают UI-шаблон. `dashboard_open` подключает версионированный ресурс, а App вызывает app-visible actions через MCP Apps `tools/call`.

# Model-visible tools

| Tool | Назначение | Главный вход | Главный выход |
|---|---|---|---|
| `audit_start` | Начать read-only аудит | `requestId`, `profile=application_remnants` | `auditId`, `state`, `stateVersion` |
| `audit_status` | Получить прогресс | `auditId` | state, phase, шаги, candidate counts, coverage warnings |
| `audit_cancel` | Отменить read-only аудит | `auditId`, `requestId` | state, stateVersion, cancelRequestedAt |
| `audit_results` | Получить страницу результатов | `auditId`, `revision`, `cursor`, filters | summary, finding IDs, next cursor |
| `dashboard_open` | Открыть Audit Dashboard | `auditId`, `revision=null \| integer` | live или immutable widget snapshot |
| `finding_inspect` | Повторно проверить находку | `findingId`, `auditRevision` | evidence, policy, stale flag |
| `finding_reveal` | Показать объект в Finder | `findingId`, `auditRevision` | outcome |
| `schedule_intent_get` | Зарезервированный post-v0.1 host-intent skeleton | `intentId` | в v0.1 только безопасный unavailable outcome |
| `schedule_intent_complete` | Зарезервированное завершение post-v0.1 host intent | `intentId`, `requestId`, outcome, opaque automation ID | в v0.1 lifecycle не активен |

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
| `schedule_request` | Зарезервировать enable/update/pause/resume/delete intent для будущей совместимости; v0.1 fail closed | Нет |
| `schedule_state` | Получить честное disabled/manual-run состояние v0.1 | Нет |

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

`audit_start`, `audit_cancel` и `schedule_intent_complete` имеют `readOnlyHint: false`, потому что меняют локальный state, хотя не меняют сканируемые данные. Prepare-tools создают одноразовые tokens. `finding_reveal` меняет состояние Finder. Exclusion-tools меняют только plugin-owned local state. Schedule tools сохраняют строгий compatibility skeleton, но в v0.1 не создают host-native automation и не являются release claim lifecycle. Все операции идемпотентны по `requestId`, `operationId` или точному входному snapshot.

# Правила входов

* Mutation-tools не принимают путь.
* Клиент не передаёт owner identity, correlation source, requirement profile или applicability. Эти значения разрешает и выбирает только сервер.
* Exclusion-tools принимают только `findingId`/revision либо server-generated `exclusionId`; path, owner, bundle ID и signing identity вычисляет сервер.
* `schedule_request` принимает закрытые day/time/action fields и не принимает raw RRULE, cron, LaunchAgent, shell command или arbitrary prompt.
* В v0.1 `schedule_request` не активирует lifecycle, а `schedule_intent_complete` не может записать успешный host outcome; state остаётся disabled. Полный bridge включается только в post-v0.1 CMC-13 после owner decision.
* `findingId`, `auditRevision`, `correlationRevisionId`, `operationId` и opaque action handle обязательны там, где применимы; preview token остаётся server-side.
* `audit_cancel` не принимает profile, path, revision или mutation-параметры.
* `dashboard_open.revision=null` запрашивает текущий live snapshot. Integer revision допустима только для завершённой immutable revision.
* Preview token хранится server-side и привязан к действию, UI session, finding/quarantine entry, immutable audit/correlation revision, candidate/parent fingerprints, edge/coverage digests, policy/derivation versions, exclusion state и сроку пять минут.
* App получает только opaque action handle без identity или token material. Token одноразовый. Повтор с тем же `operationId` возвращает прежний результат.
* Любой неизвестный input field отклоняется schema validation.

# Правила выходов

* `structuredContent` содержит краткие model-visible данные и `stateVersion`.
* Live `dashboard_open` возвращает `revision=null`, пустые findings/actions и server-owned progress; он не создаёт action authority.
* `content` содержит короткое русскоязычное объяснение без полного пути.
* `_meta` содержит widget-only `SafeCorrelationView`, presentation state и server-owned actions. Полные пути, raw/digested identity claims, inventory, correlation edges, coverage certificates и token material отсутствуют.
* `audit_results`, `dashboard_open` и `quarantine_list` возвращают серверную `StorageSummary`; UI не пересчитывает её.
* `audit_results`, `dashboard_open` и результаты quarantine actions возвращают `DiskObservation` рядом с `StorageSummary`; UI не вычисляет free-space delta.
* Каждая model-visible находка содержит `supportLevel`, безопасные metadata flags и blocking reason, но не raw config data.
* Widget-only finding содержит safe `FindingFacts`, очищенное имя одного верхнеуровневого компонента без directory chain, агрегированный `ownerBindingState`, server-owned `requirementProfileId`, `coverageSummary`, `staleDuringAudit` и `ReclaimEstimate`; model-visible форма получает generic label и более краткую безопасную сводку. Обе формы не содержат full path, app inventory, bundle/package/signing claims, historical bindings или correlation graph.
* User missing-target LaunchAgent возвращается только как `analysis_only`, системный missing-target LaunchAgent/LaunchDaemon — как `unsupported_manual`; допустимо только `inspect`, а model-visible имя остаётся generic.
* Активный process с доказанно отсутствующим абсолютным executable может быть только read-only diagnostic: model-visible имя generic, PID/путь server-only, terminate и cleanup actions отсутствуют.
* `artifactExistenceState` относится к cleanup-target, а `ownerApplicationState`/`ownerExecutableState` — к отдельно разрешённому owner. Legacy `targetExecutableState` не используется для выдачи mutation action.
* `requirementApplicability=not_applicable` отображается как «не относится к этому профилю», а не как «не найдено». Positive evidence всегда остаётся blocking независимо от applicability других requirements.
* Model-visible schedule output не содержит raw RRULE. В v0.1 automation ID отсутствует, а output сообщает disabled/manual-run fallback; opaque ID и lifecycle становятся допустимы только после CMC-13.
* Model-visible audit summary показывает только `excludedCount`, а не identities исключённых объектов.
* `absent` показывается только как server-owned fact с полным same-snapshot coverage; причины `unknown` представлены безопасными gap codes.
* `unsupported_manual` не содержит mutation actions, готовую shell-команду или sudo-рекомендацию.
* Каждый tool с `structuredContent` объявляет точный `outputSchema`.
* Секреты, raw local identities и destructive token material отсутствуют во всех трёх каналах ответа.

# UI resource

Текущий URI — `ui://codex-mac-cleaner/dashboard-v2.html`. Он вводит live progress и nullable pre-result revision. Breaking change HTML, JS или CSS снова повышает версию URI; v1 не переопределяется.

CSP не содержит `connectDomains`, `resourceDomains` или `frameDomains`: bundle автономен и не загружает CDN. `redirectDomains` содержит только `https://github.com` и `https://dzzen.com` для явных footer-переходов через host `openExternal`. Footer не вызывает MCP tool и не передаёт audit payload во внешние URL.

# Host automation boundary

В v0.1 host automation boundary не активен. MCP App не объявляет и не вызывает host-native automation tool; вкладка «Расписание» показывает disabled/manual-run fallback и использует обычный `audit_start`. Schedule-intent endpoints остаются инертной compatibility groundwork и не могут завершиться успешным lifecycle outcome. Создание/update/pause/resume/delete и scheduled prompt переходят в post-v0.1 CMC-13. Ни сейчас, ни после её запуска нельзя создавать замену через cron, LaunchAgent или скрытый scheduler.

# Источники

1. [OpenAI Apps SDK: Define tools](https://developers.openai.com/apps-sdk/plan/tools/)
2. [OpenAI Apps SDK: Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
3. [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference/)
4. [ADR-0013: actionable Library remnants](../decisions/ADR-0013-actionable-library-remnant-correlation.md)

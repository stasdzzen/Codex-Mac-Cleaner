---
type: ADR
title: "ADR-0015: живой Dashboard и shared inventories аудита"
description: Раннее открытие безопасного Dashboard v2, честный пофазный прогресс и однократный сбор глобальных macOS inventories на фазу.
tags: [adr, audit, dashboard, progress, performance, mcp]
status: approved
owner: Architect
date: 2026-07-21
---

# Контекст

Real-Mac smoke версии `v0.1.0-beta.2` выявил два связанных дефекта. После `audit_start` пользователь не видел Dashboard, потому что `dashboard_open` принимал только завершённую revision `>= 1`. Одновременно `audit_status` показывал фиктивные `0/1` на всём протяжении проверки.

Runtime дополнительно создавал production correlation adapter для набора кандидатов, но внутри каждого кандидата заново выполнял Snapshot A и Snapshot B глобальных источников: полный inventory приложений и package-registered bundles, процессы, открытые файлы и startup targets. Стоимость росла пропорционально числу кандидатов. Поиск вложенного `.git` также делал отдельный `lstat` для каждого обычного файла. На реальном Mac аудит оставался `running 0/1` около шестнадцати минут и был отменён владельцем; terminal failure не фиксировался.

# Решение

## 1. Dashboard открывается при старте

После успешного `audit_start` Skill сразу вызывает `dashboard_open` с `revision: null`. `null` означает live snapshot текущего audit run, а не actionable revision.

Live snapshot допустим для `queued`, `running`, `cancelling`, `cancelled`, `failed` и для уже завершившегося run. До появления immutable revision он содержит пустой список findings, пустые mutation actions, безопасные агрегаты, coverage и progress. Integer revision по-прежнему разрешается только для `completed | completed_with_warnings` и обязана точно совпасть с сохранённой revision.

Breaking UI-контракт получает новый URI `ui://codex-mac-cleaner/dashboard-v2.html`. Dashboard v1 не переопределяется.

## 2. Прогресс принадлежит серверу

`audit_status` и widget snapshot используют одинаковый server-owned progress:

* `phase`: `queued`, `discovering_candidates`, `collecting_global_evidence`, `correlating_candidates`, `finalizing`, `completed`, `cancelled` или `failed`;
* `completedSteps` и `totalSteps`;
* `processedCandidates` и `totalCandidates`.

После discovery сервер знает число кандидатов и меняет total детерминированно. `stateVersion` увеличивается при каждом наблюдаемом переходе. Widget опрашивает `audit_status` раз в секунду только в активных состояниях, принимает лишь совпадающий `auditId` и не откатывает более новый `stateVersion`. Ошибка polling сохраняет последний валидный snapshot и не создаёт локальных предположений.

## 3. Глобальные inventories снимаются один раз на фазу

Внутри одного Audit Runtime production adapter создаёт не более одного shared global capture для Snapshot A и одного для Snapshot B. В capture входят installed applications, processes, open files и startup targets. Candidate-specific filesystem identity, receipt lookup, container binding, policy и Snapshot A/B validation выполняются отдельно для каждого кандидата.

Package queries и разбор приложений используют ограниченную параллельность. Низкоуровневый command timeout, record limits и coverage states сохраняются. `truncated`, timeout, permission denial, parse loss и cancellation не преобразуются в `complete` или `absent`.

Весь audit run имеет server-owned deadline пять минут. Превышение переводит run в `failed`, phase `failed` и safe code `AUDIT_TIMEOUT`; это не считается пользовательской отменой и не создаёт partial actionable revision. Таймер отменяет текущие read-only boundaries кооперативно и не запускает mutation.

Recursive Git guard продолжает искать `.git` и fail closed блокировать неполный обход, symlink, mount/device mismatch и неизвестный entry type. Обычные файлы без имени `.git` не требуют отдельного `lstat`; каталоги и `.git` перепроверяются.

## 4. Завершённая revision остаётся отдельной

После terminal `completed | completed_with_warnings` Skill получает `audit_results` и повторно вызывает `dashboard_open` с integer revision. Только этот snapshot может содержать findings и server-owned actions. Live polling не выдаёт mutation authority и не подменяет immutable results.

# Safety-инварианты

Решение не меняет protected scopes, authoritative owner binding, completeness certificates, server-only policy, one-object confirmation, quarantine или privacy boundary. Raw paths, app inventory, package/bundle/signing identity, command output, correlation graph и token material не попадают в model-visible или widget-visible output.

# Последствия

* Пользователь видит начало и ход проверки без терминала и без повторных сообщений «готово».
* Стоимость глобального evidence не умножается на число Library candidates.
* First-run остаётся потенциально дорогим, но его фаза и прогресс наблюдаемы, системные вызовы ограничены timeouts и bounded concurrency, а весь run — пятиминутным deadline.
* URI Dashboard v2 и nullable live revision требуют синхронного обновления contracts, Skill, runtime, widget, package allowlist и clean-room tests.

# Связанные концепты

* [Runtime flows](../architecture/runtime-flows.md)
* [MCP tools](../contracts/mcp-tools.md)
* [ADR-0012](ADR-0012-server-owned-correlation-identity.md)
* [ADR-0013](ADR-0013-actionable-library-remnant-correlation.md)

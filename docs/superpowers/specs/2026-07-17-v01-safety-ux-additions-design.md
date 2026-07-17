---
type: Architecture
title: Safety/UX-дополнения Codex Mac Cleaner v0.1
description: Дизайн Quarantine Center, честных метрик размера и безопасной отмены read-only аудита.
tags: [architecture, product, quarantine, audit, ui, safety]
status: approved
owner: Architect
date: 2026-07-17
---

# Цель

Закрыть три пробела первого релиза, не расширяя категории очистки:

1. дать пользователю полный поэлементный контроль карантина внутри Codex;
2. разделить потенциальный объём, занятое карантином место и размер необратимо удалённых payload;
3. дать безопасный способ остановить долгий read-only аудит.

Продукт остаётся локальным плагином Codex: Skill управляет диалогом, MCP App показывает интерфейс, локальный MCP-сервер проверяет policy и меняет файловую систему. Отдельного macOS-приложения и Swift-компонента нет.

# Границы

В v0.1 добавляются:

* Quarantine Center со списком, сводкой, восстановлением и окончательной очисткой;
* три независимые метрики размера;
* `audit_cancel` и состояния `cancelling`, `cancelled`;
* UI, error handling и tests для этих потоков.

В v0.1 по-прежнему нет массового выбора, кнопки «Очистить всё», автоматического purge, экспорта, истории как отдельного продуктового экрана и новых профилей очистки.

# Quarantine Center

Dashboard получает вкладку «Карантин». `quarantine_list` возвращает страницу записей и сводку. Запись содержит:

* `operationId` и текущее состояние;
* безопасное отображаемое имя и приложение-владельца;
* категорию и physical size;
* время перемещения;
* доступность восстановления или очистки с текстовой причиной блокировки.

Кнопка «Восстановить» запускает существующий preview/confirm поток. Кнопка «Удалить навсегда» открывает danger `AlertDialog` с именем объекта, размером и текстом «Отменить это действие нельзя». Каждый confirm относится ровно к одному payload.

Пустое состояние говорит: «В карантине нет объектов. Здесь появятся находки, которые вы переместите из результатов аудита».

# Метрики размера

Dashboard показывает три `Card`:

| Подпись | Значение | Ограничение |
|---|---|---|
| «Найдено кандидатов» | Сумма physical size находок текущей ревизии | Не равна объёму, который можно безопасно очистить |
| «В карантине» | Сумма physical size активных payload | Место по-прежнему занято |
| «Удалено навсегда» | Сумма physical size payload, перешедших в `purged` за всё время текущей установки | Не обещает точный прирост свободного места APFS |

Сервер считает значения из immutable audit revision и валидных quarantine manifests. UI не суммирует объекты самостоятельно. После restore или purge сервер возвращает новый `stateVersion` и сводку.

# Отмена аудита

## MCP-контракт

`audit_cancel` видим модели, чтобы Codex мог выполнить прямую просьбу пользователя «Отмени аудит». Tool принимает `auditId` и `requestId`, не принимает пути и возвращает `state`, `stateVersion`, `cancelRequestedAt`.

Аннотации:

* `readOnlyHint: false`, потому что tool меняет локальный отчёт;
* `destructiveHint: false`, потому что сканируемые данные не меняются;
* `idempotentHint: true`.

## Автомат состояний

`queued | running → cancelling → cancelled`.

`completed`, `completed_with_warnings`, `failed` и `cancelled` — терминальные состояния. Если завершение зафиксировано раньше запроса отмены, сервер возвращает уже записанное terminal state. Повторный вызов возвращает текущий результат без нового действия.

Coordinator кооперативно останавливает adapters, закрывает потоки записи и фиксирует отчёт как `cancelled`. Частичные observations можно показать, но они не образуют actionable revision: каждая находка получает пустой `allowedActions`. Для карантина нужен новый завершённый аудит.

# UI и тексты

Dashboard сохраняет тёмную тему, semantic tokens и автономный bundle. К компонентам из ADR-0006 добавляются `Tabs`, `Button` и `Tooltip`.

Вкладки:

1. «Обзор» — прогресс и сводка;
2. «Находки» — таблица, фильтры и evidence `Sheet`;
3. «Карантин» — список payload и поэлементные действия.

Находка показывает «Почему найдено», «Что говорит против перемещения», риск и причину доступности или блокировки действия. Codex может пересказать эти данные, но не создаёт policy decision.

Канонические кнопки:

* «Начать аудит»;
* «Отменить аудит»;
* «Показать в Finder»;
* «Переместить в карантин»;
* «Восстановить»;
* «Удалить навсегда»;
* «Отмена».

После `cancelled` Dashboard показывает `Alert`: «Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно. Начните новый аудит».

# Ошибки и восстановление

* Expired preview token закрывает диалог и предлагает повторно открыть preview. Mutation не повторяется автоматически.
* Ошибка restore оставляет payload в карантине и показывает причину со следующим действием.
* Ошибка purge не скрывает запись и не меняет метрику «Удалено навсегда».
* Повреждённый manifest, неизвестная breaking-схема или несогласованное состояние блокируют destructive-tools.
* UI показывает `correlationId` только в деталях ошибки. Обычный текст отвечает на три вопроса: что произошло, почему и что делать.

# Проверки

Дополнения блокируют release, пока не пройдут:

1. contract tests для `audit_cancel`, tool annotations, новых states и summary schemas;
2. state-machine и race tests отмены, завершения и повторного вызова;
3. проверка пустого `allowedActions` в отменённом отчёте;
4. проверки сводки после move, restore, purge и failed purge;
5. UI tests вкладок, пустых состояний, текстовых причин блокировки, focus return и keyboard navigation;
6. негативный test на отсутствие bulk и автоматического purge;
7. E2E-потоки `audit → cancel`, `quarantine → restore` и `quarantine → purge` на синтетических данных;
8. real-Mac smoke на macOS 26 Apple Silicon без утверждения о точном приросте свободного места APFS.

# Распределение по Issues

Новая Issue не нужна: ни одна зависимая реализация ещё не начата. После письменного review этой спецификации scope распределяется так:

| Issue | Дополнение |
|---|---|
| `CMC-03` / `#3` | Schemas, states, `audit_cancel`, summary contracts |
| `CMC-04` / `#4` | Cooperative cancellation адаптеров и coordinator |
| `CMC-07` / `#7` | Quarantine summary и метрики restore/purge |
| `CMC-08` / `#8` | Три вкладки, Quarantine Center, новые shadcn components и UI tests |
| `CMC-09` / `#9` | Tool registration, visibility, Skill и integrated flows |
| `CMC-10` / `#10` | Race, E2E, privacy и real-Mac release evidence |

После review Архитект создаёт ADR-0009, обновляет контракты, PRD, traceability, acceptance gates и release checklist. Затем обновляются существующие план, Worker-промпты, локальные Issue-спеки и тела GitHub Issues. До этого Controller не запускается.

# Связанные концепты

* [Компоненты](../../architecture/components.md)
* [MCP-контракт](../../contracts/mcp-tools.md)
* [Runtime-потоки](../../architecture/runtime-flows.md)
* [Модель безопасности](../../safety/safety-model.md)
* [Критерии приёмки](../../quality/acceptance-gates.md)
* [PRD](../../product/PRD-codex-mac-cleaner.md)

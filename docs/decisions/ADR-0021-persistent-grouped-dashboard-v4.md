---
type: ADR
title: "ADR-0021: сохраняемый сгруппированный Dashboard v4"
description: Последняя завершённая ревизия переживает restart, а Dashboard объединяет находки без ослабления пообъектной policy authorization.
tags: [adr, dashboard, persistence, quarantine, exclusions, cache]
status: approved
owner: Architect
date: 2026-07-23
---

# Контекст

Dashboard v3 был безопасно ограничен страницами, но завершённый аудит существовал
только в памяти MCP-процесса. Новая задача Codex теряла результаты и вынуждала
повторять дорогую диагностику. Отдельная вкладка «Находки» показывала тысячи
низкоуровневых строк, а отдельная карточка диска занимала место во время
проверки. Production runtime также продолжал использовать legacy exclusion
store, хотя keyed/HMAC-контракт уже был реализован.

Пользователю нужен простой реестр мусора, возможность вернуться к незавершённым
решениям и понятная очистка карантина. Это не даёт UI права создавать bulk
mutation или переиспользовать старый destructive token.

# Решение

1. Сервер атомарно сохраняет только последнюю immutable ревизию со статусом
   `completed | completed_with_warnings` в `audits/latest.json`.
2. Файл имеет versioned envelope, installation-local HMAC, права `0600` и
   каталоги `0700`. Запись выполняет `JsonStore` через temporary file, `fsync`
   и rename.
3. Persisted payload содержит server-only данные, необходимые для показа и
   повторной revalidation, но не содержит preview tokens, action handles,
   UI-session state или cursors. Повреждение, неизвестная версия либо другой
   key namespace дают безопасное отсутствие последнего аудита.
4. `dashboard_open` с `{auditId:null, revision:null}` открывает последнюю
   сохранённую ревизию и возвращает её точные `auditId` и `revision`. Вызов не
   запускает новый аудит. Явный `auditId` с `revision:null` сохраняет прежнюю
   семантику live snapshot.
5. Mutation после restart всегда создаёт новый preview и повторяет path,
   fingerprint, correlation, protected-scope и exclusion checks. Persisted
   `allowedActions` — представление прошлой ревизии, а не новая authority.
6. Runtime использует `KeyedExclusionStateStore` и keyed matcher. Повреждённый
   exclusion state не скрывает findings, но блокирует destructive token.
7. Dashboard v4 имеет четыре вкладки: «Обзор», «Карантин», «Оставленные» и
   «Автопроверка». Компактная ограниченная по высоте таблица находится на
   «Обзоре». Cache findings объединяются в одну группу, а остатки удалённых
   приложений — по приложению; действие всё равно относится к одному раскрытому
   finding.
8. Свободное место показывается компактно в шапке. Отдельный блок размеров
   скрыт во время активной диагностики.
9. Кнопка display mode отражает наблюдаемый host mode:
   «Развернуть» для `inline`, «Свернуть» для `fullscreen`. Завершение аудита не
   меняет display mode.
10. «Очистить карантин» — последовательный интерфейс над существующими
    `prepare_purge`/`purge` одного entry. Каждый payload требует отдельного
    подтверждения; ошибка останавливает последовательность и оставляет остаток
    видимым.
11. Непустой private cache отсутствующего owner может получить
    `private_regenerable_remnant_v1`, только если bounded server-owned обход
    подтвердил обычные файлы/каталоги одного владельца и устройства, отсутствие
    symlink, hardlink, Git и чувствительных имён. Непустые logs и любой
    неполный обход остаются inspect-only.
12. Breaking resource получает URI
    `ui://codex-mac-cleaner/dashboard-v4.html`. Опубликованные v1–v3 не
    переопределяются; их исходные собранные копии не входят в новый пакет.

# Safety-инварианты

* Persisted audit никогда не содержит reusable mutation capability.
* Любой move, restore и purge остаётся отдельной server-authorized операцией над
  одним объектом.
* Группа и кнопка «Очистить карантин» не образуют bulk token и не обходят
  подтверждение каждого entry.
* `analysis_only` и `unsupported_manual` не получают `prepare_move`.
* Cache proof не расширяет allowlisted roots и не разрешает Application
  Support, Containers, Preferences, database, sync, VPN, personal или system
  scopes.
* Raw paths и identities остаются только в локальном server-owned state и не
  попадают в model/widget output.

# Последствия

* Пользователь может закрыть задачу Codex и позже открыть последний Dashboard
  без повторного аудита.
* Persisted snapshot ограничен одной последней завершённой ревизией; это не
  история аудитов и не облачная синхронизация.
* In-memory cursors после restart не восстанавливаются. При открытии сервер
  создаёт новую первую bounded страницу и новые cursors.
* Старый либо перемещённый объект может оставаться в immutable отчёте, но новая
  revalidation безопасно блокирует повторное перемещение.

# Связанные концепты

* [ADR-0013](ADR-0013-actionable-library-remnant-correlation.md)
* [ADR-0015](ADR-0015-live-audit-dashboard-and-shared-inventories.md)
* [ADR-0020](ADR-0020-bounded-dashboard-pagination.md)
* [MCP contract](../contracts/mcp-tools.md)
* [Runtime flows](../architecture/runtime-flows.md)
* [Safety model](../safety/safety-model.md)

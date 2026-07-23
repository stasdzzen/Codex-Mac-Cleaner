---
type: ADR
title: "ADR-0020: ограниченная пагинация результатов и Dashboard v3"
description: Server-owned страницы результатов вместо многомегабайтного MCP-ответа со всеми находками.
tags: [adr, mcp, dashboard, pagination, privacy, performance]
status: approved
owner: Architect
date: 2026-07-23
---

# Контекст

Полный аудит beta.10 обработал 2 767 кандидатов, но `audit_results` и
`dashboard_open` попытались вернуть все findings одним ответом. Model-visible
payload достиг примерно 1,48 млн токенов, а host отбросил около 4,9 МБ данных.
Формальные поля `cursor` и `nextCursor` уже существовали, но runtime не применял
их и всегда возвращал `nextCursor=null`.

Полноту аудита нельзя заменять обрезанием кандидатов. Одновременно MCP App не
может надёжно передавать тысячи model-safe и более подробных widget-safe записей
одним сообщением.

# Решение

1. Immutable audit revision по-прежнему содержит полный детерминированный список
   findings в памяти серверного процесса.
2. `audit_results` возвращает не более 100 model-safe findings и не более
   512 КиБ сериализованного массива за вызов.
3. `dashboard_open` возвращает server-owned `findingSummary`, bounded первую
   model-safe страницу в `structuredContent` и независимую bounded первую
   widget-safe страницу в `_meta`.
4. Следующие widget-safe страницы получает только App через read-only
   `dashboard_page`. Tool имеет `ui.visibility=["app"]` и не виден модели.
5. Страница загружается только после явного действия пользователя «Показать ещё».
   Автоматическая выгрузка всех страниц при открытии запрещена.
6. Cursor — непрозрачный server-owned идентификатор из in-memory registry. Он
   связан с точными `auditId`, immutable revision, каналом
   `model | dashboard`, нормализованными filters и offset.
7. Неизвестный cursor, подмена audit/revision/filters, использование cursor в
   другом канале или потеря процесса дают типизированный `AUDIT_STALE`. Сервер
   не угадывает offset и не запускает новый аудит.
8. Для семантически одинаковых filters порядок и повторы значений
   нормализуются. Порядок findings остаётся discovery order.
9. Breaking UI/resource contract получает новый URI
   `ui://codex-mac-cleaner/dashboard-v3.html`. Опубликованный v2 не
   переопределяется.

# Safety-инварианты

* Cursor не содержит path, identity, filters в открытом виде, token material или
  mutation authority.
* Model-visible и widget-safe страницы используют разные cursor bindings.
* Каждый массив findings ограничен максимум сотней записей и 512 КиБ и
  проверяется regression-тестом. Одиночная запись больше лимита блокируется.
* Полный audit result не обрезается: `findingSummary.totalCount` относится ко
  всей immutable revision, а UI отдельно показывает число загруженных записей.
* Pagination не создаёт bulk selection, bulk mutation или auto-clean.
* Любое изменение файлов остаётся отдельным подтверждённым действием над одним
  finding.

# Последствия

* Для просмотра более 100 находок пользователь нажимает «Показать ещё».
* Несколько bounded tool calls предпочтительнее одного payload, который host не
  может принять. Это осознанное исключение из общего правила «return data
  upfront» для MCP views, вызванное измеренным лимитом host payload.
* Cursor живёт столько же, сколько in-memory audit process. После перезапуска
  нужен новый аудит только по явному запросу пользователя.
* StorageSummary, DiskObservation и support-level counts вычисляет сервер; UI их
  не пересчитывает из загруженной страницы.

# Связанные концепты

* [ADR-0015](ADR-0015-live-audit-dashboard-and-shared-inventories.md)
* [ADR-0019](ADR-0019-complete-audit-without-overall-deadline.md)
* [MCP contract](../contracts/mcp-tools.md)
* [Runtime flows](../architecture/runtime-flows.md)
* [Threat model](../safety/threat-model.md)

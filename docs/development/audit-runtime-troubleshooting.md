---
type: Execution Contract
title: Диагностика запуска аудита и Dashboard
description: Fail-closed реакция на отсутствие инструментов, потерю процесса, состояние ревизии и большой результат.
tags: [development, operations, audit, mcp, dashboard, troubleshooting]
status: approved
owner: Architect
date: 2026-07-23
---

# Назначение

Этот runbook описывает безопасную реакцию плагина и сопровождающего агента на
сбои запуска read-only аудита. Он не является инструкцией по ручному запуску
серверного процесса и не разрешает обходить Codex через Terminal, прямой stdio,
локальный HTML или отдельный HTTP-сервер.

Полные пути, inventory, bundle/package/signing identities, значения
конфигураций, токены и содержимое пользовательских файлов не входят в
диагностические сообщения, логи и PR evidence.

# Карта симптомов

| Симптом | Значение | Допустимая реакция | Запрещённая реакция |
|---|---|---|---|
| `audit_start`, `audit_status`, `audit_results` или `dashboard_open` не видны в задаче | Task-scoped registry Codex ещё не предоставил обязательную поверхность | Один штатный host discovery по точным именам; если инструменты не появились — остановиться и честно сообщить, что аудит не начат | Запуск runtime через Terminal/direct stdio, локальный HTML, утверждение об открытом Dashboard |
| `state=queued|running|cancelling`, `revision=null` | Успешной immutable revision ещё нет | Сохранять Dashboard live, показывать server-owned phase/counts и продолжать штатный `audit_status` | Угадывать revision `1`, вызывать `audit_results` или объявлять проверку завершённой |
| `state=completed|completed_with_warnings`, `revision=<integer>` | Полный проход опубликовал точную immutable revision | Передать именно этот номер в `audit_results` и финальный `dashboard_open` | Подставлять локальный счётчик или revision предыдущего запуска |
| `AUDIT_STALE` после перезапуска или потери MCP-процесса | In-memory run больше недоступен либо cursor относится к другому процессу/каналу/revision | Объяснить, что прошлый запуск нельзя безопасно продолжить; новый аудит возможен только после отдельного явного запроса пользователя | Автоматически повторять аудит, восстанавливать raw identities с диска или использовать старый cursor |
| Находок больше одной страницы | Полная revision сохранена на сервере, а ответ ограничен безопасным размером | Показывать server-owned total и загружать следующую widget-страницу только по кнопке «Показать ещё» | Возвращать весь список одним ответом, менять итог по числу загруженных строк или передавать model cursor в Widget |
| Tool вернул Dashboard resource, но host его не отобразил | Host не смонтировал публичный MCP App resource | Сообщить об отсутствии отображения, сохранить audit state и разрешить повторное штатное открытие той же revision | Запускать сайт, создавать file URL, обещать правую панель или начинать новый аудит |
| Read-only source завершился timeout/permission gap | Один источник не дал полного evidence | Записать typed coverage warning, оставить зависимые факты `unknown`, продолжить остальные кандидаты | Отменять весь audit run, рекомендовать `sudo` или обход TCC |

# Нормальная цепочка одного запуска

1. Skill проверяет наличие обязательных native tools и при необходимости один
   раз выполняет штатный host discovery.
2. `audit_start` создаёт ровно один audit run.
3. `dashboard_open(revision=null)` открывает live Dashboard без findings и
   mutation actions.
4. `audit_status` возвращает server-owned состояние. До успешного terminal
   state `revision` остаётся `null`.
5. Только `completed` или `completed_with_warnings` возвращает точную integer
   revision.
6. `audit_results` и финальный `dashboard_open` используют эту же revision.
7. Следующие страницы Dashboard получает app-only `dashboard_page` после
   нажатия пользователя; новый audit run не создаётся.

`failed`, `cancelled` и `AUDIT_STALE` не создают actionable revision. Отмена
выполняется только по явному запросу пользователя.

# Разрешённые диагностические данные

Можно фиксировать:

* публичную версию плагина;
* наличие и количество model/app tools;
* URI и MIME Dashboard resource;
* `auditId` как непрозрачный идентификатор текущего тестового запуска;
* state, phase, safe counts, nullable/exact revision и typed error code;
* exit code теста и commit SHA.

Нельзя фиксировать:

* полный или сокращённый домашний путь;
* имена найденных пользовательских объектов, если они получены с реального Mac;
* raw inventory, process arguments и открытые файлы;
* значения JSON/YAML/plist;
* credentials, subscription URL, токены и другие secret-like values.

# Проверка сопровождающим

Команда `pnpm probe:plugin-surface` — release/development gate, а не обход
пользовательского сценария. Она запускает опубликованный stdio entrypoint на
временном синтетическом `HOME`, читает только список tools и Dashboard resource
и не вызывает `audit_start`.

Probe обязан подтвердить:

* точные 9 model-visible и 15 app-only tools;
* app-only видимость mutation и pagination tools;
* `ui://codex-mac-cleaner/dashboard-v3.html`;
* MIME `text/html;profile=mcp-app`;
* закрытый CSP без connect/resource/frame domains;
* plugin-relative Node stdio launch без HTTP/terminal fallback;
* typed fail-closed stderr без абсолютного plugin root, синтетического `HOME`
  или другого локального пути.

Если probe зелёный, а инструменты отсутствуют только в конкретной задаче Codex,
это граница host registry, а не разрешение на обход. Плагин остаётся fail closed.

# Источники

1. [MCP-tools](../contracts/mcp-tools.md)
2. [Runtime-потоки](../architecture/runtime-flows.md)
3. [ADR-0019](../decisions/ADR-0019-complete-audit-without-overall-deadline.md)
4. [ADR-0020](../decisions/ADR-0020-bounded-dashboard-pagination.md)
5. [CMC-46](../../.github/issue-specs/CMC-46.md)

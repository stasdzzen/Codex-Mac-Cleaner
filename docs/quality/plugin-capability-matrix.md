---
type: Test Strategy
title: Проверяемая поверхность плагина
description: Соответствие Skill, MCP tools, MCP App resource и release probe.
tags: [quality, plugin, mcp, capability, verification]
status: approved
owner: Architect
date: 2026-07-23
---

# Инвариант поверхности

Устанавливаемый плагин считается доступным не по одному manifest, а только когда
packaged stdio handshake возвращает точный набор tools и versioned Dashboard
resource. Пользовательский сценарий не использует Terminal, прямой stdio,
локальный сайт или автоматический повтор аудита.

Skill видит только model-поверхность. Действия, изменяющие quarantine/exclusion
state, и постраничная загрузка Dashboard остаются app-only. Отсутствующая,
переименованная или ошибочно видимая capability блокирует Gate H.

# Model-visible tools

| Tool | Видимость | Назначение |
|---|---|---|
| `audit_start` | `model` | Создать один read-only audit run профиля `application_remnants` |
| `audit_status` | `model` | Получить server-owned progress и nullable/exact revision |
| `audit_cancel` | `model` | Запросить кооперативную отмену только по явному запросу |
| `audit_results` | `model` | Получить bounded model-safe страницу точной revision |
| `dashboard_open` | `model` | Открыть live или immutable Dashboard v3 |
| `finding_inspect` | `model` | Получить безопасное объяснение одной находки |
| `finding_reveal` | `model` | Запросить host-mediated reveal без раскрытия пути модели |
| `schedule_intent_get` | `model` | Прочитать инертный schedule intent v0.1 |
| `schedule_intent_complete` | `model` | Завершить совместимый intent без host automation |

# App-only tools

| Tool | Видимость | Назначение |
|---|---|---|
| `dashboard_page` | `app` | Загрузить следующую widget-safe страницу по кнопке |
| `quarantine_prepare_move` | `app` | Подготовить preview перемещения одного объекта |
| `quarantine_move` | `app` | Подтверждённо переместить один объект в карантин |
| `quarantine_list` | `app` | Показать безопасный список карантина |
| `quarantine_prepare_restore` | `app` | Подготовить preview восстановления одной записи |
| `quarantine_restore` | `app` | Подтверждённо восстановить одну запись |
| `quarantine_prepare_purge` | `app` | Подготовить preview окончательной очистки одной записи |
| `quarantine_purge` | `app` | Подтверждённо очистить одну запись карантина |
| `exclusion_create` | `app` | Создать server-derived exclusion по finding ID/revision |
| `exclusion_list` | `app` | Показать безопасные persistent exclusions |
| `exclusion_remove` | `app` | Удалить одно exclusion |
| `exclusion_reset_prepare` | `app` | Подготовить подтверждение сброса exclusions |
| `exclusion_reset` | `app` | Подтверждённо сбросить exclusions |
| `schedule_request` | `app` | Вернуть unavailable/manual-run fallback v0.1 |
| `schedule_state` | `app` | Показать инертное schedule state v0.1 |

# MCP App resource

| Свойство | Каноническое значение |
|---|---|
| URI | `ui://codex-mac-cleaner/dashboard-v3.html` |
| MIME | `text/html;profile=mcp-app` |
| Tool binding | `dashboard_open` |
| App bridge | включён |
| Redirect allowlist | `https://github.com`, `https://dzzen.com` |
| Connect/resource/frame domains | отсутствуют |
| Следующая страница | только `dashboard_page` после клика |

# Проверяемая цепочка

1. `.mcp.json` объявляет единственный plugin-relative Node stdio entrypoint.
2. `pnpm probe:plugin-surface` запускает этот entrypoint на синтетическом
   временном `HOME`.
3. Probe сравнивает полный tool inventory и visibility metadata с этой матрицей.
4. Probe читает Dashboard resource и проверяет URI, MIME и CSP.
5. Plugin-test намеренно подменяет URI во временной копии runtime и доказывает,
   что drift завершает probe ошибкой.
6. Полный audit flow, exact terminal revision, pagination и policy проверяются
   отдельными contract/runtime/widget integration tests.

# Заимствованный паттерн и граница

Идея явной capability matrix и отдельного MCP probe взята из открытого проекта
[nexu-io/codex-slides](https://github.com/nexu-io/codex-slides). Его
Browser-first Next.js/HTTP-сервер, runtime `npm install`/build, широкая
model-visible поверхность и persisted raw project state не являются частью
Codex Mac Cleaner.

# Источники

1. [MCP-tools](../contracts/mcp-tools.md)
2. [Компоненты](../architecture/components.md)
3. [Диагностика запуска](../development/audit-runtime-troubleshooting.md)
4. [Codex Slides capability matrix](https://github.com/nexu-io/codex-slides/blob/dbc2a5992e937760e9ce8e587e11729f970881cb/skills/codex-slides/references/CAPABILITY_MATRIX.md)
5. [Codex Slides MCP probe](https://github.com/nexu-io/codex-slides/blob/dbc2a5992e937760e9ce8e587e11729f970881cb/scripts/probe-mcp.mjs)

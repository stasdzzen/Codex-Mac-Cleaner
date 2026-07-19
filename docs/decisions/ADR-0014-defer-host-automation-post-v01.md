---
type: ADR
title: "ADR-0014: host-native automation после v0.1"
description: Перенос lifecycle ежемесячной Codex automation в capability-релиз после v0.1 при сохранении честного disabled/manual-run fallback.
tags: [adr, scheduling, automation, scope, release]
status: approved
owner: Architect
date: 2026-07-19
---

# Контекст

ADR-0011 включил capability-aware ежемесячный read-only audit в v0.1 и связал финальную security/release-evidence Issue `CMC-10` с реализацией host-native automation в `CMC-13`. При подготовке реализации выяснилось, что lifecycle внешней host capability — создание, update, pause, resume, delete и выполнение scheduled prompt — не нужен для доказательства основного cleanup-контура v0.1 и не должен блокировать его release evidence.

При этом уже согласованные `ScheduleIntent`/`ScheduleState`, schedule-intent tool skeleton и пятая вкладка Dashboard полезны как совместимая основа будущего capability-релиза. Удалять их из контрактов не требуется, но их наличие нельзя выдавать за работающую automation.

# Решение

1. Host-native monthly automation lifecycle переносится целиком из v0.1 в отдельный capability-релиз после v0.1. В v0.1 не создаются, не обновляются, не приостанавливаются, не возобновляются и не удаляются Codex automations; scheduled prompt не является частью release surface.
2. `ScheduleIntent`/`ScheduleState`, schedule-intent tool skeleton и вкладка «Расписание» могут остаться в v0.1 только как инертная compatibility groundwork. Их наличие не является implementation или release claim host automation.
3. Вкладка «Расписание» v0.1 всегда показывает честное недоступное состояние и предлагает обычный ручной запуск read-only `application_remnants`. Manual run использует существующий audit flow и не создаёт schedule intent, automation или фоновую задачу.
4. Любая lifecycle-команда в v0.1 завершается fail closed без host action. `enabled` остаётся `false`, opaque automation ID отсутствует, next/last scheduled run не заявляются.
5. Запрет собственного cron, LaunchAgent, LaunchDaemon, system daemon и любого скрытого scheduler остаётся неизменным и действует как для v0.1, так и для будущего capability-релиза. Отсутствие host capability нельзя обходить альтернативным scheduler.
6. `CMC-10` больше не зависит от `CMC-13`. Gate security/release evidence проверяет только честный disabled/manual-run fallback, инертность skeleton и отсутствие host/system scheduler side effects.
7. `CMC-13` зависит от `CMC-10`, относится к post-v0.1 и остаётся `cto:blocked` до отдельного решения владельца открыть capability-релиз. Только тогда lifecycle и scheduled-prompt tests снова становятся критериями этой Issue.

# Замена предыдущего решения

ADR-0014 заменяет пункты 7–8 решения ADR-0011, scheduling-часть его последствий и все производные утверждения о том, что host-native automation lifecycle или scheduled prompt входят в release gates v0.1.

ADR-0011 остаётся каноническим для универсальных protected classes, `UserExclusion`, поэлементных пользовательских действий, privacy-redaction, запрета system mutation и запрета cron/LaunchAgent/hidden scheduler. Архитектурный skeleton расписания сохраняется только в границах этого ADR.

# Неизменяемые safety-инварианты

Перенос automation не меняет protected scopes, redaction, server-owned correlation/policy, one-object quarantine, restore/purge, privacy, no-terminal flow и owner release gates. Read-only audit не получает mutation authority; manual run не выполняет cleanup автоматически. Release, tag, publication и real-Mac smoke по-прежнему требуют отдельных действий владельца.

# Последствия

* Критический путь v0.1 заканчивается `CMC-09 → CMC-23 → CMC-10`; `CMC-13` идёт после `CMC-10` и не блокирует v0.1.
* Schedule schemas/intents могут проверяться как строгие инертные контракты, но duplicate/update/pause/resume/delete и scheduled-prompt behavior не входят в CMC-10 или Gates G/H v0.1.
* UI v0.1 сохраняет пять вкладок; «Расписание» не показывает opt-in controls или вымышленные capability/next-run результаты и ведёт только к ручному read-only аудиту.
* Будущий запуск `CMC-13` требует отдельного owner decision, повторной проверки актуальной host capability и нового final-SHA evidence. Этот ADR сам не разрешает реализацию automation.

# Связанные концепты

* [ADR-0011: публичный продукт, исключения и расписание](ADR-0011-public-plugin-exclusions-scheduling.md)
* [Границы v0.1](../foundation/scope-and-principles.md)
* [MCP contract](../contracts/mcp-tools.md)
* [Roadmap](../product/implementation-roadmap.md)
* [Release checklist](../product/release-checklist.md)

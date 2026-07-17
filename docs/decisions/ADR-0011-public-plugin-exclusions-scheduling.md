---
type: ADR
title: "ADR-0011: публичный продукт, пользовательские исключения и Codex-расписание"
description: Замена персонального denylist универсальными правилами и добавление persistent exclusions и capability-aware scheduling.
tags: [adr, public-plugin, privacy, exclusions, scheduling]
status: approved
owner: Architect
date: 2026-07-17
---

# Контекст

ADR-0010 превратил полевой аудит владельца в safety-контракт, но ошибочно закрепил персональный каталог и названия конкретных продуктов как неизменяемые правила публичного runtime. Для личного прототипа это было безопасно, однако публичный плагин не должен переносить решения одного пользователя на других.

Новая продуктовая модель также различает временное «Пропустить сейчас» и долговременное «Исключить», требует локального управления исключениями и ежемесячного read-only аудита через нативную Codex automation при доступной host capability.

# Решение

1. Публичный runtime содержит только универсальные protected classes: system scope, credential stores, browser profiles/cookies/passwords/bookmarks, user documents/projects/repositories/databases/saves, current project root, plugin-owned state и Codex state. Персональные app names и owner paths удаляются из built-in registry.
2. `~/.codex` остаётся защищённым универсальным prefix как состояние Codex. Любой локальный Git-проект защищён независимо от пути.
3. Built-in `ProtectedScopeRule` и изменяемый пользователем `UserExclusion` — разные сущности. Пользователь не может ослабить protected rule, а exclusion не превращает объект в мусор и не разрешает mutation.
4. `UserExclusion` хранится в user Application Support вне репозитория и `~/.codex`, использует versioned JSON, атомарную запись, права `0600` и устойчивую identity из rule/type/owner/bundle-package/signing/normalized-target evidence. Path-only match запрещён.
5. Finding получает пользовательские действия «Удалить», «Исключить» и «Пропустить сейчас». «Удалить» в v0.1 означает отдельное подтверждение и карантин одного объекта; direct delete исходника запрещён. Permanent purge остаётся отдельным действием Quarantine Center.
6. Dashboard получает вкладки «Исключения» и «Расписание». Сброс всех исключений требует подтверждения.
7. Расписание создаётся через `request_schedule` intent и Skill/host capability bridge. MCP App не вызывает нативную automation напрямую. Нет capability — нет скрытого cron/LaunchAgent; UI показывает честный fallback.
8. Scheduled run выполняет только read-only аудит, применяет exclusions и никогда не создаёт mutation token либо `sudo`-запрос.
9. System mutation, privileged helper и отдельные Browser/Developer cleanup profiles остаются вне v0.1. Targeted system inspection может вернуть только `unsupported_manual` и «Требует расширенного режима».

# Замена предыдущего решения

ADR-0011 заменяет пункты 1 и 6 решения ADR-0010 и связанные с ними последствия. Остальные инварианты ADR-0010 — SafeMetadata, раздельные evidence, support levels, APFS-метрики и no-terminal flow — сохраняются.

Смысл и хронология ADR-0010 сохраняются. Точные private owner-specific примеры удалены из публичного документа как privacy redaction и отмечены в нём явно. Каноническим для protected scopes и пользовательских решений становится ADR-0011.

# Последствия

* Runtime-код ещё не создан, поэтому миграция пользовательских данных не требуется. Schema migrations всё равно входят в acceptance criteria до первого публичного alpha.
* Существующие Issues `CMC-03`, `CMC-04`, `CMC-05`, `CMC-08`, `CMC-09`, `CMC-10` расширяются до начала реализации.
* Persistent exclusions реализует новая `CMC-12`, scheduling bridge — новая `CMC-13`.
* `CMC-14` и `CMC-15` фиксируют будущие исследования и остаются `cto:blocked` до owner approval нового профиля и ADR.
* `CMC-01` зависит от merge `CMC-11`, чтобы реализация не началась на устаревшем каноне.
* Публикация release, tag и Plugin Directory не разрешается этим ADR.

# Связанные концепты

* [Спецификация публичного контракта](../superpowers/specs/2026-07-17-public-plugin-contract-design.md)
* [Полевой safety-контракт](ADR-0010-field-research-safety-contract.md)
* [Safety model](../safety/safety-model.md)
* [MCP contract](../contracts/mcp-tools.md)

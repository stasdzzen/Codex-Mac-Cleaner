---
type: ADR
title: "ADR-0009: safety/UX-дополнения v0.1"
description: Добавление Quarantine Center, честных метрик размера и отмены read-only аудита.
tags: [adr, ui, quarantine, audit, safety]
status: approved
owner: Architect
date: 2026-07-17
---

# Контекст

Исходный канон описывал backend-контракты quarantine/restore/purge, но не требовал отдельный Quarantine Center в Dashboard. Тестовая стратегия упоминала отмену аудита, но MCP-контракт не содержал `audit_cancel`. Интерфейс также не разделял найденный объём, занятое карантином место и размер окончательно удалённых payload.

# Решение

1. Dashboard состоит из вкладок «Обзор», «Находки» и «Карантин». Quarantine Center показывает записи и даёт только поэлементные «Восстановить» и «Удалить навсегда».
2. MCP-контракт получает model-visible `audit_cancel`. Состояния `cancelling` и `cancelled` входят в автомат аудита. Частичный отчёт `cancelled` не образует actionable revision и возвращает пустые `allowedActions`.
3. Сервер вычисляет, а UI только показывает три метрики: «Найдено кандидатов», «В карантине» и «Удалено навсегда». Последняя метрика отражает physical size записей `purged` в действующем локальном журнале, а не точный прирост свободного места APFS.
4. К утверждённым shadcn/ui components добавляются `Tabs`, `Button` и `Tooltip`.
5. Массового выбора, автоматического purge и кнопки «Очистить всё» в v0.1 нет.

# Последствия

* ADR-0009 расширяет ADR-0004 и ADR-0006, но не заменяет их.
* Миграция runtime-данных не нужна: реализация и публичный local store ещё не существуют.
* Scope распределяется по `CMC-03`, `CMC-04`, `CMC-07`, `CMC-08`, `CMC-09` и `CMC-10`; отдельная Issue не создаётся.
* Отмена аудита, Quarantine Center и метрики становятся release-blocking requirements.

# Связанные концепты

* [Узкий scope v0.1](ADR-0004-v01-scope.md)
* [Тёмный Dashboard](ADR-0006-dark-shadcn-dashboard.md)
* [Спецификация дизайна](../superpowers/specs/2026-07-17-v01-safety-ux-additions-design.md)
* [MCP-контракт](../contracts/mcp-tools.md)
* [Критерии приёмки](../quality/acceptance-gates.md)

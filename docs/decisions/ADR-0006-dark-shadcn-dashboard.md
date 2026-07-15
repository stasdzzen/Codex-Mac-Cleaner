---
type: ADR
title: "ADR-0006: тёмный Audit Dashboard на shadcn/ui"
description: Выбор интерфейсного паттерна, темы и базовых компонентов MCP App.
tags: [adr, ui, shadcn, dashboard]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Пользователю нужно сравнивать много находок, раскрывать доказательства и подтверждать рискованные действия по одному объекту. Интерфейс должен быть компактным, предсказуемым и автономным.

# Решение

Использовать тёмный Audit Dashboard на React/Vite и shadcn/ui. Базовые компоненты: `Card`, `Progress`, `Table`, `Badge`, `Sheet`, `Alert`, `AlertDialog`, `Skeleton` и `sonner`.

# Последствия

* Цвета задаются semantic tokens; raw colors и ручные `dark:` overrides запрещены.
* Mutation подтверждается через `AlertDialog`, а evidence читается в `Sheet`.
* Bundle не загружает CDN, внешние шрифты или runtime-ресурсы.
* Серверная политика остаётся источником `allowedActions`; скрытие или показ кнопки не является мерой безопасности.

# Источник

1. [shadcn/ui](https://ui.shadcn.com/)

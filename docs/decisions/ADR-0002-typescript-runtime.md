---
type: ADR
title: "ADR-0002: TypeScript/Node.js runtime"
description: Выбор единого runtime для локального MCP-сервера и web-интерфейса.
tags: [adr, typescript, nodejs, mcp]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Продукту нужны MCP tools, локальная файловая логика и React widget. Native helper не требуется для утверждённого пользовательского scope.

# Решение

Использовать TypeScript/Node.js для локального MCP-сервера и React/Vite для MCP App. Swift, privileged helper и system extension не входят в v0.1.

# Последствия

* Сервер и UI разделяют типы контрактов, но не доверенные границы.
* Все системные команды вызываются без shell interpolation и с runtime validation результатов.
* Операции, которые невозможно безопасно реализовать с правами пользователя, исключаются, а не обходятся через `sudo`.
* Появление Swift-компонента требует нового ADR с отдельной моделью подписи, прав и обновления.

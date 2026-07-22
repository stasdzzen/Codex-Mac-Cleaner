---
type: ADR
title: "ADR-0016: только fullscreen для расширенного отображения Dashboard"
description: Отказ от Picture-in-Picture в Audit Dashboard при сохранении явного пользовательского fullscreen-запроса.
tags: [adr, dashboard, mcp, ui, fullscreen]
status: approved
owner: Architect
date: 2026-07-22
---

# Контекст

Версия `v0.1.0-beta.6` добавила две отдельные кнопки запроса режима отображения:
`fullscreen` и Picture-in-Picture (`pip`, «Мини-окно»). Real-Mac smoke владельца
подтвердил, что Codex уже открывает Dashboard в удобной боковой поверхности.
Дополнительная кнопка «Мини-окно» не помогает основному потоку аудита и создаёт
лишний конкурирующий режим управления интерфейсом.

PiP предназначен прежде всего для постоянно видимых live-сессий с минимальными
элементами управления. Audit Dashboard остаётся полноценным многораздельным
интерфейсом: пользователь изучает прогресс, доказательства, исключения и карантин.

# Решение

Audit Dashboard больше не предлагает и не запрашивает режим `pip`:

* кнопка «Мини-окно», её иконка, pending-state и сообщения об отказе удаляются;
* widget bridge на уровне TypeScript разрешает только запрос `fullscreen`;
* `fullscreen` по-прежнему запрашивается только после явного нажатия
  «Развернуть»;
* отсутствие host capability или отказ Codex сохраняют текущий Dashboard и не
  меняют состояние аудита.

Изменение является сужением presentation-возможностей и не меняет input/output
schema `dashboard_open`, MCP tools, widget snapshot или mutation authority.
Поэтому ресурс остаётся `ui://codex-mac-cleaner/dashboard-v2.html`. Опубликованные
заметки и артефакты `v0.1.0-beta.6` не переписываются: они описывают исторически
выпущенную версию.

# Safety-инварианты

Решение не меняет audit coverage, server-owned policy, protected scopes,
correlation, карантин, поэлементное подтверждение, privacy boundary или
видимость MCP tools. UI не получает новый способ влиять на файловую систему.

# Последствия

* В шапке Dashboard остаётся одно действие отображения — «Развернуть».
* Приложение не может отправить product-owned запрос `{ mode: "pip" }`.
* Физическое размещение Dashboard по-прежнему выбирает Codex host; продукт не
  обещает правую панель и не имитирует её недокументированными metadata.
* Focused tests проверяют отсутствие «Мини-окна», единственный fullscreen-вызов
  после клика и безопасный отказ host.

# Связанные концепты

* [Компоненты](../architecture/components.md)
* [MCP tools](../contracts/mcp-tools.md)
* [PRD](../product/PRD-codex-mac-cleaner.md)
* [ADR-0015](ADR-0015-live-audit-dashboard-and-shared-inventories.md)

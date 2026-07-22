---
type: ADR
title: "ADR-0017: подвал Dashboard и host-mediated ссылки проекта"
description: Фиксированный набор community/support ссылок в Dashboard без внешних fetch, telemetry и новых MCP-tools.
tags: [adr, dashboard, mcp, ui, community, csp]
status: approved
owner: Architect
date: 2026-07-22
---

# Контекст

После успешного Real-Mac smoke боковой поверхности владелец запросил постоянный
подвал Audit Dashboard: копирайт, ссылку на публичный репозиторий, вход для идей,
ссылку на разработчика и будущую страницу поддержки проекта.

До этого Dashboard имел пустой CSP и не открывал внешние назначения. Обычные
HTML-ссылки или `window.open` обходили бы документированный host flow и усложнили
бы контроль разрешённых доменов. Дополнительный MCP-tool для навигации также не
нужен: переход не относится к данным аудита и выполняется только по клику человека.

# Решение

Dashboard получает адаптивный footer со следующими фиксированными назначениями:

* репозиторий: `https://github.com/stasdzzen/Codex-Mac-Cleaner`;
* новая идея: `https://github.com/stasdzzen/Codex-Mac-Cleaner/discussions/new?category=ideas`;
* разработчик: `https://dzzen.com`;
* поддержка: `https://dzzen.com/support`.

Внешняя навигация выполняется только после явного нажатия пользователя через
документированный `window.openai.openExternal({ href })`. Widget bridge принимает
только перечисленный closed union URL и повторно сверяет значение с локальным
allowlist перед обращением к host. Отсутствие capability или отказ host показывают
короткий toast и сохраняют Dashboard.

Resource CSP получает только `redirectDomains` для `https://github.com` и
`https://dzzen.com`. `connectDomains`, `resourceDomains` и `frameDomains` остаются
пустыми. Footer не вызывает MCP tools, не меняет widget state и не запускает
автоматическую навигацию.

GitHub Discussions включаются для публичного репозитория; кнопка идей использует
фактическую категорию `Ideas` со slug `ideas`. Стандартный `.github/FUNDING.yml` и
README указывают `https://dzzen.com/support`. Сама страница поддержки будет создана
отдельно; текущая задача не заявляет её готовность.

# Safety-инварианты

Решение не меняет audit coverage, server-owned policy, protected scopes,
correlation, карантин, поэлементное подтверждение, model/app tool visibility или
privacy boundary. Внешние переходы не получают audit payload, paths, secrets,
identities или telemetry parameters.

# Последствия

* Пользователь может открыть репозиторий, предложить идею и найти автора из
  Dashboard без поиска ссылок вручную.
* GitHub показывает стандартную ссылку поддержки проекта.
* Добавление любого нового домена требует явного изменения allowlist, CSP,
  документации и тестов.
* Published release notes `v0.1.0-beta.6` не переписываются.

# Связанные концепты

* [Компоненты](../architecture/components.md)
* [MCP tools](../contracts/mcp-tools.md)
* [ADR-0016](ADR-0016-fullscreen-only-dashboard-display.md)

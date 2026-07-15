---
type: ADR
title: "ADR-0007: GitHub Releases и repository marketplace"
description: Канал распространения v0.1 и граница публичной публикации плагина.
tags: [adr, distribution, release, plugin]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Первый релиз должен быть устанавливаемым и проверяемым, но публичная директория требует стабильного UX, поддержки и подтверждённой совместимости submission flow с локальным filesystem MCP.

# Решение

Распространять v0.1 через GitHub Releases и repository-based Codex plugin marketplace. Публикацию в публичной Plugin Directory отложить до стабильного v1 и отдельной проверки требований.

# Обязательная структура плагина

* `.codex-plugin/plugin.json`;
* `.mcp.json`;
* каталог Skill с `SKILL.md`;
* ссылка на версионированный release artifact.

# Последствия

* Release содержит checksum, SBOM и provenance, связанные с commit и tag.
* Установка из репозитория и clean-room запуск входят в acceptance gates.
* Документация не обещает присутствие в публичной Plugin Directory.
* Переход к публичной публикации требует release readiness review.

# Источники

1. [Codex: Build plugins](https://developers.openai.com/codex/plugins/)
2. [Codex: Submit plugins](https://developers.openai.com/codex/plugins/submit/)

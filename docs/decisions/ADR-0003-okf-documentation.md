---
type: ADR
title: "ADR-0003: Open Knowledge Format для документации"
description: Выбор OKF bundle как канонической структуры архитектурных документов.
tags: [adr, documentation, okf]
status: approved
owner: Architect
date: 2026-07-15
---

# Контекст

Архитектурный канон должен одинаково читаться человеком и агентом, поддерживать progressive disclosure и не зависеть от отдельного viewer.

# Решение

Использовать `docs/` как OKF v0.1 Draft bundle, зафиксированный на ревизии `d44368c15e38e7c92481c5992e4f9b5b421a801d` проекта GoogleCloudPlatform/knowledge-catalog.

Reference-agent и viewer Google не входят в runtime. Структуру проверяет собственный validator проекта.

# Последствия

* `index.md` и `log.md` имеют зарезервированные роли.
* Все остальные Markdown-файлы содержат YAML frontmatter и `type`.
* Обновление upstream не применяется автоматически и требует нового ADR.
* Product- и implementation-документы обязаны ссылаться на архитектурные концепты, а не копировать их с расхождениями.

# Источники

1. [Open Knowledge Format v0.1 Draft](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md)
2. [GoogleCloudPlatform/knowledge-catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/d44368c15e38e7c92481c5992e4f9b5b421a801d)

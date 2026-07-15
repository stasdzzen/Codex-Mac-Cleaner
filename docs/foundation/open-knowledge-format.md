---
type: Standard Adoption
title: Open Knowledge Format для архитектурного канона
description: Правила хранения документации Codex Mac Cleaner как OKF bundle.
tags: [foundation, okf, documentation]
status: approved
owner: Architect
date: 2026-07-15
---

# Решение

Каталог `docs/` — самостоятельный Open Knowledge Format bundle. Проект использует формат, но не включает Google reference-agent или viewer в runtime и зависимости продукта.

# Зафиксированная версия

Канон ориентируется на OKF v0.1 Draft из ревизии `d44368c15e38e7c92481c5992e4f9b5b421a801d` репозитория `GoogleCloudPlatform/knowledge-catalog`.

Обновление версии OKF требует отдельного ADR. Изменение upstream draft не применяется автоматически.

# Правила bundle

* `index.md` перечисляет концепты и подкаталоги для progressive disclosure.
* `log.md` хранит историю изменений, новые записи идут первыми.
* Каждый другой Markdown-файл содержит YAML frontmatter и непустой `type`.
* Документы связываются обычными относительными Markdown-ссылками.
* Внешние утверждения получают раздел «Источники».
* Неизвестные frontmatter-поля сохраняются при автоматической обработке.
* Собственный validator проверяет структуру без запуска Google reference-agent.

# Локальная таксономия `type`

* `Source Concept`
* `Scope`
* `Standard Adoption`
* `Terminology`
* `Architecture`
* `Runtime Flow`
* `Domain Model`
* `MCP Contract`
* `Error Contract`
* `Safety Policy`
* `Threat Model`
* `Path Policy`
* `ADR`
* `Test Strategy`
* `Acceptance Gate`
* `Product Handoff`
* `Product Requirements`
* `Product Roadmap`
* `Traceability`
* `Release Checklist`
* `Implementation Plan`
* `Worker Prompt`
* `Execution Contract`

# Лицензионная граница

Использование структуры OKF не означает копирование reference-agent или viewer. Если проект позже перенесёт код или текст из upstream, такая работа должна отдельно проверить условия Apache-2.0 и attribution.

# Источники

1. [Open Knowledge Format v0.1 Draft](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md)
2. [Обзор OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/README.md)

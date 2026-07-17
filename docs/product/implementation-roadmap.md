---
type: Product Roadmap
title: Roadmap реализации Codex Mac Cleaner v0.1
description: Рабочие пакеты, зависимости, границы параллельности и ожидаемые результаты.
tags: [product, roadmap, issues, dependencies]
status: approved
owner: Architect
date: 2026-07-15
---

# Правила roadmap

Каждый пакет становится одной GitHub Issue, одной задачей Codex, одним managed worktree, одной веткой и одним PR. Закрытая dependency означает фактически merged и проверенный результат, а не только открытый PR.

# Рабочие пакеты

| ID | Результат | Зависимости | Риск | Параллельность |
|---|---|---|---|---|
| `CMC-01` | MIT заменён на Apache-2.0 с проверенной metadata | Нет | Высокий: legal | Только последовательно; требует прямого разрешения владельца |
| `CMC-02` | Workspace, platform guard и общие quality-команды | `CMC-01` | Средний | Последовательно |
| `CMC-03` | Доменные schemas, JSON/NDJSON store, `audit_cancel` и model-visible MCP skeleton | `CMC-02` | Средний | Последовательно |
| `CMC-04` | Source adapters, capability report и cooperative cancellation | `CMC-03` | Средний | Можно выполнять независимо от UI |
| `CMC-05` | Evidence normalization, classifier и server-only policy | `CMC-04` | Высокий: security | Только последовательно |
| `CMC-06` | Quarantine transaction и crash recovery | `CMC-05` | Высокий: filesystem | Параллельно только с `CMC-08` |
| `CMC-07` | Restore, ручной purge и серверная quarantine summary | `CMC-06` | Высокий: filesystem | Только последовательно |
| `CMC-08` | Три вкладки Dashboard, Quarantine Center и метрики на shadcn/ui с fixtures | `CMC-05` | Средний | Параллельно с `CMC-06` |
| `CMC-09` | Plugin manifest, Skill, `audit_cancel` и полная MCP App integration | `CMC-07`, `CMC-08` | Средний | Последовательно |
| `CMC-10` | Security/privacy, cancel/race/E2E suite, clean-room packaging и release evidence | `CMC-09` | Высокий: release | Только последовательно; release не выполняется без владельца |

# Критический путь

`CMC-01 → CMC-02 → CMC-03 → CMC-04 → CMC-05 → CMC-06 → CMC-07 → CMC-09 → CMC-10`.

После `CMC-05` Controller может одновременно запустить `CMC-06` и `CMC-08`, если текущие touched paths не пересекаются и `max_parallel_tasks=2`.

# Границы готовности

* `CMC-01` остаётся `cto:blocked`, пока владелец отдельно не разрешит юридическое изменение.
* Остальные Issues получают `cto:ready`, но validator не считает их исполнимыми до закрытия dependencies.
* `CMC-10` может подготовить release evidence, но tag, publication и release требуют отдельной команды владельца.
* Любое ослабление safety-инварианта возвращается Архитектору и оформляется новым ADR.

# Источники

* [Вход Product-чату](../handoff/product-input.md)
* [Пошаговый план](../superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md)
* [Контракт выполнения](../development/execution-contract.md)

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
| `CMC-11` | Публичный продуктовый контракт, ADR-0011, gap matrix и синхронизированный backlog | Нет | Высокий: architecture/privacy | Завершено |
| `CMC-16` | Community health, repository gate, supply-chain settings и GitHub rulesets | `CMC-11` | Высокий: repository security | Только последовательно; GitHub settings после GREEN workflow |
| `CMC-01` | MIT заменён на Apache-2.0 с проверенной metadata | `CMC-11`, `CMC-16` | Высокий: legal | Только последовательно; требует прямого разрешения владельца |
| `CMC-17` | Git ignore для generated artifacts pnpm до установки workspace | `CMC-01` | Средний: repository hygiene | Только последовательно; разблокирует CMC-02 |
| `CMC-02` | Workspace, platform guard и общие quality-команды | `CMC-01`, `CMC-17` | Средний | Последовательно |
| `CMC-03` | Доменные schemas, universal protected/safe-metadata/finding-facts contracts, versioned local state, `audit_cancel` и model-visible MCP skeleton | `CMC-02` | Средний | Последовательно |
| `CMC-04` | Candidate/inspection-only adapters, uninstallers, missing targets, safe parsers, synthetic public fixtures, capability report и cancellation | `CMC-03` | Средний | Можно выполнять независимо от UI |
| `CMC-05` | Evidence normalization, classifier, universal protected scopes, uninstaller preference и server-only policy | `CMC-04` | Высокий: security | Только последовательно |
| `CMC-06` | Quarantine transaction и crash recovery | `CMC-05` | Высокий: filesystem | Параллельно только с `CMC-08` |
| `CMC-07` | Restore, ручной purge, расширенная StorageSummary и DiskObservation | `CMC-06` | Высокий: filesystem | Только последовательно |
| `CMC-08` | Пяти-вкладочный Dashboard shell, FindingFacts, «Удалить»/«Пропустить сейчас», support levels, Quarantine Center и метрики | `CMC-05` | Средний | Параллельно с `CMC-06` |
| `CMC-12` | Versioned persistent exclusions, identity matching и вкладка «Исключения» | `CMC-07`, `CMC-08` | Высокий: policy/state | Только последовательно |
| `CMC-09` | Public plugin manifest, Skill, `audit_cancel`, no-terminal flow и MCP App integration | `CMC-07`, `CMC-08`, `CMC-12` | Средний | Последовательно |
| `CMC-13` | Capability-aware monthly audit schedule и вкладка «Расписание» | `CMC-09` | Высокий: host integration | Только последовательно |
| `CMC-10` | Universal policy/redaction, exclusions/schedule E2E, clean-room/new-task, security и release evidence | `CMC-13` | Высокий: release | Только последовательно; release не выполняется без владельца |
| `CMC-14` | Architecture research Advanced Cleanup v0.2 и trusted privileged helper | `CMC-10` | Критический: system mutation | `cto:blocked` до owner approval и нового ADR |
| `CMC-15` | Architecture research Browser/Developer Storage profiles v0.2 | `CMC-10` | Высокий: personal/developer data | `cto:blocked` до owner approval и новых threat models |

# Критический путь

`CMC-11 → CMC-16 → CMC-01 → CMC-17 → CMC-02 → CMC-03 → CMC-04 → CMC-05 → CMC-06 → CMC-07 → CMC-12 → CMC-09 → CMC-13 → CMC-10`.

После `CMC-05` Controller может одновременно запустить `CMC-06` и `CMC-08`, если текущие touched paths не пересекаются и `max_parallel_tasks=2`.

# Границы готовности

* Прямое разрешение владельца на legal action CMC-01 получено 17 июля 2026 года; Issue имеет `cto:ready`, но выполняется только после отдельного запуска Controller.
* `CMC-01` не исполнима до merge `CMC-11` и repository hardening `CMC-16`; operational label не отменяет dependency check.
* Остальные Issues получают `cto:ready`, но validator не считает их исполнимыми до закрытия dependencies.
* `CMC-10` может подготовить release evidence, но tag, publication и release требуют отдельной команды владельца.
* Manual real-Mac smoke остаётся отдельным owner gate; автоматическая очередь не может отметить его выполненным.
* Любое ослабление safety-инварианта возвращается Архитектору и оформляется новым ADR.
* `CMC-14` и `CMC-15` не входят в v0.1 и остаются `cto:blocked`, даже когда `CMC-10` закрыта, пока владелец явно не откроет следующий профиль.

# Источники

* [Вход Product-чату](../handoff/product-input.md)
* [Пошаговый план](../superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md)
* [Контракт выполнения](../development/execution-contract.md)

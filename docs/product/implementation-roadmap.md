---
type: Product Roadmap
title: Roadmap реализации Codex Mac Cleaner v0.1
description: Рабочие пакеты, зависимости, границы параллельности и ожидаемые результаты.
tags: [product, roadmap, issues, dependencies]
status: approved
owner: Architect
date: 2026-07-21
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
| `CMC-18` | Синхронизированный lockfile scope для закреплённых зависимостей CMC-03 | `CMC-02` | Средний: управление репозиторием | Только последовательно; разблокирует CMC-03 |
| `CMC-03` | Доменные schemas, universal protected/safe-metadata/finding-facts contracts, versioned local state, `audit_cancel` и model-visible MCP skeleton | `CMC-02`, `CMC-18` | Средний | Последовательно |
| `CMC-19` | Синхронизированный lockfile scope очереди CMC-04/05/06/08/09 и frozen-install gates | `CMC-03` | Средний: управление репозиторием | Только последовательно; разблокирует CMC-04 |
| `CMC-04` | Candidate/inspection-only adapters, uninstallers, missing targets, safe parsers, synthetic public fixtures, capability report и cancellation | `CMC-03`, `CMC-19` | Средний | Можно выполнять независимо от UI |
| `CMC-05` | Evidence normalization, classifier, universal protected scopes, uninstaller preference и server-only policy | `CMC-04` | Высокий: security | Только последовательно |
| `CMC-06` | Quarantine transaction и crash recovery | `CMC-05` | Высокий: filesystem | Параллельно только с `CMC-08` |
| `CMC-07` | Restore, ручной purge, расширенная StorageSummary и DiskObservation | `CMC-06` | Высокий: filesystem | Только последовательно |
| `CMC-08` | Пяти-вкладочный Dashboard shell, FindingFacts, «Переместить в карантин»/«Пропустить сейчас», support levels, Quarantine Center и метрики | `CMC-05` | Средний | Параллельно с `CMC-06` |
| `CMC-12` | Versioned persistent exclusions, identity matching и вкладка «Исключения» | `CMC-07`, `CMC-08` | Высокий: policy/state | Только последовательно |
| `CMC-20` | ADR-0012, correlation contract, privacy/coverage/snapshot semantics и handoff CMC-21 | `CMC-04`, `CMC-05`, `CMC-12` | Высокий: architecture/privacy | Только docs-first; merge до реализации |
| `CMC-22` | ADR-0013: Library artifact/owner binding, receipt lifecycle, requirement profile и production actionability proof | `CMC-20` | Высокий: architecture/safety | Завершено 18 июля 2026 года |
| `CMC-21` | Core server-owned correlation/evidence resolver, keyed exclusion derivation, actionable Library cache/log profile и deterministic tests | `CMC-20`, `CMC-22` | Высокий: security/policy/state | Завершено 18 июля 2026 года |
| `CMC-09` | Public plugin manifest, Skill, `audit_cancel`, no-terminal flow, инертный schedule skeleton и MCP App integration | `CMC-07`, `CMC-08`, `CMC-12`, `CMC-21` | Средний | Завершено 19 июля 2026 года |
| `CMC-23` | ADR-0014 и перенос host automation lifecycle после v0.1 при сохранении инертного skeleton/disabled fallback | `CMC-09` | Высокий: architecture/release scope | Текущая docs-first Issue #41; только этот worktree/branch/PR |
| `CMC-10` | Universal policy/redaction, exclusions, disabled schedule fallback, clean-room/new-task, security и release evidence | `CMC-23` | Высокий: release | Только последовательно; release не выполняется без владельца |
| `CMC-24` | Исправленный запуск packaged MCP после marketplace install | `CMC-10` | Средний: plugin runtime | Завершено 21 июля 2026 года |
| `CMC-25` | Устанавливаемый prerelease `v0.1.0-beta.2` | `CMC-24` | Высокий: release | Завершено 21 июля 2026 года |
| `CMC-26` | Dashboard v2 при старте, server-owned progress и shared global inventories A/B | `CMC-25` | Высокий: architecture/runtime | Issue #48; только последовательно |
| `CMC-43` | ADR-0019 и полный проход по всем кандидатам без общего автоматического deadline | `CMC-41` | Высокий: architecture/runtime/completeness | Issue #82; отдельный worktree, merge только после CMC-42 и rebase из-за общей трассировки |
| `CMC-13` | Post-v0.1 capability-aware monthly automation lifecycle и scheduled prompt | `CMC-10` | Высокий: host integration | `cto:blocked` до отдельного owner decision открыть capability-релиз |
| `CMC-14` | Architecture research Advanced Cleanup v0.2 и trusted privileged helper | `CMC-10` | Критический: system mutation | `cto:blocked` до owner approval и нового ADR |
| `CMC-15` | Architecture research Browser/Developer Storage profiles v0.2 | `CMC-10` | Высокий: personal/developer data | `cto:blocked` до owner approval и новых threat models |

# Критический путь

`CMC-11 → CMC-16 → CMC-01 → CMC-17 → CMC-02 → CMC-18 → CMC-03 → CMC-19 → CMC-04 → CMC-05 → CMC-06 → CMC-07 → CMC-12 → CMC-20 → CMC-22 → CMC-21 → CMC-09 → CMC-23 → CMC-10`.

`CMC-13` не входит в критический путь v0.1. Возможный post-v0.1 путь начинается только после `CMC-10` и отдельного owner decision.

После `CMC-05` Controller может одновременно запустить `CMC-06` и `CMC-08`, если текущие touched paths не пересекаются и `max_parallel_tasks=2`.

# Границы готовности

* Прямое разрешение владельца на legal action CMC-01 получено 17 июля 2026 года; Issue имеет `cto:ready`, но выполняется только после отдельного запуска Controller.
* `CMC-01` не исполнима до merge `CMC-11` и repository hardening `CMC-16`; operational label не отменяет dependency check.
* Остальные Issues получают `cto:ready`, но validator не считает их исполнимыми до закрытия dependencies.
* `CMC-10` может подготовить release evidence, но tag, publication и release требуют отдельной команды владельца.
* `CMC-10` не зависит от host automation lifecycle: до merge CMC-23 она ожидает `#41`, после merge готова по dependency contract.
* Manual real-Mac smoke остаётся отдельным owner gate; автоматическая очередь не может отметить его выполненным.
* Любое ослабление safety-инварианта возвращается Архитектору и оформляется новым ADR.
* `CMC-13`, `CMC-14` и `CMC-15` не входят в v0.1 и остаются `cto:blocked`, даже когда `CMC-10` закрыта, пока владелец явно не откроет соответствующий post-v0.1 capability/profile.
* CMC-20, CMC-22, CMC-21 и CMC-09 завершены в исходных задачах/ветках/PR; recovery-последовательность закрыта без замены identity.

# Источники

* [Вход Product-чату](../handoff/product-input.md)
* [Пошаговый план](../superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md)
* [Контракт выполнения](../development/execution-contract.md)

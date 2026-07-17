---
type: Traceability
title: Трассировка требований v0.1
description: Связь продуктовых требований с каноном, рабочими пакетами и release gates.
tags: [product, requirements, traceability, quality]
status: approved
owner: Architect
date: 2026-07-15
---

# Матрица

| Requirement | Суть | Канон | Рабочие пакеты | Gate |
|---|---|---|---|---|
| `REQ-PLAT-01` | Только macOS 26+ `arm64` | [ADR-0001](../decisions/ADR-0001-target-platform.md) | `CMC-02` | B |
| `REQ-LIC-01` | Apache-2.0 до первого кода | [ADR-0008](../decisions/ADR-0008-apache-license.md) | `CMC-01` | A |
| `REQ-AUDIT-01` | Read-only профиль `application_remnants` | [Границы](../foundation/scope-and-principles.md) | `CMC-03`, `CMC-04` | C |
| `REQ-CANCEL-01` | Идемпотентная отмена аудита без actionable partial revision | [ADR-0009](../decisions/ADR-0009-v01-safety-ux-completion.md) | `CMC-03`, `CMC-04`, `CMC-08`, `CMC-09`, `CMC-10` | C, D, G, H |
| `REQ-COVER-01` | Coverage gaps видимы и структурированы | [Доменная модель](../contracts/domain-model.md) | `CMC-04` | C |
| `REQ-EVID-01` | Named rules, evidence и counter-evidence | [Компоненты](../architecture/components.md) | `CMC-05` | C |
| `REQ-POL-01` | Только server policy вычисляет действия | [Модель безопасности](../safety/safety-model.md) | `CMC-05` | D |
| `REQ-PATH-01` | Allowlist и запрет link/mount escape | [Политика путей](../safety/path-policy.md) | `CMC-05`, `CMC-06` | D, E |
| `REQ-MOVE-01` | Поэлементный durable atomic quarantine | [Runtime flows](../architecture/runtime-flows.md) | `CMC-06` | E |
| `REQ-REST-01` | Restore только в исходный свободный путь | [Манифест](../contracts/quarantine-manifest.md) | `CMC-07` | E |
| `REQ-PURGE-01` | Только ручной поэлементный purge | [Runtime flows](../architecture/runtime-flows.md) | `CMC-07` | F |
| `REQ-QCTR-01` | Quarantine Center с поэлементным restore/purge | [ADR-0009](../decisions/ADR-0009-v01-safety-ux-completion.md) | `CMC-07`, `CMC-08`, `CMC-09` | E, F, G |
| `REQ-SIZE-01` | Серверные метрики без ложного APFS claim | [Доменная модель](../contracts/domain-model.md) | `CMC-03`, `CMC-07`, `CMC-08`, `CMC-09`, `CMC-10` | F, G, H |
| `REQ-MCP-01` | Model/app visibility и точные schemas | [MCP contract](../contracts/mcp-tools.md) | `CMC-03`, `CMC-09` | D |
| `REQ-PRIV-01` | Без сети, телеметрии и полных путей модели | [Threat model](../safety/threat-model.md) | `CMC-03`, `CMC-09`, `CMC-10` | G |
| `REQ-UI-01` | Тёмный shadcn Audit Dashboard с тремя вкладками | [ADR-0006](../decisions/ADR-0006-dark-shadcn-dashboard.md), [ADR-0009](../decisions/ADR-0009-v01-safety-ux-completion.md) | `CMC-08`, `CMC-09` | G |
| `REQ-DIST-01` | GitHub Releases и repository marketplace | [ADR-0007](../decisions/ADR-0007-github-distribution.md) | `CMC-09`, `CMC-10` | H |
| `REQ-REC-01` | Fault-injection recovery fail closed | [Модель угроз](../safety/threat-model.md) | `CMC-06`, `CMC-10` | E, H |

# Правило проверки

Issue и PR не могут объявить требование выполненным без ссылки на соответствующий automated output или явно незавершённый manual gate. Новый requirement получает ID, ссылку на канон, рабочий пакет и gate до начала реализации.

# GitHub-сопоставление

| ID | GitHub Issue | Текущий operational label |
|---|---|---|
| `CMC-01` | [#1 — Apache-2.0](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/1) | `cto:blocked` |
| `CMC-02` | [#2 — workspace и platform guard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/2) | `cto:ready`, ожидает `#1` |
| `CMC-03` | [#3 — contracts, store и MCP](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/3) | `cto:ready`, ожидает `#2` |
| `CMC-04` | [#4 — source adapters](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/4) | `cto:ready`, ожидает `#3` |
| `CMC-05` | [#5 — classifier и policy](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/5) | `cto:ready`, ожидает `#4` |
| `CMC-06` | [#6 — quarantine transaction](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/6) | `cto:ready`, ожидает `#5` |
| `CMC-07` | [#7 — restore и purge](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/7) | `cto:ready`, ожидает `#6` |
| `CMC-08` | [#8 — Audit Dashboard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/8) | `cto:ready`, ожидает `#5` |
| `CMC-09` | [#9 — MCP App и plugin](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/9) | `cto:ready`, ожидает `#7` и `#8` |
| `CMC-10` | [#10 — security и release evidence](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/10) | `cto:ready`, ожидает `#9` |

Operational label не заменяет dependency validation. Источником текущего readiness остаётся GitHub и `issue_contract.py`.

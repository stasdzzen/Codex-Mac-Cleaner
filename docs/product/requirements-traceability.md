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
| `REQ-COVER-01` | Coverage gaps видимы и структурированы | [Доменная модель](../contracts/domain-model.md) | `CMC-04` | C |
| `REQ-EVID-01` | Named rules, evidence и counter-evidence | [Компоненты](../architecture/components.md) | `CMC-05` | C |
| `REQ-POL-01` | Только server policy вычисляет действия | [Модель безопасности](../safety/safety-model.md) | `CMC-05` | D |
| `REQ-PATH-01` | Allowlist и запрет link/mount escape | [Политика путей](../safety/path-policy.md) | `CMC-05`, `CMC-06` | D, E |
| `REQ-MOVE-01` | Поэлементный durable atomic quarantine | [Runtime flows](../architecture/runtime-flows.md) | `CMC-06` | E |
| `REQ-REST-01` | Restore только в исходный свободный путь | [Манифест](../contracts/quarantine-manifest.md) | `CMC-07` | E |
| `REQ-PURGE-01` | Только ручной поэлементный purge | [Runtime flows](../architecture/runtime-flows.md) | `CMC-07` | F |
| `REQ-MCP-01` | Model/app visibility и точные schemas | [MCP contract](../contracts/mcp-tools.md) | `CMC-03`, `CMC-09` | D |
| `REQ-PRIV-01` | Без сети, телеметрии и полных путей модели | [Threat model](../safety/threat-model.md) | `CMC-03`, `CMC-09`, `CMC-10` | G |
| `REQ-UI-01` | Тёмный shadcn Audit Dashboard | [ADR-0006](../decisions/ADR-0006-dark-shadcn-dashboard.md) | `CMC-08`, `CMC-09` | G |
| `REQ-DIST-01` | GitHub Releases и repository marketplace | [ADR-0007](../decisions/ADR-0007-github-distribution.md) | `CMC-09`, `CMC-10` | H |
| `REQ-REC-01` | Fault-injection recovery fail closed | [Модель угроз](../safety/threat-model.md) | `CMC-06`, `CMC-10` | E, H |

# Правило проверки

Issue и PR не могут объявить требование выполненным без ссылки на соответствующий automated output или явно незавершённый manual gate. Новый requirement получает ID, ссылку на канон, рабочий пакет и gate до начала реализации.

# GitHub-сопоставление

Точные номера и URL Issues записываются после их создания. Стабильным идентификатором до этого служит `CMC-01`…`CMC-10`; пустые или вымышленные ссылки не используются.

---
type: Traceability
title: Трассировка требований v0.1
description: Связь продуктовых требований с каноном, рабочими пакетами и release gates.
tags: [product, requirements, traceability, quality]
status: approved
owner: Architect
date: 2026-07-22
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
| `REQ-CORR-01` | Server-owned subjects/edges связывают candidate с app/process/open-file/receipt/dependency без path/name-only resolution | [ADR-0012](../decisions/ADR-0012-server-owned-correlation-identity.md), [Correlation contract](../contracts/correlation-identity.md) | `CMC-20`, `CMC-22`, `CMC-21`, `CMC-09`, `CMC-10` | C, D, G, H |
| `REQ-OWNER-BIND-01` | Library artifact и owner app раздельны; только authoritative `remnant_of` создаёт action authority | [ADR-0013](../decisions/ADR-0013-actionable-library-remnant-correlation.md), [Correlation contract](../contracts/correlation-identity.md) | `CMC-22`, `CMC-21`, `CMC-09`, `CMC-10` | C, D, G, H |
| `REQ-PROFILE-01` | Только server-owned `private_regenerable_remnant_v1` для cache/log actionable; applicability не подменяет evidence | [ADR-0013](../decisions/ADR-0013-actionable-library-remnant-correlation.md), [Safety model](../safety/safety-model.md) | `CMC-22`, `CMC-21`, `CMC-09`, `CMC-10` | C, D, E, G, H |
| `REQ-NEG-01` | `absent` только с полным same-snapshot coverage; permission/capability/partial/ambiguous/mismatch дают `unknown` | [Correlation contract](../contracts/correlation-identity.md) | `CMC-20`, `CMC-21`, `CMC-09`, `CMC-10` | C, D, H |
| `REQ-REV-01` | Snapshot A/B, `staleDuringAudit` и token binding к immutable correlation revision | [ADR-0012](../decisions/ADR-0012-server-owned-correlation-identity.md) | `CMC-22`, `CMC-21`, `CMC-09`, `CMC-10` | C, D, E, H |
| `REQ-POL-01` | Только server policy вычисляет действия | [Модель безопасности](../safety/safety-model.md) | `CMC-05` | D |
| `REQ-PATH-01` | Allowlist и запрет link/mount escape | [Политика путей](../safety/path-policy.md) | `CMC-05`, `CMC-06` | D, E |
| `REQ-PROT-01` | Универсальные protected classes без персональных app/path rules | [ADR-0011](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md) | `CMC-03`, `CMC-04`, `CMC-05`, `CMC-10` | C, D, H |
| `REQ-META-01` | SafeMetadata и redaction JSON/YAML/plist до persistence | [ADR-0010](../decisions/ADR-0010-field-research-safety-contract.md) | `CMC-03`, `CMC-04`, `CMC-05`, `CMC-09`, `CMC-10` | C, D, G, H |
| `REQ-SUPP-01` | `candidate`, `analysis_only`, `unsupported_manual` без system mutation и shell-команд | [Доменная модель](../contracts/domain-model.md) | `CMC-03`, `CMC-04`, `CMC-05`, `CMC-08`, `CMC-09`, `CMC-10` | C, D, G, H |
| `REQ-MOVE-01` | Поэлементный durable atomic quarantine | [Runtime flows](../architecture/runtime-flows.md) | `CMC-06` | E |
| `REQ-REST-01` | Restore только в исходный свободный путь | [Манифест](../contracts/quarantine-manifest.md) | `CMC-07` | E |
| `REQ-PURGE-01` | Только ручной поэлементный purge | [Runtime flows](../architecture/runtime-flows.md) | `CMC-07` | F |
| `REQ-QCTR-01` | Quarantine Center с поэлементным restore/purge | [ADR-0009](../decisions/ADR-0009-v01-safety-ux-completion.md) | `CMC-07`, `CMC-08`, `CMC-09` | E, F, G |
| `REQ-SIZE-01` | Логический/физический размер, карантин, purge и DiskObservation без ложного APFS claim; UI использует десятичные МБ/ГБ | [Доменная модель](../contracts/domain-model.md), [ADR-0018](../decisions/ADR-0018-real-mac-audit-throughput-and-diagnostics.md) | `CMC-03`, `CMC-07`, `CMC-08`, `CMC-09`, `CMC-10`, `CMC-36` | F, G, H |
| `REQ-MCP-01` | Model/app visibility и точные schemas | [MCP contract](../contracts/mcp-tools.md) | `CMC-03`, `CMC-09` | D |
| `REQ-PRIV-01` | Без сети, телеметрии и полных путей модели | [Threat model](../safety/threat-model.md) | `CMC-03`, `CMC-09`, `CMC-10` | G |
| `REQ-CORR-PRIV-01` | Raw paths/inventory/bundle-package-signing identities/historical bindings/graph/tokens server-only; widget получает safe facts/actions | [Correlation contract](../contracts/correlation-identity.md) | `CMC-20`, `CMC-22`, `CMC-21`, `CMC-09`, `CMC-10` | D, G, H |
| `REQ-UI-01` | Тёмный shadcn Dashboard на Base UI с пятью вкладками, адаптивной компоновкой и понятными русскими подписями; «Автопроверка» в v0.1 только для ручного запуска | [ADR-0006](../decisions/ADR-0006-dark-shadcn-dashboard.md), [ADR-0009](../decisions/ADR-0009-v01-safety-ux-completion.md), [ADR-0014](../decisions/ADR-0014-defer-host-automation-post-v01.md) | `CMC-08`, `CMC-09`, `CMC-12`, `CMC-10`, `CMC-38`, `CMC-40` | G |
| `REQ-UI-LIVE-01` | Dashboard v2 открывается сразу, показывает server-owned phase/counts и до integer revision не содержит findings/actions | [ADR-0015](../decisions/ADR-0015-live-audit-dashboard-and-shared-inventories.md) | `CMC-26` | G, H |
| `REQ-UI-DISPLAY-01` | Dashboard остаётся inline по умолчанию; только fullscreen запрашивается кнопкой пользователя, PiP отсутствует, отказ хоста безопасен, правая панель не обещается | [ADR-0016](../decisions/ADR-0016-fullscreen-only-dashboard-display.md) | `CMC-32`, `CMC-35` | G, H |
| `REQ-UI-COMMUNITY-01` | Footer содержит фиксированные GitHub/Ideas/developer/support действия; переходы user-triggered и host-mediated, CSP разрешает только GitHub и dzzen redirect origins | [ADR-0017](../decisions/ADR-0017-dashboard-community-footer.md) | `CMC-35` | G, H |
| `REQ-AUDIT-PERF-01` | Global inventories снимаются один раз на Snapshot A/B фазу и не умножаются на число кандидатов | [ADR-0015](../decisions/ADR-0015-live-audit-dashboard-and-shared-inventories.md) | `CMC-26` | C, H |
| `REQ-AUDIT-THROUGHPUT-01` | Package inventory переиспользуется A/B, candidate correlation ограничена concurrency восемь, сохраняет порядок и обрабатывает все найденные кандидаты без общего автоматического deadline | [ADR-0018](../decisions/ADR-0018-real-mac-audit-throughput-and-diagnostics.md), [ADR-0019](../decisions/ADR-0019-complete-audit-without-overall-deadline.md) | `CMC-33`, `CMC-36`, `CMC-43` | C, H |
| `REQ-RUNTIME-DIAG-01` | Missing-target user LaunchAgent/process — `analysis_only`, системный LaunchAgent/LaunchDaemon/process — `unsupported_manual`; только inspect и generic model label | [ADR-0018](../decisions/ADR-0018-real-mac-audit-throughput-and-diagnostics.md) | `CMC-36` | C, D, G, H |
| `REQ-SKIP-01` | «Пропустить сейчас» — session-local no-op текущей ревизии | [ADR-0011](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md) | `CMC-08`, `CMC-09`, `CMC-10` | G, H |
| `REQ-FIND-01` | Карточка FindingFacts и честный `ReclaimEstimate` | [Публичный дизайн](../superpowers/specs/2026-07-17-public-plugin-contract-design.md) | `CMC-03`, `CMC-04`, `CMC-08`, `CMC-10` | C, G, H |
| `REQ-EXCL-01` | Versioned identity-based persistent exclusions и UI управления | [ADR-0011](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md) | `CMC-03`, `CMC-05`, `CMC-12`, `CMC-10` | D, G, H |
| `REQ-EXCL-02` | Identity mismatch не скрывает новый объект; excluded finding не получает preview | [Safety model](../safety/safety-model.md) | `CMC-05`, `CMC-12`, `CMC-10` | D, H |
| `REQ-EXCL-03` | Exclusion identity хранится installation-keyed digest; legacy migration и missing key работают fail closed | [ADR-0012](../decisions/ADR-0012-server-owned-correlation-identity.md) | `CMC-20`, `CMC-21`, `CMC-10` | D, G, H |
| `REQ-SCHED-01` | v0.1 сохраняет инертный schedule skeleton и честный disabled/manual-run fallback без host/system scheduler | [ADR-0014](../decisions/ADR-0014-defer-host-automation-post-v01.md) | `CMC-09`, `CMC-23`, `CMC-10` | G, H |
| `REQ-SCHED-POST-01` | Host-native create/update/pause/resume/delete lifecycle и scheduled prompt только после v0.1 | [ADR-0014](../decisions/ADR-0014-defer-host-automation-post-v01.md) | `CMC-13` | Post-v0.1 owner gate |
| `REQ-PUB-01` | Публичный bundle не содержит персональных решений, путей и app inventory разработчика | [Модель угроз](../safety/threat-model.md) | `CMC-03`, `CMC-04`, `CMC-09`, `CMC-10` | B, G, H |
| `REQ-REPO-01` | Публичный репозиторий имеет community files, pinned Actions, security settings и защищённый `main` | [Политика репозитория](../development/public-repository-policy.md) | `CMC-16`, `CMC-10` | B, H |
| `REQ-DEPS-01` | Runtime graph фиксирует точные проверенные разрешения `fast-uri@3.1.4` и `@hono/node-server@2.0.10`; production audit moderate остаётся зелёным | [Модель угроз](../safety/threat-model.md), [Политика репозитория](../development/public-repository-policy.md) | `CMC-44` | B, H |
| `REQ-UNINST-01` | Официальный uninstaller приоритетнее manual quarantine | [Публичный дизайн](../superpowers/specs/2026-07-17-public-plugin-contract-design.md) | `CMC-04`, `CMC-05`, `CMC-08`, `CMC-10` | C, D, G |
| `REQ-ADV-01` | System findings только read-only `unsupported_manual`; mutation ждёт Advanced Cleanup ADR | [ADR-0011](../decisions/ADR-0011-public-plugin-exclusions-scheduling.md) | `CMC-04`, `CMC-05`, `CMC-10`, `CMC-14` | C, D, H |
| `REQ-NOCLI-01` | Установка, аудит и решения без копирования shell-команд | [ADR-0010](../decisions/ADR-0010-field-research-safety-contract.md) | `CMC-08`, `CMC-09`, `CMC-10` | G, H |
| `REQ-DIST-01` | GitHub Releases и repository marketplace | [ADR-0007](../decisions/ADR-0007-github-distribution.md) | `CMC-09`, `CMC-10`, `CMC-37`, `CMC-39`, `CMC-41` | H |
| `REQ-REC-01` | Fault-injection recovery fail closed | [Модель угроз](../safety/threat-model.md) | `CMC-06`, `CMC-10` | E, H |

# Правило проверки

Issue и PR не могут объявить требование выполненным без ссылки на соответствующий automated output или явно незавершённый manual gate. Новый requirement получает ID, ссылку на канон, рабочий пакет и gate до начала реализации.

# GitHub-сопоставление

| ID | GitHub Issue | Текущий operational status |
|---|---|---|
| `CMC-01` | [#1 — Apache-2.0](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/1) | Закрыта |
| `CMC-02` | [#2 — workspace и platform guard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/2) | Закрыта |
| `CMC-03` | [#3 — contracts, store и MCP](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/3) | Закрыта |
| `CMC-04` | [#4 — source adapters](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/4) | Закрыта |
| `CMC-05` | [#5 — classifier и policy](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/5) | Закрыта |
| `CMC-06` | [#6 — quarantine transaction](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/6) | Закрыта |
| `CMC-07` | [#7 — restore и purge](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/7) | Закрыта |
| `CMC-08` | [#8 — Audit Dashboard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/8) | Закрыта |
| `CMC-09` | [#9 — MCP App и plugin](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/9) | Закрыта; schedule intent остаётся инертным skeleton v0.1 |
| `CMC-10` | [#10 — security и release evidence](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/10) | Закрыта |
| `CMC-11` | [#11 — публичный продуктовый контракт](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/11) | Закрыта |
| `CMC-12` | [#12 — постоянные исключения](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/12) | Закрыта |
| `CMC-13` | [#13 — ежемесячный read-only аудит](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/13) | `cto:blocked`, post-v0.1; ожидает `#10` и отдельное owner decision |
| `CMC-14` | [#14 — Advanced Cleanup v0.2](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/14) | `cto:blocked`, вне v0.1 и ждёт owner approval/ADR |
| `CMC-15` | [#15 — Browser и Developer Storage v0.2](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/15) | `cto:blocked`, вне v0.1 и ждёт owner approval/threat models |
| `CMC-16` | [#17 — защита публичного репозитория](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/17) | Закрыта |
| `CMC-17` | [#20 — generated artifacts workspace](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/20) | Закрыта |
| `CMC-18` | [#23 — lockfile scope CMC-03](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/23) | Закрыта |
| `CMC-19` | [#26 — lockfile scope очереди v0.1](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/26) | Закрыта |
| `CMC-20` | [#35 — server-owned correlation identity](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/35) | Закрыта |
| `CMC-21` | [#36 — core correlation/evidence resolver](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/36) | Закрыта |
| `CMC-22` | [#39 — actionable Library remnants](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/39) | Закрыта |
| `CMC-23` | [#41 — перенос automation после v0.1](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/41) | Закрыта |
| `CMC-24` | [#44 — запуск MCP из установленного плагина](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/44) | Закрыта |
| `CMC-25` | [#46 — выпуск v0.1.0-beta.2](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/46) | Закрыта |
| `CMC-26` | [#48 — живой прогресс и shared inventories](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/48) | Закрыта |
| `CMC-27` | [#50 — выпуск v0.1.0-beta.3](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/50) | Закрыта |
| `CMC-28` | [#52 — безопасное обновление плагина](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/52) | Закрыта |
| `CMC-29` | [#54 — выпуск v0.1.0-beta.4](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/54) | Закрыта |
| `CMC-30` | [#56 — упаковка и открытие Dashboard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/56) | Закрыта |
| `CMC-31` | [#58 — выпуск v0.1.0-beta.5](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/58) | Закрыта |
| `CMC-32` | [#60 — режимы отображения Dashboard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/60) | Закрыта |
| `CMC-33` | [#62 — тайм-аут больших аудитов](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/62) | Закрыта |
| `CMC-34` | [#64 — выпуск v0.1.0-beta.6](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/64) | Закрыта |
| `CMC-35` | [#66 — убрать режим мини-окна и добавить footer](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/66) | Закрыта |
| `CMC-36` | [#68 — восстановить полезный Real-Mac аудит](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/68) | Закрыта |
| `CMC-37` | [#70 — выпуск v0.1.0-beta.7](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/70) | Закрыта |
| `CMC-38` | [#72 — Base UI и понятные русские тексты](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/72) | Закрыта; PR #73 слит |
| `CMC-39` | [#74 — выпуск v0.1.0-beta.8](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/74) | Закрыта; PR #75 слит, выпуск опубликован |
| `CMC-40` | [#76 — понятные русские тексты](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/76) | Закрыта; PR #77 слит |
| `CMC-41` | [#78 — выпуск v0.1.0-beta.9](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/78) | Закрыта; PR #79 слит, выпуск опубликован |
| `CMC-42` | [#80 — убрать лишнюю анимацию и уточнить заголовок Dashboard](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/80) | Закрыта; PR #81 слит |
| `CMC-43` | [#82 — полный аудит без общего лимита времени](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/82) | `cto:review`; PR #83 |
| `CMC-44` | [#84 — устранить runtime-уязвимости зависимостей](https://github.com/stasdzzen/Codex-Mac-Cleaner/issues/84) | `cto:in-progress`; merge запрещён этой задачей |

Operational label не заменяет dependency validation. Источником текущего readiness остаётся GitHub и `issue_contract.py`.

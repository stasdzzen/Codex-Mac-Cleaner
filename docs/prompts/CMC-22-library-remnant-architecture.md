---
type: Worker Prompt
title: CMC-22 — actionable correlation для Library remnants
description: Docs-only промпт Архитектора для ADR-0013 и handoff существующей CMC-21.
tags: [prompt, architecture, correlation, library, remnants]
status: approved
owner: Architect
date: 2026-07-18
---

# Роль

Ты Архитектор ровно Issue CMC-22/#39. Измени только канон и производные docs/Issue specs. Runtime, PR #38, PR #34 и реальные данные Mac не меняй.

# Решение

Зафиксируй ADR-0013: cleanup `LibraryArtifactSubject` отделён от `OwnerApplicationSubject`; action authority создаёт только authoritative `remnant_of`. Добавь exact receipt payload, OS-owned individual-container metadata и installation-keyed historical signed process/open-file binding. Раздели artifact existence и owner executable, введи receipt lifecycle и profile-owned applicability.

Actionable v0.1 ограничен profile `private_regenerable_remnant_v1` для cache/log. Все остальные категории и name-only findings inspect-only. `not_applicable` не является `absent`, positive evidence всегда блокирует.

# Delivery

Обнови ADR/contracts/runtime/safety/quality/product docs, CMC-21 plan/prompt/spec, CMC-09 handoff и live Issue dependencies. Выполни repository validator, policy tests, local/live exact body comparison и diff checks. Открой один docs-only PR с `Closes #39`, передай независимому reviewer и не возобновляй CMC-21 до merge.

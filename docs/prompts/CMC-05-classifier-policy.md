---
type: Worker Prompt
title: Промпт CMC-05 — classifier и server policy
description: Готовый вход Worker для evidence normalization, named rules и fail-closed policy.
tags: [prompt, worker, policy, security, cmc-05]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker одной high-risk Issue CMC-05. Не делегируй, не работай над UI или quarantine transaction, не выполняй self-review, merge или release.

Прочитай AGENTS.md, docs/contracts/domain-model.md, docs/safety/safety-model.md, docs/safety/path-policy.md, docs/safety/threat-model.md, docs/quality/test-strategy.md и раздел CMC-05 плана. Dependency CMC-04 должна быть закрыта; валидируй Issue до изменений.

Реализуй deterministic evidence normalization, versioned named classifier rules и независимый server-only policy engine. Не используй LLM, скрытый score или UI state. Метка orphaned не даёт prepare_move сама по себе.

Preferences, Group Containers, databases, sync/VPN и personal files остаются analysis-only. Stale fingerprint, missing capability, active process, open file, symlink, hardlink anomaly, mount point, owner mismatch, cross-volume и protected path блокируют mutation. Mutation schemas не получают path или bypass flag.

Сначала golden, matrix и property-based tests; затем минимальная реализация. Выполни полный pnpm check. Открой один PR и передай русский отчёт с Issue/PR, SHA, фактическими tests и остаточными рисками. Собственный PR не принимай.
```

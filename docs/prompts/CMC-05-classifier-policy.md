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

Прочитай AGENTS.md, docs/contracts/domain-model.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/safety/safety-model.md, docs/safety/path-policy.md, docs/safety/threat-model.md, docs/quality/test-strategy.md и раздел CMC-05 плана. Dependency CMC-04 должна быть закрыта; валидируй Issue до изменений.

До любых package/runtime изменений запусти `corepack pnpm install --frozen-lockfile`, сохрани checksum `pnpm-lock.yaml` перед командой и подтверди, что frozen installation его не изменила; изменение lockfile на этом шаге — fail-closed blocker. Если реализация меняет package manifest, workspace dependency или pinned dependency, обнови `pnpm-lock.yaml` осознанно, обязательно включи требуемое изменение в PR этой же Issue, затем снова запусти `corepack pnpm install --frozen-lockfile` и подтверди неизменность уже подготовленного lockfile после проверки.

Реализуй deterministic evidence normalization, versioned named classifier rules, immutable Protected Scope Registry и независимый server-only policy engine. Не используй LLM, скрытый score или UI state. Метка orphaned не даёт prepare_move сама по себе, а совпадение имени без owner/installed/activity/receipt/dependency/temporal/data-kind evidence возвращает unknown или analysis-only.

Preferences, Group Containers, databases, sync/VPN, personal files и secret-like metadata остаются analysis-only. Universal system/credential/browser-profile/personal/project/plugin/Codex classes и любой локальный Git-проект защищены built-in server rules; персональные app/path rules отсутствуют. Совпавший `UserExclusion` и применимый official uninstaller блокируют preview; identity mismatch снова показывает finding. `unsupported_manual` имеет только inspect/exclude. Stale fingerprint, missing capability, active app/cache, open file, symlink, hardlink anomaly, mount point, owner mismatch, cross-volume и protected scope блокируют mutation стабильными rule/error codes. Mutation schemas не получают path или bypass flag.

Сначала golden, matrix и property-based tests; затем минимальная реализация. Выполни полный pnpm check. Открой один PR и передай русский отчёт с Issue/PR, SHA, фактическими tests и остаточными рисками. Собственный PR не принимай.
```

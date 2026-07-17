---
type: Worker Prompt
title: Промпт CMC-13 — ежемесячный read-only audit
description: Готовый вход Worker для capability-aware Codex automation bridge и schedule UI.
tags: [prompt, worker, scheduling, automation, cmc-13]
status: approved
owner: Architect
date: 2026-07-17
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-13. Реализуй только capability-aware schedule intent, Skill/host bridge, versioned local schedule state и вкладку «Расписание». Не создавай cron, LaunchAgent, system daemon, mutation flow, release или publication.

Прочитай AGENTS.md, ADR-0011, components, runtime flows, MCP contract, threat model, acceptance gates и раздел CMC-13 плана дополнений. CMC-09 должна быть закрыта; валидируй Issue.

Сначала tests: schedule disabled by default; explicit opt-in; одна automation без duplicate; повторный enable делает update; pause/resume/delete используют existing opaque ID; raw RRULE отсутствует; capability unavailable даёт disabled fallback; scheduled prompt только read-only, применяет exclusions и не содержит sudo/quarantine/purge/shell.

MCP App создаёт schedule_request intent и не вызывает host-native tool. Skill/host layer проверяет Codex automation capability, показывает подтверждение, выполняет host action и завершает intent через schedule_intent_complete. State хранится атомарно с 0600. UI показывает day/time, next/last run и честный capability state.

Запусти contract/storage/server/widget/plugin tests и pnpm check. Открой один PR. В отчёте укажи Issue/PR, SHA, capability path, fallback evidence и незавершённый real host smoke. Не выдавай mock capability за ручную проверку и не проверяй свой PR.
```

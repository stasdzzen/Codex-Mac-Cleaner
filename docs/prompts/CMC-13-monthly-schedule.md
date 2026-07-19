---
type: Worker Prompt
title: Промпт CMC-13 — post-v0.1 ежемесячный read-only audit
description: Заблокированный до owner decision вход Worker для post-v0.1 Codex automation bridge.
tags: [prompt, worker, scheduling, automation, cmc-13]
status: approved
owner: Architect
date: 2026-07-19
---

# Готовый промпт

```text
Ты Worker high-risk post-v0.1 Issue CMC-13. Не начинай работу, пока CMC-10/#10 не закрыта и владелец отдельно не решил открыть capability-релиз; до этого Issue обязана оставаться `cto:blocked`. После такого решения реализуй только capability-aware schedule intent, Skill/host bridge, versioned local schedule state и lifecycle вкладки «Расписание». Не создавай cron, LaunchAgent, system daemon, mutation flow, release или publication.

Прочитай AGENTS.md, ADR-0011, ADR-0014, components, runtime flows, MCP contract, threat model, acceptance gates и post-v0.1 раздел CMC-13 плана дополнений. CMC-10 должна быть закрыта, отдельное owner decision зафиксировано; валидируй Issue. Если любого gate нет, остановись без изменений.

Сначала tests: schedule disabled by default; explicit opt-in; одна automation без duplicate; повторный enable делает update; pause/resume/delete используют existing opaque ID; raw RRULE отсутствует; capability unavailable даёт disabled fallback; scheduled prompt только read-only, применяет exclusions и не содержит sudo/quarantine/purge/shell.

MCP App создаёт schedule_request intent и не вызывает host-native tool. Skill/host layer проверяет Codex automation capability, показывает подтверждение, выполняет host action и завершает intent через schedule_intent_complete. State хранится атомарно с 0600. UI показывает day/time, next/last run и честный capability state.

Запусти contract/storage/server/widget/plugin tests и pnpm check. Открой один PR. В отчёте укажи Issue/PR, SHA, owner decision, capability path, fallback evidence и незавершённый real host smoke. Не выдавай mock capability за ручную проверку и не проверяй свой PR.
```

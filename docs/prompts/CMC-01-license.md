---
type: Worker Prompt
title: Промпт CMC-01 — Apache-2.0
description: Готовый вход Worker для отдельной юридически защищённой Issue лицензии.
tags: [prompt, worker, license, cmc-01]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker в репозитории stasdzzen/Codex-Mac-Cleaner. Работай только по переданной GitHub Issue с ID CMC-01. Не запускай другие задачи, не делегируй работу, не выполняй self-review, merge, release или публикацию.

Сначала прочитай AGENTS.md, docs/development/execution-contract.md, docs/decisions/ADR-0008-apache-license.md, docs/quality/acceptance-gates.md и раздел CMC-01 в docs/superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md. Проверь Issue через codex-cto-orchestrator issue_contract.py.

Это protected legal action. Прямое разрешение владельца заменить MIT на Apache-2.0 получено 17 июля 2026 года и зафиксировано в live Issue #1. До изменений проверь, что эта запись присутствует в текущем теле Issue и Issue имеет label `cto:ready`. Если запись или label отсутствуют, остановись без изменений и отчитайся как blocked. Разрешение относится только к CMC-01 и не даёт полномочий на merge, publication или release.

При наличии разрешения замени LICENSE точным официальным текстом Apache-2.0, синхронизируй только раздел лицензии README и не создавай пустой NOTICE. Не добавляй runtime-код и не меняй другие ADR.

Выполни проверки и commit из плана. Открой один PR. Отчёт напиши по-русски: Issue/PR, ветка, head SHA, изменённые файлы, команды с результатами, статус legal permission и незавершённые gates. Не помечай merge или release выполненными.
```

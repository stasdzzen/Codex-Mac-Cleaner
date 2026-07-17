---
type: Worker Prompt
title: Промпт CMC-10 — security и release evidence
description: Готовый вход Worker для финальных автоматических проверок и воспроизводимого release package.
tags: [prompt, worker, security, release, cmc-10]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-10. Подготовь security/privacy tests, CI, deterministic packaging и release evidence. Не создавай tag, GitHub Release, публикацию, deploy или credentials. Эти действия требуют отдельной команды владельца после review.

Прочитай AGENTS.md, docs/safety/threat-model.md, docs/quality/test-strategy.md, docs/quality/acceptance-gates.md, docs/product/release-checklist.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md и оба implementation plans. Dependency CMC-13 должна быть закрыта; валидируй Issue.

Покрой утечки path/secret-like config, public-bundle personalization, command injection, prompt-like filenames, universal protected scopes, symlink/mount/race cases, manifest/exclusion/schedule corruption, model/app visibility и supply-chain file list. Докажи: credential/browser-profile/personal/current-project/plugin/Codex/Git scopes не дают preview; excluded finding не мутируется; identity mismatch снова видим; migrations работают; official uninstaller имеет приоритет; protected metadata/TCC не вызывают bypass; `unsupported_manual` без shell/`sudo`; «Пропустить сейчас» без tool; schedule read-only, singleton и поддерживает update/pause/resume/delete/fallback. Package не содержит username, home paths, personal app names/decisions или real-Mac inventory.

Добавь clean-room harness: установка из repository/personal marketplace, запуск новой задачи Codex, audit/Dashboard и button-only delete/exclude/skip/restore/purge без копирования команды или сообщения «готово». Покрой persistent exclusion после restart и schedule capability либо честный fallback. Создай real-Mac smoke protocol, но не отмечай его выполненным. Manual real-Mac smoke остаётся owner gate до фактического запуска на release SHA.

Выполни автоматические команды плана и pnpm check. Открой PR. Русский отчёт должен указать Issue/PR, branch/head SHA, каждый command/result, generated evidence и все незавершённые manual/owner gates. Не выполняй self-review, merge или release.
```

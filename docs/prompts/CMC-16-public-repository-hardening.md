---
type: Worker Prompt
title: Промпт CMC-16 — защита публичного репозитория
description: Готовый вход Worker для community-файлов, repository gate и GitHub protections.
tags: [prompt, worker, github, security, governance, cmc-16]
status: approved
owner: Architect
date: 2026-07-17
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-16 в репозитории stasdzzen/Codex-Mac-Cleaner. Работай только в назначенном worktree и не реализуй runtime очистителя, license change, release, tag или публикацию.

Сначала прочитай AGENTS.md, docs/development/execution-contract.md, docs/development/public-repository-policy.md, docs/safety/safety-model.md и live Issue. Сопоставь GitHub settings с проверенным open-source baseline, но не переноси чужие Python/package/release gates: этот репозиторий пока docs-first.

Добавь community-файлы, Issue Forms, PR template, Dependabot, pinned GitHub-owned workflow, stdlib repository validator и unit tests. Validator должен проверять OKF, внутренние ссылки, двуязычные Issue contracts, безопасные touched paths, workflow SHA pinning, чувствительные tracked files и public privacy boundary.

После GREEN открой один PR. GitHub settings применяй только после merge workflow и успешного check на main: squash-only, update branch, auto-delete branches, selected GitHub-owned Actions с обязательным SHA, Dependabot alerts/security updates, PVR, CodeQL default setup при поддержке, main ruleset и release-tag ruleset без bypass.

Отчёт: Issue/PR, branch/head/merge SHA, локальные команды, GitHub check, community profile, rulesets, Actions/security settings, открытые риски и следующий dependency gate. Не заявляй setting включённым без живого API evidence.
```

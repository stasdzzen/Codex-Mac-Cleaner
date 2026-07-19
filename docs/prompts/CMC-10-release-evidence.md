---
type: Worker Prompt
title: Промпт CMC-10 — security и release evidence
description: Готовый вход Worker для финальных автоматических проверок и воспроизводимого release package.
tags: [prompt, worker, security, release, cmc-10]
status: approved
owner: Architect
date: 2026-07-19
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-10. Подготовь security/privacy tests, CI, deterministic packaging и release evidence. Не создавай tag, GitHub Release, публикацию, deploy или credentials. Эти действия требуют отдельной команды владельца после review.

Прочитай AGENTS.md, docs/safety/threat-model.md, docs/quality/test-strategy.md, docs/quality/acceptance-gates.md, docs/product/release-checklist.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0011-public-plugin-exclusions-scheduling.md, docs/decisions/ADR-0013-actionable-library-remnant-correlation.md, docs/decisions/ADR-0014-defer-host-automation-post-v01.md и применимые implementation plans. Dependency CMC-23/#41 должна быть закрыта; CMC-13 не является dependency v0.1. Валидируй Issue.

Покрой утечки path/secret-like config, public-bundle personalization, command injection, prompt-like filenames, universal protected scopes, symlink/mount/race cases, manifest/exclusion и инертного schedule state, model/app visibility и supply-chain file list. Докажи: credential/browser-profile/personal/current-project/plugin/Codex/Git scopes не дают preview; owner binding нельзя получить из path/name/bundle-only hint или user attestation; client profile/applicability отклоняются; `not_applicable` не скрывает positive evidence; production-adapter user-Library cache/log проходит actionable flow, а остальные Library categories inspect-only; excluded finding не мутируется; identity mismatch снова видим; migrations работают; official uninstaller имеет приоритет; protected metadata/TCC не вызывают bypass; `unsupported_manual` без shell/`sudo`; «Пропустить сейчас» без tool; вкладка «Расписание» честно disabled, manual run использует обычный read-only audit, host automation/ID/opt-in/lifecycle/next-last run, cron и LaunchAgent отсутствуют. Package не содержит username, home paths, personal app names/decisions, historical bindings или real-Mac inventory.

Для каждого обнаруженного дефекта сначала добавь падающий regression test, который доказывает нарушение gate, и только затем внеси минимальный hardening fix в разрешённых Issue paths. Это правило явно включает деактивацию успешного `completed` schedule outcome, сохранения automation ID и lifecycle-переходов v0.1. Не добавляй новые функции, cleanup-категории, lifecycle-возможности или несвязанные refactors; отсутствие падающего теста означает отсутствие полномочий менять runtime.

Добавь clean-room harness: установка из repository/personal marketplace, запуск новой задачи Codex, audit/Dashboard и button-only quarantine/exclude/skip/restore/purge без копирования команды или сообщения «готово». Покрой persistent exclusion после restart и честный disabled/manual-run schedule fallback без host/system side effects. Создай real-Mac smoke protocol, но не отмечай его выполненным. Manual real-Mac smoke остаётся owner gate до фактического запуска на release SHA.

Выполни автоматические команды плана и pnpm check. Открой PR. Русский отчёт должен указать Issue/PR, branch/head SHA, каждый command/result, regression evidence, минимальные hardening fixes и все незавершённые manual/owner gates. Не выполняй self-review, merge или release.
```

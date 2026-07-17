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

Прочитай AGENTS.md, docs/safety/threat-model.md, docs/quality/test-strategy.md, docs/quality/acceptance-gates.md, docs/product/release-checklist.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/decisions/ADR-0010-field-research-safety-contract.md и CMC-10 плана. Dependency CMC-09 должна быть закрыта; валидируй Issue.

Покрой утечки path/secret-like config, command injection, prompt-like filenames, protected scopes, symlink/mount/race cases, manifest corruption, model/app visibility и supply-chain file list. Synthetic field E2E доказывает remnants/personal/system cases без реальных данных владельца. Отдельно докажи: `~/APPS`, `~/.codex`, protected owner и Git project не дают mutation preview; SafeMetadata не сохраняет raw values; `unsupported_manual` не содержит shell/sudo; отменённый отчёт без actions; purge metrics и DiskObservation не образуют причинный APFS delta; bulk отсутствует; «Оставить» не вызывает tool. CI не выполняет release mutation. Package содержит только production files и создаёт checksum, SBOM и provenance inputs.

Добавь clean-room harness: установка из repository/personal marketplace, запуск новой задачи Codex, автоматический audit/Dashboard и button-only leave/move/restore/purge без копирования команды или сообщения «готово». Создай real-Mac smoke protocol с protected-root, redaction, отменой, partial report, пятью показателями и поэлементными actions, но не отмечай его выполненным. Manual real-Mac smoke остаётся owner gate до фактического запуска на release SHA.

Выполни автоматические команды плана и pnpm check. Открой PR. Русский отчёт должен указать Issue/PR, branch/head SHA, каждый command/result, generated evidence и все незавершённые manual/owner gates. Не выполняй self-review, merge или release.
```

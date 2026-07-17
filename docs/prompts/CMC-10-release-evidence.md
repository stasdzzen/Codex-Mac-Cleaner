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

Прочитай AGENTS.md, docs/safety/threat-model.md, docs/quality/test-strategy.md, docs/quality/acceptance-gates.md, docs/product/release-checklist.md, docs/decisions/ADR-0007-github-distribution.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md и CMC-10 плана. Dependency CMC-09 должна быть закрыта; валидируй Issue.

Покрой утечки path, command injection, prompt-like filenames, symlink/mount/race cases, manifest corruption, model/app visibility и supply-chain file list. Отдельно докажи: отменённый частичный отчёт имеет пустые `allowedActions`; гонка отмены с terminal state идемпотентна; успешный purge обновляет journal-derived `purgedPhysicalBytes`; неуспешный purge не меняет запись и `StorageSummary`; bulk purge отсутствует; UI не называет метрику точным изменением свободного места APFS. CI не выполняет release mutation. Package содержит только production server/widget/manifests/Skill/README/LICENSE и создаёт checksum, SBOM и provenance inputs.

Создай real-Mac smoke protocol с отдельными шагами отмены аудита, просмотра частичного отчёта, restore, успешного purge и ошибки purge, но не отмечай его выполненным. Clean-room install и real-Mac smoke остаются manual gates до фактического запуска на release SHA.

Выполни автоматические команды плана и pnpm check. Открой PR. Русский отчёт должен указать Issue/PR, branch/head SHA, каждый command/result, generated evidence и все незавершённые manual/owner gates. Не выполняй self-review, merge или release.
```

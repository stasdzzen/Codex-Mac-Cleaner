---
type: Worker Prompt
title: Промпт CMC-19 — синхронизация lockfile scope очереди v0.1
description: Готовый вход Worker для согласования CMC-04/05/06/08/09 с обязательным корневым pnpm lockfile.
tags: [prompt, worker, governance, lockfile, cmc-19]
status: approved
owner: Architect
date: 2026-07-18
---

# Готовый промпт

```text
Ты Worker ровно одной GitHub Issue CMC-19 / #26 в stasdzzen/Codex-Mac-Cleaner. Соблюдай identity: Issue #26 = эта задача Codex = текущий managed worktree = одна ветка = один ready-for-review PR. Не запускай другие задачи, не координируй другие Issues, не проверяй и не принимай собственный PR, не выполняй merge, release, tag или публикацию.

До редактирования полностью прочитай AGENTS.md, docs/index.md, docs/development/execution-contract.md, live Issue #26, docs/product/implementation-roadmap.md, docs/superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md, локальные specs CMC-04/05/06/08/09 и их пять Worker-промптов. Проверь чистый `origin/main` на ожидаемом base SHA `a17fd32996569576f9fc0c97430e6a92b72d1030`; при сдвиге остановись. Подтверди, что dependency #3 закрыта, #26 имеет `cto:in-progress`, а другой ветки, worktree или PR для CMC-19 нет. Создай только ветку `codex/issue-26-cmc19-lockfile-queue`.

Работай только с touched paths live Issue #26: `.github/issue-specs/CMC-04.md`, `.github/issue-specs/CMC-05.md`, `.github/issue-specs/CMC-06.md`, `.github/issue-specs/CMC-08.md`, `.github/issue-specs/CMC-09.md`, `.github/issue-specs/CMC-19.md`, `docs/product/implementation-roadmap.md`, `docs/prompts/CMC-04-adapters.md`, `docs/prompts/CMC-05-classifier-policy.md`, `docs/prompts/CMC-06-quarantine.md`, `docs/prompts/CMC-08-dashboard.md`, `docs/prompts/CMC-09-plugin-integration.md`, `docs/prompts/CMC-19-lockfile-queue.md`, `docs/prompts/index.md`, `docs/log.md`. Runtime, package manifests, lockfile, config, ADR, safety docs и workflows не меняй.

До правок зафиксируй RED: утверждённый план явно выполняет `git add` с `pnpm-lock.yaml` для CMC-04, CMC-05, CMC-06, CMC-08 и CMC-09; текущие touched paths этих Issues lockfile не разрешают; их Worker-промпты не закрепляют frozen-install gate.

Создай полное двуязычное зеркало live Issue #26 в `.github/issue-specs/CMC-19.md`. В specs CMC-04/05/06/08/09 сохрани все runtime paths и safety-ограничения, добавив только корневой `pnpm-lock.yaml`; в CMC-04 сохрани dependency #3 и добавь #26, а dependencies CMC-05/06/08/09 не меняй. В пять Worker-промптов добавь обязательный `corepack pnpm install --frozen-lockfile`, checksum-проверку неизменности lockfile после frozen installation и обязанность включить требуемое изменение lockfile в PR той же Issue. В roadmap вставь CMC-19 после CMC-03 с dependency CMC-03 и перед CMC-04, синхронизируй критический путь `CMC-03 → CMC-19 → CMC-04`, не меняя остальные identities. Добавь CMC-19 / GitHub #26 в индекс промптов и запись от 2026-07-18 в `docs/log.md`. Live Issues #4/#5/#6/#8/#9 не редактируй: это post-merge gate Controller.

На одном неизменном финальном head SHA запусти `python3 .github/scripts/validate_repository.py`, `python3 -m unittest discover -s tests -p 'test_repository_policy.py' -v` и `git diff --check`. Отдельно сравни `git diff --name-only origin/main...HEAD` с точным touched_paths #26 и подтверди отсутствие изменений `pnpm-lock.yaml`, package manifests, runtime, `.codex/cto.yaml`, ADR и safety docs.

Открой один ready-for-review PR с `Closes #26`. В русском PR укажи Issue, ветку, base/head SHA, RED evidence, точные проверки и post-merge Controller gate синхронизации live Issues #4/#5/#6/#8/#9. Переведи #26 из `cto:in-progress` в `cto:review` и остановись. Security scan не запускай: для CMC-19 это только release gate.
```

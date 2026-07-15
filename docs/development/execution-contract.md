---
type: Execution Contract
title: Контракт выполнения задач Codex
description: Правила связи GitHub Issue, задачи Codex, worktree, ветки, PR и доказательств.
tags: [development, cto, issues, workflow]
status: approved
owner: Architect
date: 2026-07-15
---

# Контракт выполнения задач Codex

Одна Issue = одна задача Codex = один управляемый worktree = одна фактическая ветка, ведущая к PR = один PR. До создания ветки допустим `detached HEAD`.

До запуска Issue должна содержать один машиночитаемый блок:

```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: src/; tests/
risk: low
parallel_safety: safe
execution_profile: fast
```

Ссылки на Issue имеют вид `#123` или `none`. Пути указываются относительно репозитория, без `..` и wildcard. High-risk, shared, migration, security, release и deploy работы выполняются последовательно; профиль `fast` для high-risk запрещён.

Readiness проверяется без изменений командой `issue_contract.py --issue <number> --repository <owner/repository> --config .codex/cto.yaml --repo-root . --json`. Issues-mode использует только labels из конфигурации. Project-mode использует только настроенное поле Project Status и не подменяет его labels.

Beta.6 validator требует пять канонических секций на английском и полное русское зеркало. Английская часть существует только ради машинного контракта; заголовок, рабочая коммуникация и отчёт остаются русскими.

1. Прочитать и валидировать Issue, `AGENTS.md` и канон; проверить base.
2. Не расширять scope и не выполнять merge, deploy или release.
3. Не запускать другие задачи Codex и не координировать другие Issues.
4. Не проверять и не принимать собственный PR; передать его независимому reviewer или Controller.
5. Выполнить acceptance criteria и проверки на финальном head SHA.
6. Открыть или обновить PR и приложить доказательства.

## Отчёт Worker

Указать Issue/PR, ветку/SHA, изменения, команды с результатами и незавершённые gates.

Не выдавать планы или ожидание ручной проверки за завершённую работу.

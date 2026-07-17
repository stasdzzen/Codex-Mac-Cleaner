---
type: Execution Contract
title: Политика публичного репозитория
description: Community-файлы, GitHub Actions, security settings, rulesets и merge-порядок Codex Mac Cleaner.
tags: [development, github, security, governance, open-source]
status: approved
owner: Architect
date: 2026-07-17
---

# Назначение

Публичный репозиторий — часть security boundary продукта. Эта политика фиксирует
проверяемые настройки GitHub и обязательные файлы, но не даёт полномочий на
release, tag, публикацию плагина или обход safety-инвариантов.

# Community и disclosure

В корне находятся `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`,
`CODE_OF_CONDUCT.md` и `LICENSE`. Каталог `.github/` содержит Issue Forms и PR
template. Blank Issues выключены. Публичные ошибки и предложения разделены;
уязвимости направляются только через GitHub Private vulnerability reporting.

Issue Forms и документация запрещают secrets, реальные полные домашние пути,
app inventory, персональные данные и полные environment dumps. Публичный SLA не
обещается.

# Repository gate

Workflow `.github/workflows/repository.yml` запускается для каждого PR и push в
`main`. Обязательный check называется `Контракты публичного репозитория` и
проверяет:

* обязательные community и policy files;
* OKF frontmatter, таксономию, внутренние ссылки и fenced blocks;
* двуязычные `cto-issue` contracts и безопасные touched paths;
* отсутствие реальных домашних путей и secret-like значений;
* запрет чувствительных tracked files и symlinks;
* явные workflow permissions;
* только GitHub-owned Actions, закреплённые полным commit SHA;
* unit tests repository policy и whitespace diff.

Repository validator использует только Python standard library и не является
runtime-зависимостью плагина.

# Merge policy

GitHub ruleset `Защита main` применяется к default branch и `refs/heads/main`:

* изменения проходят только через Pull Request;
* разрешён только squash merge;
* review threads должны быть закрыты;
* required check строгий: ветка должна быть актуальна относительно `main`;
* история линейна;
* deletion и non-fast-forward updates запрещены;
* bypass actors отсутствуют.

Для solo-owner репозитория required approving review count равен `0`: GitHub не
разрешает автору одобрить собственный PR. Это не отменяет проверку evidence на
текущем head SHA и явное owner approval перед merge.

Репозиторий использует squash-only merge, разрешает update branch и удаляет
head branch после merge. Merge commits и rebase merge выключены.

# Actions и supply chain

В репозитории разрешены только GitHub-owned Actions. Каждый внешний `uses:`
закрепляется полным 40-символьным commit SHA. Default token permissions —
`read`; workflow повышает отдельное permission только при доказанной
необходимости. `pull_request_target`, `write-all` и `secrets: inherit` запрещены
repository validator.

Dependabot проверяет GitHub Actions ежемесячно. После появления package manager
его ecosystem добавляется отдельным PR вместе с lockfile и канонической командой
проверки.

# Security settings

Для публичного репозитория включены:

* Dependabot alerts и security updates;
* secret scanning и push protection;
* Private vulnerability reporting;
* CodeQL default setup для поддержанных языков repository tooling и runtime.

CodeQL не заменяет contract, policy, quarantine и clean-room tests. Отсутствие
поддержанного языка считается честным capability state, а не поводом добавлять
фиктивный runtime.

# Release tags

Ruleset `Защита релизных тегов` применяется к `refs/tags/v*` и запрещает update
и deletion без bypass. Создание tag, GitHub Release, notarization и публикация
плагина остаются отдельными owner-only gates из release checklist.

# Проверка drift

После изменения GitHub settings владелец или назначенный Controller сравнивает
live API с этим документом: repository merge settings, Actions permissions,
security features, community profile, rulesets и required check. Planned
настройка не считается включённой до такого подтверждения.

# Источники

1. [Доступные правила GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
2. [Private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
3. [Code scanning default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning)

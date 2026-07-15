# AGENTS.md

## Язык

* Всегда отвечай на русском языке.
* Документацию, commit messages, PR title/body, review comments, GitHub comments и merge messages пиши на русском языке.
* Английская часть GitHub Issue допускается только как обязательное машинное зеркало формата `codex-cto-orchestrator`; русская часть остаётся полной и основной для человека.

## Канон и роли

* Перед работой прочитай `docs/index.md`, применимые архитектурные документы и `docs/development/execution-contract.md`.
* Архитектурный канон меняет только Архитектор через ADR.
* Product-документы, промпты и Issues не могут ослаблять safety-инварианты.
* Не начинай реализацию без валидной GitHub Issue.

<!-- codex-cto-orchestrator:start -->
## CTO orchestration

Для процесса GitHub/Codex/PR используй `$codex-cto-orchestrator`; конфигурация: `.codex/cto.yaml`.
Одна Issue = одна задача Codex = один управляемый worktree = одна ветка, ведущая к одному Pull Request.
Наличие навыка не активирует Controller. Controller требует явного вызова в отдельно назначенной постоянной задаче; Архитектор и Worker не получают его полномочий.
<!-- codex-cto-orchestrator:end -->

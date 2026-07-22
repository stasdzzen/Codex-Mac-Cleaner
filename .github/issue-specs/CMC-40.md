```cto-issue
schema: 1
dependencies: #74
conflicts: none
touched_paths: .github/issue-specs/; .github/ISSUE_TEMPLATE/; .github/pull_request_template.md; .codex-plugin/; apps/widget/src/; apps/widget/test/; apps/mcp-server/src/; apps/mcp-server/test/; skills/; tests/plugin/; README.md; CONTRIBUTING.md; SECURITY.md; SUPPORT.md; CODE_OF_CONDUCT.md; docs/release/v0.1.0-beta.8.md; docs/product/requirements-traceability.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Make every public user-facing Codex Mac Cleaner surface clear Russian for a non-technical Mac user while preserving exact commands, product names and machine schema values required by Codex and GitHub.

### Scope

Review and rewrite the Dashboard copy, plugin metadata, skills, README, current release notes, public community documents, GitHub issue forms and pull request template. Replace internal jargon and avoid unexplained English words. Add focused tests that keep plugin metadata, primary Dashboard actions and beginner documentation in Russian. Rebuild the checked-in plugin Dashboard.

### Acceptance criteria

The plugin card has Russian author/developer metadata and Russian descriptions. Dashboard headings, actions, confirmations, errors and empty states use one consistent plain-Russian glossary. README explains purpose, requirements, installation, launch, update, safety and limitations without unexplained English jargon outside exact commands or technology names. Public GitHub forms and community documents use Russian labels and explanations. The repository About description and the published beta.8 release body are Russian and understandable. Machine enum values, code identifiers, URLs, commands and proper technology names remain unchanged where required.

### Verification

Run root pnpm check, plugin/security suites, widget and MCP/plugin builds, deterministic package verification, repository validators and diff checks. Add focused Russian-copy assertions for user-visible metadata and key flows. Require all PR checks and CodeQL green before merge.

### Constraints

Do not change safety policy, classifier decisions, tool schemas, mutation authority, package version or release tag. Do not edit or reinstall the owner's plugin. Do not run a real Mac audit or cleanup. Do not translate machine enum values, code identifiers, exact commands, URLs, product names or required GitHub/Codex schema fields.

## Русский

### Цель

Сделать все публичные тексты Codex Mac Cleaner понятными обычному владельцу Mac: без необъяснённых английских слов, внутренних кодов и профессионального жаргона. Точные команды, названия продуктов и обязательные значения схем Codex/GitHub сохраняются.

### Объём

Проверить и переписать тексты интерфейса, карточки плагина, навыков, README, текущих заметок о выпуске, публичных документов сообщества, форм GitHub и шаблона запроса на слияние. Зафиксировать единый простой словарь интерфейса. Добавить тесты русских текстов и пересобрать отслеживаемый интерфейс плагина.

### Критерии приёмки

В карточке плагина имя автора/разработчика и описания написаны по-русски. Заголовки, действия, подтверждения, ошибки и пустые состояния интерфейса используют один понятный словарь. README без необъяснённых англицизмов рассказывает, что делает плагин, что требуется для установки, как установить, запустить и обновить его, как работает безопасность и какие есть ограничения. Публичные формы и документы GitHub используют русские подписи и объяснения. Описание репозитория и текст опубликованного выпуска beta.8 понятны по-русски. Машинные значения, идентификаторы кода, адреса, точные команды и названия технологий не переводятся там, где это сломает контракт.

### Проверка

Запустить `pnpm check`, наборы plugin/security, сборки widget и MCP/plugin, проверку детерминированного пакета, валидаторы репозитория и проверки diff. Добавить отдельные проверки русских пользовательских текстов. Перед слиянием дождаться зелёных GitHub checks и CodeQL.

### Ограничения

Не менять правила безопасности, решения классификатора, схемы инструментов, полномочия на изменение файлов, версию пакета и релизный тег. Не изменять и не переустанавливать плагин владельца. Не запускать реальную проверку или очистку Mac. Не переводить машинные значения схем, идентификаторы кода, точные команды, адреса, названия продуктов и обязательные поля Codex/GitHub.

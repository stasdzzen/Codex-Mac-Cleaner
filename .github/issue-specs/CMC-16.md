```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: README.md; CODE_OF_CONDUCT.md; CONTRIBUTING.md; SECURITY.md; SUPPORT.md; .github/; tests/; docs/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Bring the public repository to a verified open-source community, contribution,
CI and GitHub protection baseline without changing product runtime or release
scope.

### Scope

Add repository community files, issue forms, PR template, GitHub Actions Dependabot configuration, a pinned repository-contract workflow and its validator; document the public-repository policy and Worker prompt. Configure repository description/topics, squash-only merge, update-branch and branch auto-delete, selected GitHub-owned Actions with full-SHA pinning, Dependabot alerts/security updates, private vulnerability reporting, CodeQL default setup when supported, an active main ruleset and immutable release-tag ruleset.

### Acceptance criteria

Community profile reaches 100%. Public support and private vulnerability channels are explicit. The repository gate validates required files, OKF structure, internal links, Issue contracts, workflow action pinning and public privacy rules. Main changes require a PR, resolved review threads, strict required status check, linear history and squash merge; deletion and non-fast-forward updates are blocked with no bypass. Release tags cannot be updated or deleted. Only GitHub-owned Actions pinned to full commit SHAs are allowed. Dependabot, secret scanning, push protection and private vulnerability reporting are enabled. Settings are verified from live GitHub APIs. Runtime, license decision, tag and release remain unchanged.

### Verification

Run the repository validator, its unit tests, OKF/link/privacy checks and `git diff --check` on the final head SHA. Require the GitHub workflow to pass. After merge compare live repository, ruleset, Actions, security, community-profile and branch settings with the documented contract.

### Constraints

Do not implement cleaner runtime, change the MIT-to-Apache legal gate, create a release/tag, publish the plugin, add secrets, copy personal data, weaken safety invariants or bypass protections. Apply repository settings only after the repository workflow exists and passes.

## Русский

### Цель

Довести публичный репозиторий до проверенного open-source уровня community,
contribution, CI и GitHub-защиты без изменения runtime продукта и release
scope.

### Объём

Добавить community-файлы, Issue Forms, PR template, Dependabot для GitHub Actions, workflow с полным SHA pinning и валидатором контрактов репозитория; описать политику публичного репозитория и Worker-промпт. Настроить description/topics, squash-only merge, update branch и автоудаление веток, только GitHub-owned Actions с обязательным полным SHA, Dependabot alerts/security updates, private vulnerability reporting, CodeQL default setup при поддержке, активный ruleset для main и неизменяемые release tags.

### Критерии приёмки

Community profile достигает 100%. Публичный support и закрытый канал уязвимостей описаны явно. Repository gate проверяет обязательные файлы, OKF, внутренние ссылки, Issue-контракты, SHA pinning Actions и public privacy rules. Изменения main требуют PR, закрытых review threads, строгого обязательного check, linear history и squash merge; удаление и non-fast-forward запрещены без bypass. Release tags нельзя обновлять или удалять. Разрешены только GitHub-owned Actions с полным SHA. Dependabot, secret scanning, push protection и private vulnerability reporting включены. Настройки подтверждены живыми GitHub API. Runtime, лицензия, tag и release не меняются.

### Проверка

Запустить repository validator, unit tests, OKF/link/privacy checks и `git diff --check` на финальном head SHA. Дождаться успешного GitHub workflow. После merge сопоставить живые repository, ruleset, Actions, security, community profile и branch settings с документированным контрактом.

### Ограничения

Не реализовывать runtime очистителя, не менять юридический gate MIT → Apache, не создавать release/tag, не публиковать плагин, не добавлять secrets и персональные данные, не ослаблять safety-инварианты и не обходить защиты. GitHub settings применять только после появления и успешного выполнения repository workflow.

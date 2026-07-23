```cto-issue
schema: 1
dependencies: #78
conflicts: none
touched_paths: .github/issue-specs/; apps/widget/src/styles.css; apps/widget/test/dashboard.test.tsx; tests/plugin/dashboard-theme.test.ts; .codex-plugin/assets/dashboard-v2.html; docs/product/requirements-traceability.md
risk: low
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Remove the distracting sweeping highlight from the Audit Dashboard progress bar while preserving accurate live progress and accessibility.

### Scope

Delete the custom audit-scan pseudo-element and keyframes from the widget stylesheet. Keep the standard shadcn/Base UI Progress component, its static fill, numeric percentage, live server-owned updates and explicit in-flight action indicators. Add focused regression coverage, rebuild the checked-in Dashboard bundle and update traceability.

### Acceptance criteria

No animated highlight sweeps across the audit progress bar in any audit state. The progress bar still shows the server-owned completion value and remains accessible through its progressbar role and Russian aria-label. Active and terminal audit states remain distinguishable without the removed sweep. Focused source and bundle tests prevent audit-scan from returning.

### Verification

Run widget tests and build, plugin Dashboard tests, bundle freshness, root pnpm check, repository policy checks and git diff checks. Require all Pull Request checks and CodeQL green before merge.

### Constraints

Do not change audit runtime, polling, progress calculation, safety policy, mutation tools, package version, release tag or the owner-installed plugin. Do not run a real Mac audit or cleanup. Do not remove short loading indicators that communicate an explicit pending user action.

## Русский

### Цель

Убрать раздражающую бегущую светлую полосу с индикатора проверки, сохранив точный живой прогресс и доступность интерфейса.

### Объём

Удалить из стилей пользовательский псевдоэлемент и анимацию `audit-scan`. Оставить стандартный компонент Progress из shadcn/Base UI, статическое заполнение по проценту, числовое значение, обновление данными сервера и короткие индикаторы явно выполняемых действий. Добавить защитные тесты, пересобрать отслеживаемый Dashboard и обновить трассировку.

### Критерии приёмки

Бегущая светлая полоса не появляется ни в одном состоянии проверки. Индикатор продолжает показывать полученный от сервера процент и доступен как progressbar с русской подписью. Активное и завершённое состояния остаются понятными без удалённого эффекта. Тесты исходников и собранного интерфейса не позволяют вернуть `audit-scan`.

### Проверка

Запустить тесты и сборку widget, проверки Dashboard и свежести bundle, корневой `pnpm check`, проверки политики репозитория и `git diff --check`. Перед слиянием дождаться зелёных проверок Pull Request и CodeQL.

### Ограничения

Не менять runtime аудита, polling, расчёт прогресса, правила безопасности, mutation-tools, версию пакета, релизный тег и установленный владельцем плагин. Не запускать реальную проверку или очистку Mac. Не удалять короткие индикаторы, которые показывают выполнение явно нажатого пользователем действия.

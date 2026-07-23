```cto-issue
schema: 1
dependencies: #70
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/mcp-server/src/resources/; apps/mcp-server/test/; apps/widget/; assets/; README.md; docs/architecture/components.md; docs/product/requirements-traceability.md; scripts/; skills/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Migrate the shadcn Audit Dashboard from Radix to Base UI with the owner-provided preset theme, make its adaptive composition compact, and replace user-facing technical jargon with clear Russian copy without changing product or safety behavior.

### Scope

Keep Vite, Tailwind v4 and shadcn, but migrate every installed shadcn wrapper and consumer from `radix-nova`/`radix-ui` to the Base UI equivalents from the owner-selected preset `b1a0RuLKa`. Generate the preset only in a temporary reference project; do not run `shadcn init` over the repository. Use canonical Base UI shadcn composition for Card, Progress, Table, Badge, Sheet, Alert, AlertDialog, Skeleton, Tabs, Tooltip, Button, Separator and sonner, preserving intentional local behavior. Replace the semantic theme with the exact owner-supplied OKLCH light/dark values. Remove the abandoned external design exploration and do not import its generated HTML or styles. Preserve the local font stack, brand icon, storage comparison and reduced-motion behavior. Make the overview compact and adaptive for the Codex side surface and fullscreen. Translate and simplify all user-facing Dashboard, plugin metadata, Skill and README text in Russian; map internal enum and policy codes to understandable labels instead of exposing implementation jargon. Update the public repository description to a short Russian explanation after the PR is merged. Rebuild the autonomous Dashboard asset and synchronize focused tests and requirements traceability.

### Acceptance criteria

The Dashboard is an autonomous dark-first shadcn application on Base UI. `components.json` reports a `base-*` style, `@base-ui/react` is installed, and no widget source, consumer or dependency retains `radix-ui` or `@radix-ui` references. The supplied `:root` and `.dark` values are exact, while Tailwind namespaces and semantic mappings remain valid. There is no CDN, external font request, telemetry, unrelated runtime dependency, raw component color or manual dark override. Abandoned external design files and requirements are absent. Cards use full shadcn composition; destructive actions use AlertDialog; evidence uses Sheet; progress, alerts, tabs, table, badges, tooltips and toasts use the installed primitives. The narrow Codex surface stays single-column and readable; fullscreen uses a bounded responsive grid without duplicating content or changing DOM action order. Every user-visible title, label, status, error, confirmation, plugin description, starter prompt and README explanation is Russian and understandable without internal product terms. Internal identifiers remain only in tool payloads, tests and developer-only code. Known enum, evidence, risk, state and policy values are presented through Russian labels; unknown internal codes fail to a safe generic Russian explanation. Storage values remain decimal MB/GB, separate non-additive snapshots and never claim exact APFS free-space gain. Existing audit, fullscreen, footer, findings, quarantine, exclusions and manual schedule behavior remains unchanged. No MCP schema, bridge contract, audit logic, safety policy or mutation authority changes.

### Verification

Run shadcn project info and official component guidance for the used primitives; widget typecheck, tests and build; focused copy, adaptive composition, theme, branding, storage, motion and reduced-motion tests; plugin manifest validation and bundle freshness/contract tests; root `pnpm check`; security/plugin suites; repository validator, policy tests and diff checks. Inspect the generated autonomous Dashboard for Russian copy, embedded icon and absence of external design fragments.

### Constraints

Do not tag, release, publish to the shared Plugin Directory, modify the installed plugin or run a real Mac audit/cleanup in this Issue. Release is a separate high-risk serial Issue after this PR is merged. Do not change audit data, invent history, add analytics, expose paths or identities or alter safety behavior. Do not run `shadcn init` over the existing repository or overwrite customized wrappers blindly; use the temporary preset as the migration reference and preserve intentional behavior.

## Русский

### Цель

Перевести панель проверки shadcn с Radix на Base UI и переданную владельцем тему, сделать её компактной и адаптивной, а технические тексты заменить понятными русскими формулировками без изменения поведения продукта и правил безопасности.

### Объём

Сохранить Vite, Tailwind v4 и shadcn, но перевести все установленные обёртки shadcn и места их использования с `radix-nova`/`radix-ui` на Base UI из выбранного владельцем preset `b1a0RuLKa`. Создать preset только во временном эталонном проекте и не запускать `shadcn init` поверх репозитория. Использовать штатную Base UI-композицию shadcn для `Card`, `Progress`, `Table`, `Badge`, `Sheet`, `Alert`, `AlertDialog`, `Skeleton`, `Tabs`, `Tooltip`, `Button`, `Separator` и `sonner`, сохранив нужное локальное поведение. Заменить смысловую тему точными значениями OKLCH для светлого и тёмного режима, которые передал владелец. Удалить отменённый внешний дизайн-эксперимент и не переносить из него HTML или стили. Сохранить локальный набор шрифтов, иконку, сравнение размеров и отключение анимации по системной настройке. Сделать обзор компактным и адаптивным для боковой панели Codex и полноэкранного режима. Переписать на понятном русском все видимые тексты панели, описания плагина, инструкции навыков и README; внутренние значения и коды показывать через человеческие подписи. После слияния PR обновить описание публичного репозитория короткой русской фразой. Пересобрать автономную панель и обновить точечные тесты и трассировку требований.

### Критерии приёмки

Панель остаётся автономным приложением shadcn с тёмной темой по умолчанию и работает на Base UI. `components.json` указывает стиль `base-*`, пакет `@base-ui/react` установлен, а в исходниках, местах использования и зависимостях widget не остаётся `radix-ui` или `@radix-ui`. Значения `:root` и `.dark` совпадают с темой владельца, а namespace Tailwind и смысловые связи токенов остаются корректными. Нет CDN, внешних шрифтов, телеметрии, лишних runtime-зависимостей, сырых цветов в компонентах и ручных `dark:`-переопределений. Файлов и требований отменённого внешнего дизайн-эксперимента нет. Карточки используют полную композицию shadcn; опасные действия подтверждаются через `AlertDialog`; доказательства открываются в `Sheet`; прогресс, предупреждения, вкладки, таблица, метки, подсказки и уведомления используют установленные компоненты. В узкой панели Codex содержимое остаётся одноколоночным и читаемым; в полноэкранном режиме появляется ограниченная адаптивная сетка без дублирования данных и перестановки действий. Каждый видимый пользователю заголовок, статус, ошибка, текст подтверждения, описание плагина, стартовый запрос и пояснение README написаны по-русски и понятны без знания внутренних терминов. Внутренние идентификаторы остаются только в данных инструментов, тестах и коде для разработчиков. Известные категории, доказательства, риски, состояния и причины запрета получают русские подписи; неизвестный внутренний код заменяется безопасным общим объяснением. Размеры остаются в десятичных МБ/ГБ, показываются раздельно и не обещают точный прирост свободного места APFS. Поведение проверки, полноэкранного режима, подвала, находок, карантина, исключений и ручного запуска не меняется. Схемы MCP, bridge-контракт, логика аудита, политика безопасности и полномочия изменения файлов не меняются.

### Проверка

Запустить информацию о проекте shadcn и официальные рекомендации для используемых компонентов; typecheck, тесты и сборку widget; точечные тесты текстов, адаптивной композиции, темы, иконки, размеров, анимации и reduced motion; проверку manifest плагина и свежести автономного bundle; корневой `pnpm check`; security/plugin suites; валидатор репозитория, policy tests и diff checks. Проверить созданный автономный Dashboard на русские тексты, встроенную иконку и отсутствие внешних ресурсов или фрагментов отменённого дизайн-эксперимента.

### Ограничения

В этой Issue не создавать тег и релиз, не публиковать плагин в общей Plugin Directory, не менять установленный плагин и не запускать реальную проверку или очистку Mac. Релиз выполняется отдельной последовательной Issue высокого риска после слияния этого PR. Не менять данные аудита, не выдумывать историю, не добавлять аналитику, не раскрывать пути или идентификаторы и не ослаблять безопасность. Не запускать `shadcn init` поверх существующего репозитория и не перезаписывать изменённые обёртки вслепую: временный preset служит эталоном миграции, а нужное поведение сохраняется.

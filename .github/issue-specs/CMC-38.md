```cto-issue
schema: 1
dependencies: #70
conflicts: none
touched_paths: .github/issue-specs/; .codex-plugin/; apps/widget/; assets/; README.md; docs/product/requirements-traceability.md; scripts/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Apply the owner-provided global theme to the existing shadcn Audit Dashboard and improve its visual hierarchy, storage visualization and purposeful motion without changing product behavior.

### Scope

Replace the widget semantic theme tokens with the latest owner-supplied light and dark color, typography, radius and shadow values while keeping dark mode as the product default. Register each value in its correct Tailwind v4 theme namespace and keep the font stack local-only. Extend the semantic mapping for chart and sidebar tokens. Refine the existing Dashboard composition using installed radix-nova/shadcn components. Add one owner-requested brand icon representing safe audit and user-controlled action, then use that same mark in plugin metadata, the Dashboard header and README. Add an accessible relative comparison visualization for the existing server-owned byte metrics only, with decimal MB/GB labels and an explicit non-additive snapshot meaning. Improve active-audit progress motion and restrained content entry transitions with a `prefers-reduced-motion` fallback. Rebuild the autonomous Dashboard asset and update focused tests and requirements traceability.

### Acceptance criteria

The latest supplied `:root` and `.dark` values are represented in the widget theme, and the packaged Dashboard starts in dark mode. Colors remain semantic color tokens; fonts, radius and shadows use their proper non-color Tailwind namespaces. `Open Sans` is a local-first CSS stack with a generic fallback and causes no external font fetch. The plugin manifest exposes a real packaged transparent PNG through `composerIcon`, `logo` and `logoDark`; README references the same master asset, while the autonomous Dashboard embeds a small derived copy with no network request. Components use semantic tokens only: no raw component colors, manual `dark:` overrides, external font loading, CDN, telemetry or new runtime dependency. The storage visualization is responsive, keyboard/screen-reader understandable, derives only from current server-owned `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes` and `purgedPhysicalBytes`, preserves decimal MB/GB formatting, and does not sum incompatible values or claim APFS free-space gain. Motion is concentrated on active audit progress and initial content entry, stops for terminal states, and is disabled by reduced-motion preference. Existing tabs, fullscreen, footer, findings, quarantine, exclusions and schedule behavior remain unchanged. No MCP schema, bridge contract, audit logic, safety policy or mutation authority changes.

### Verification

Run shadcn project info and official component guidance for the used primitives; widget typecheck/tests/build; focused theme, branding asset, manifest/allowlist, storage visualization, active/terminal motion and reduced-motion tests; plugin validation and bundle freshness/contract tests; root `pnpm check`; security/plugin suites; repository validator, policy tests and diff checks. Review the generated autonomous Dashboard asset for the new tokens, embedded icon and absence of new external resources.

### Constraints

Do not merge, tag, release or publish. Keep the PR draft because product copy will be revised later. Do not change audit data, invent historical series, add analytics, expose paths/identities, alter safety behavior or modify the installed plugin or this Mac. Do not overwrite shadcn primitives from a preset; preserve the existing radix-nova component source.

## Русский

### Цель

Применить предоставленную владельцем глобальную тему к существующему shadcn Audit Dashboard и улучшить визуальную иерархию, представление размеров и осмысленную анимацию без изменения поведения продукта.

### Объём

Заменить semantic theme tokens widget последними переданными владельцем значениями цветов, типографики, радиуса и теней для светлой и тёмной темы, сохранив тёмный режим режимом продукта по умолчанию. Зарегистрировать каждое значение в корректном namespace Tailwind v4 и оставить font stack только локальным. Расширить semantic mapping токенами chart и sidebar. Уточнить композицию существующего Dashboard на установленных radix-nova/shadcn компонентах. Добавить один запрошенный владельцем brand icon, передающий безопасный аудит и управляемое пользователем действие, затем использовать тот же знак в metadata плагина, шапке Dashboard и README. Добавить доступное относительное сравнение только существующих server-owned byte-метрик с десятичными МБ/ГБ и явным смыслом несуммируемого snapshot. Улучшить анимацию активного прогресса аудита и сдержанное появление содержимого с fallback для `prefers-reduced-motion`. Пересобрать автономный Dashboard asset, обновить focused tests и requirements traceability.

### Критерии приёмки

Последние переданные значения `:root` и `.dark` представлены в теме, а packaged Dashboard запускается в тёмном режиме. Цвета остаются semantic color tokens; шрифты, радиус и тени используют корректные нецветовые namespace Tailwind. `Open Sans` задан как local-first CSS stack с generic fallback и не вызывает внешний font fetch. Manifest плагина публикует реальный упакованный прозрачный PNG через `composerIcon`, `logo` и `logoDark`; README ссылается на тот же master asset, а автономный Dashboard встраивает уменьшенную производную копию без сетевого запроса. Компоненты используют только semantic tokens: без raw component colors, ручных `dark:` overrides, внешней загрузки шрифтов, CDN, telemetry и новых runtime-зависимостей. Визуализация размеров адаптивна, понятна клавиатуре/screen reader, строится только из текущих server-owned `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes` и `purgedPhysicalBytes`, сохраняет десятичные МБ/ГБ, не суммирует несовместимые значения и не обещает прирост свободного места APFS. Motion сосредоточен на активном прогрессе и начальном появлении содержимого, прекращается в terminal states и отключается при reduced-motion preference. Поведение существующих tabs, fullscreen, footer, findings, quarantine, exclusions и schedule не меняется. MCP schema, bridge contract, audit logic, safety policy и mutation authority не изменяются.

### Проверка

Запустить shadcn project info и официальные рекомендации для используемых primitives; widget typecheck/tests/build; focused tests темы, branding asset, manifest/allowlist, визуализации размеров, active/terminal motion и reduced motion; plugin validation и bundle freshness/contract tests; корневой `pnpm check`; security/plugin suites; repository validator, policy tests и diff checks. Проверить generated autonomous Dashboard на новые tokens, встроенную иконку и отсутствие новых внешних ресурсов.

### Ограничения

Не выполнять merge, tag, release или публикацию. Оставить PR draft, потому что продуктовые тексты будут дорабатываться позже. Не менять audit data, не выдумывать исторический ряд, не добавлять analytics, не раскрывать paths/identities, не менять safety-поведение и не изменять установленный plugin или этот Mac. Не перезаписывать shadcn primitives через preset; сохранить существующий radix-nova component source.

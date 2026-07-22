```cto-issue
schema: 1
dependencies: #64
conflicts: none
touched_paths: .github/issue-specs/; .github/FUNDING.yml; README.md; SPEC.md; apps/widget/; apps/mcp-server/; .codex-plugin/assets/; docs/architecture/; docs/contracts/; docs/decisions/; docs/product/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Refine Audit Dashboard navigation by removing Picture-in-Picture, retaining user-triggered fullscreen, and adding a project footer with community and support links.

### Scope

Update the MCP App specification and canonical UI description; record the owner UX decisions; remove the PiP button, icon, request branch, user messages and PiP type from both widget bridges; keep fullscreen host requests fail-safe; add a responsive footer with copyright, repository, GitHub Ideas, developer and project-support actions; open allowlisted destinations only through the documented host external-navigation API; add GitHub funding metadata and README support guidance; rebuild the checked-in autonomous Dashboard asset; update focused tests and requirements traceability.

### Acceptance criteria

Audit Dashboard no longer renders a Mini-window button and cannot send a `pip` display-mode request. The Expand control still requests `fullscreen` only after an explicit user click, and host rejection or missing capability leaves the Dashboard usable. The footer shows `© 2026 Dzzen`, an accessible GitHub icon for the repository, an Ideas action targeting the repository Discussions `ideas` category, a developer action targeting `https://dzzen.com`, and a support action targeting `https://dzzen.com/support`. External navigation is user-triggered, host-mediated and restricted by resource CSP to GitHub and dzzen.com. README and `.github/FUNDING.yml` expose the same support URL. No MCP tool schema, audit behavior, safety policy, quarantine behavior or mutation authority changes. Historical beta.6 release notes remain unchanged.

### Verification

Run focused widget and bridge tests, widget typecheck/build, MCP resource contract tests, plugin bundle regression checks, repository validator, policy tests and diff checks. Prove that source tests and the rebuilt autonomous Dashboard asset contain no product-owned Mini-window or PiP control while fullscreen behavior remains covered. Verify every footer action maps to its fixed URL, no external action calls an MCP tool, missing or rejected host navigation is safe, CSP contains only the two redirect origins, and GitHub funding/README use the canonical support URL.

### Constraints

Do not merge or release while the owner is still collecting follow-up UI feedback. Do not modify published tags or GitHub releases. Do not add telemetry, tracking, external fetch/resource/frame domains, arbitrary URLs or automatic navigation. The support page may be implemented later; do not claim it is live. Do not change safety policy, classifier, audit coverage, mutation semantics, MCP tool visibility or quarantine behavior. Do not add undocumented host metadata or emulate a right-panel placement.

## Русский

### Цель

Уточнить навигацию Audit Dashboard: убрать Picture-in-Picture, сохранить пользовательский fullscreen и добавить подвал со ссылками проекта, сообщества и поддержки.

### Объём

Обновить спецификацию MCP App и каноническое описание UI; зафиксировать UX-решения владельца; удалить из обоих widget bridges кнопку PiP, иконку, ветку запроса, сообщения и тип PiP; сохранить безопасный fullscreen-запрос; добавить адаптивный подвал с копирайтом, ссылкой на репозиторий, GitHub Ideas, разработчика и поддержку проекта; открывать только разрешённые назначения через документированный host API внешней навигации; добавить GitHub funding metadata и информацию о поддержке в README; пересобрать отслеживаемый автономный Dashboard asset; обновить focused tests и трассировку требований.

### Критерии приёмки

Audit Dashboard больше не показывает кнопку «Мини-окно» и не может отправить запрос display mode `pip`. Кнопка «Развернуть» по-прежнему запрашивает `fullscreen` только после явного нажатия пользователя, а отказ или отсутствие capability хоста не ломают Dashboard. Подвал показывает `© 2026 Dzzen`, доступную иконку GitHub со ссылкой на репозиторий, кнопку идей на категорию Discussions `ideas`, кнопку разработчика на `https://dzzen.com` и кнопку поддержки на `https://dzzen.com/support`. Внешняя навигация запускается только кликом пользователя, выполняется host и ограничена resource CSP доменами GitHub и dzzen.com. README и `.github/FUNDING.yml` используют тот же support URL. MCP tool schemas, поведение аудита, safety policy, карантин и mutation authority не меняются. Исторические release notes beta.6 остаются неизменными.

### Проверка

Запустить focused widget/bridge tests, typecheck/build widget, MCP resource contract tests, regression-проверки plugin bundle, repository validator, policy tests и diff checks. Доказать, что source tests и пересобранный автономный Dashboard asset не содержат продуктовой кнопки или запроса «Мини-окно»/PiP, а fullscreen остаётся покрыт тестами. Проверить точный URL каждой кнопки, отсутствие MCP tool call при внешнем переходе, безопасный fallback при отсутствии или отказе host API, только два redirect origin в CSP и единый support URL в GitHub funding/README.

### Ограничения

Не выполнять merge или release, пока владелец собирает следующие UI-правки. Не изменять опубликованные tags и GitHub releases. Не добавлять telemetry, tracking, внешние fetch/resource/frame domains, произвольные URL или автоматическую навигацию. Страница поддержки может быть сделана позже; не заявлять, что она уже работает. Не менять safety policy, classifier, audit coverage, mutation semantics, видимость MCP tools и поведение карантина. Не добавлять недокументированные host metadata и не имитировать размещение в правой панели.

```cto-issue
schema: 1
dependencies: #64
conflicts: none
touched_paths: .github/issue-specs/; SPEC.md; apps/widget/; apps/mcp-server/; .codex-plugin/assets/; docs/architecture/; docs/decisions/; docs/product/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Remove the Picture-in-Picture mini-window control and capability from Audit Dashboard while retaining the user-triggered fullscreen control.

### Scope

Update the MCP App specification and canonical UI description; record the owner UX decision; remove the PiP button, icon, request branch, user messages and PiP type from the widget bridge; keep fullscreen host requests fail-safe; rebuild the checked-in autonomous Dashboard asset; update focused tests and requirements traceability.

### Acceptance criteria

Audit Dashboard no longer renders a Mini-window button and cannot send a `pip` display-mode request. The Expand control still requests `fullscreen` only after an explicit user click, and host rejection or missing capability leaves the Dashboard usable. No MCP tool schema, audit behavior, safety policy, quarantine behavior or mutation authority changes. Historical beta.6 release notes remain unchanged.

### Verification

Run focused widget tests, widget typecheck/build, plugin bundle regression checks, repository validator, policy tests and diff checks. Prove that source tests and the rebuilt autonomous Dashboard asset contain no product-owned Mini-window or PiP control while fullscreen behavior remains covered.

### Constraints

Do not merge or release while the owner is still collecting follow-up UI feedback. Do not modify published tags or GitHub releases. Do not change safety policy, classifier, audit coverage, mutation semantics, MCP tool visibility or quarantine behavior. Do not add undocumented host metadata or emulate a right-panel placement.

## Русский

### Цель

Убрать из Audit Dashboard кнопку и возможность режима Picture-in-Picture «Мини-окно», сохранив пользовательскую кнопку полноэкранного режима.

### Объём

Обновить спецификацию MCP App и каноническое описание UI; зафиксировать UX-решение владельца; удалить из widget кнопку PiP, иконку, ветку запроса, сообщения и тип PiP в bridge; сохранить безопасный fullscreen-запрос; пересобрать отслеживаемый автономный Dashboard asset; обновить focused tests и трассировку требований.

### Критерии приёмки

Audit Dashboard больше не показывает кнопку «Мини-окно» и не может отправить запрос display mode `pip`. Кнопка «Развернуть» по-прежнему запрашивает `fullscreen` только после явного нажатия пользователя, а отказ или отсутствие capability хоста не ломают Dashboard. MCP tool schemas, поведение аудита, safety policy, карантин и mutation authority не меняются. Исторические release notes beta.6 остаются неизменными.

### Проверка

Запустить focused widget tests, typecheck/build widget, regression-проверки plugin bundle, repository validator, policy tests и diff checks. Доказать, что source tests и пересобранный автономный Dashboard asset не содержат продуктовой кнопки или запроса «Мини-окно»/PiP, а fullscreen остаётся покрыт тестами.

### Ограничения

Не выполнять merge или release, пока владелец собирает следующие UI-правки. Не изменять опубликованные tags и GitHub releases. Не менять safety policy, classifier, audit coverage, mutation semantics, видимость MCP tools и поведение карантина. Не добавлять недокументированные host metadata и не имитировать размещение в правой панели.

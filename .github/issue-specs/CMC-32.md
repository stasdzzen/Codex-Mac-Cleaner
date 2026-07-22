```cto-issue
schema: 1
dependencies: #58
conflicts: none
touched_paths: .github/issue-specs/; SPEC.md; docs/architecture/; docs/product/; apps/widget/; apps/mcp-server/src/resources/; apps/mcp-server/test/; .codex-plugin/assets/; tests/plugin/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Add user-triggered fullscreen and capability-aware picture-in-picture display requests to the Codex Mac Cleaner Dashboard while keeping inline rendering as the safe default.

### Scope

Document the public MCP Apps display boundary and the absence of a guaranteed right sidebar. Extend the widget bridge with feature-detected display-mode requests, add clear Dashboard controls for fullscreen and PiP, preserve inline fallback, and handle host rejection without changing audit state or filesystem authority.

### Acceptance criteria

Dashboard remains inline by default. A user click can request fullscreen. A separate user click can request PiP when the host exposes the display-mode API; unsupported or rejected requests show a clear non-destructive message and keep the current view. No mode switch happens automatically. The plugin does not claim guaranteed right-panel placement. Audit, privacy, protected-scope, quarantine and one-object confirmation semantics remain unchanged.

### Verification

Add RED to GREEN widget and production-bridge tests for fullscreen, PiP, missing capability and host rejection. Build the autonomous Dashboard asset, run widget, MCP integration and plugin contract tests, root pnpm check, repository validators and git diff --check on the final head.

### Constraints

Do not add a local HTTP server, network access, shell commands, bulk actions, automatic display switching or undocumented sidebar metadata. Do not change classifier, correlation, policy, protected scopes, quarantine, scheduling or confirmation semantics. Do not merge, tag, release, publish or modify the installed plugin in this Issue.

## Русский

### Цель

Добавить в Dashboard Codex Mac Cleaner пользовательские запросы полноэкранного режима и capability-aware мини-окна PiP, сохранив встроенное отображение безопасным режимом по умолчанию.

### Объём

Зафиксировать публичную границу режимов MCP Apps и отсутствие гарантированного API правой панели. Расширить widget bridge feature-detected запросами режима отображения, добавить понятные элементы управления fullscreen и PiP, сохранить inline fallback и обрабатывать отказ хоста без изменения состояния аудита или полномочий над файлами.

### Критерии приёмки

Dashboard по умолчанию остаётся встроенным в чат. Отдельное нажатие пользователя может запросить полноэкранный режим. Другое отдельное нажатие может запросить PiP, когда хост предоставляет API режима отображения; отсутствие возможности или отказ показываются понятным безопасным сообщением, а текущий вид сохраняется. Автоматического переключения нет. Плагин не обещает гарантированное размещение в правой панели. Семантика аудита, privacy, protected scopes, quarantine и поэлементного подтверждения не меняется.

### Проверка

Добавить RED to GREEN widget и production-bridge tests для fullscreen, PiP, отсутствующей capability и отказа хоста. Собрать автономный asset Dashboard, запустить widget, MCP integration и plugin contract tests, корневой pnpm check, validators репозитория и git diff --check на финальном head.

### Ограничения

Не добавлять локальный HTTP server, сеть, shell-команды, bulk actions, автоматическое переключение режима или недокументированные sidebar metadata. Не менять classifier, correlation, policy, protected scopes, quarantine, scheduling и семантику подтверждения. Не выполнять merge, tag, release, публикацию и не изменять установленный plugin в этой Issue.

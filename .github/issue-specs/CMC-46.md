```cto-issue
schema: 1
dependencies: #86
conflicts: none
touched_paths: .github/issue-specs/CMC-46.md; .codex-plugin/; .mcp.json; skills/codex-mac-cleaner/; packages/contracts/src/tools.ts; packages/contracts/test/; apps/mcp-server/src/runtime.ts; apps/mcp-server/src/server.ts; apps/mcp-server/test/; tests/plugin/; docs/contracts/mcp-tools.md; docs/product/requirements-traceability.md
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Run one native read-only audit through host-registered plugin tools and expose the exact terminal revision from `audit_status` to `audit_results` and `dashboard_open`, without terminal or direct-stdio fallbacks.

### Scope

Add nullable revision to the status contract and runtime, update the Skill to use that exact value, perform one host-native tool discovery when tools are not immediately visible, then fail closed if any required native tool remains absent. Explicitly prohibit direct stdio/terminal/local-HTML workarounds and automatic rescan, and validate the packaged MCP handshake plus a temporary-CODEX_HOME installation. Keep runs in process memory and return a typed not-found outcome after process loss rather than persisting raw audit identities or silently rescanning.

### Acceptance criteria

Every status contains nullable revision; successful terminal status contains the exact integer revision. The Skill completes one native start/live-dashboard/status/results/final-dashboard chain. Missing tools produce a clear fail-closed outcome with no files, shell, scan or false UI claim. Packaged handshake exposes all required tools and resource metadata. Safety and mutation authority remain unchanged.

### Verification

Run RED→GREEN contract/runtime/Skill tests, plugin integration, packaged stdio handshake, temporary clean-room install, privacy/security suites, root checks, repository validators and diff checks.

### Constraints

Do not modify the Codex host, add terminal/HTTP fallbacks, persist raw audit reports, retry audits automatically, weaken policy, or perform a real-Mac cleanup.

## Русский

### Цель

Сделать один штатный read-only аудит через зарегистрированные инструменты плагина без терминального/stdin-обхода и передавать точную завершённую ревизию из `audit_status` в `audit_results` и `dashboard_open`.

### Объём

Real-Mac диагностика beta.10 в задаче Codex не получила `codexMacCleaner` в task-scoped tool registry, хотя плагин был установлен и MCP-сервер отдельно проходил handshake. Задача создала прямой stdio-клиент, из-за чего Codex не смог отрисовать возвращённый `ui://codex-mac-cleaner/dashboard-v2.html`. Первый полный проход потерял in-memory run: `audit_status` сообщил terminal state, но не сообщил revision, клиент завершил процесс, и результаты потребовали повторного аудита.

- Добавить `revision: integer | null` в публичный schema и результат `audit_status`.
- Возвращать exact revision только для `completed | completed_with_warnings`; для остальных состояний возвращать `null`.
- Обновить Skill: после terminal state использовать только revision из `audit_status`; не угадывать `1`, не запускать повторный аудит автоматически.
- Если native MCP-tools не видны сразу, один раз выполнить штатный host tool discovery по точным именам. Если хотя бы один обязательный инструмент после этого отсутствует, завершать сценарий понятной fail-closed ошибкой. Явно запретить прямой stdio/terminal-клиент, локальный HTML и другие обходы host tool pipeline.
- Сохранить audit run только в памяти штатного MCP-процесса: не записывать raw paths, identities, inventory или personal data в persisted report. После потери процесса возвращать typed not-found outcome и не запускать аудит заново без нового запроса пользователя.
- Проверить packaged manifest/MCP handshake и clean-room установку во временном `CODEX_HOME`, не изменяя установленный плагин владельца.

### Критерии приёмки

1. `audit_status` всегда содержит nullable `revision`; terminal successful state содержит точную integer revision.
2. Skill выполняет цепочку `audit_start → dashboard_open(null) → audit_status → audit_results(revision) → dashboard_open(revision)` за один audit run.
3. При отсутствии MCP-tools Skill не создаёт файлы, не запускает shell/stdin и не заявляет, что Dashboard открыт.
4. Завершение/перезапуск неподдерживаемого обходного процесса не приводит к скрытому повторному аудиту.
5. Packaged server объявляет инструменты, schemas и Dashboard resource через штатный MCP handshake.
6. Safety, policy, classifier, protected scopes, quarantine и mutation authority не ослаблены.

### Проверка

RED→GREEN тесты schemas/runtime/Skill, plugin integration, packaged stdio handshake, временная clean-room установка, privacy/security suites, root `pnpm check`, repository validators и `git diff --check`. Owner Real-Mac smoke остаётся отдельным gate после релиза.

### Ограничения

Не исправлять внутренности хоста Codex и не обещать, что сторонний host никогда не потеряет task-scoped registry. Не добавлять terminal fallback, HTTP-сервер, auto-retry аудита, persisted raw audit report или mutation от имени модели. Не менять алгоритм классификации и решения policy.

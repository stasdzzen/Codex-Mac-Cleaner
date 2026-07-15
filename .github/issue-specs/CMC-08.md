```cto-issue
schema: 1
dependencies: #5
conflicts: none
touched_paths: apps/widget/
risk: medium
parallel_safety: safe
execution_profile: default
```

## English

### Goal

Build the autonomous dark Audit Dashboard against frozen fixtures and server contracts.

### Scope

Create the React/Vite widget, local shadcn components, bridge abstraction and UI tests from CMC-08.

### Acceptance criteria

The dashboard uses semantic tokens and approved components, loads no CDN, drops stale state versions, stores no path/token/policy in view state, and renders coverage, risk and blocking reasons without color-only meaning.

### Verification

Run Testing Library tests, widget production build and root `pnpm check`. Inspect the built asset list for external runtime URLs.

### Constraints

UI never computes allowed actions. No server policy, quarantine code, plugin manifest, visual completion claim, merge or release.

## Русский

### Цель

Собрать автономный тёмный Audit Dashboard по frozen fixtures и server contracts.

### Объём

Создать React/Vite widget, локальные shadcn components, bridge abstraction и UI tests из CMC-08.

### Критерии приёмки

Dashboard использует semantic tokens и утверждённые components, не загружает CDN, отбрасывает stale stateVersion, не хранит path/token/policy в view state и показывает coverage/risk/block reason не только цветом.

### Проверка

Запустить Testing Library tests, production build и root `pnpm check`; проверить built asset list на внешние runtime URLs.

### Ограничения

UI не вычисляет allowed actions. Не менять server policy, quarantine, plugin manifest, не заявлять visual completion, не выполнять merge/release.

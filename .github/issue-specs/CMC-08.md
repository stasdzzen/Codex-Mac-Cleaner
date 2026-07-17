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

Build the autonomous dark Audit Dashboard and Quarantine Center against frozen fixtures and server contracts.

### Scope

Create the React/Vite widget, three-tab dashboard (`Overview`, `Findings`, `Quarantine`), local shadcn components, bridge abstraction, cancellation states and UI tests from CMC-08.

### Acceptance criteria

The dashboard uses semantic tokens and approved components, including `Tabs`, `Button` and `Tooltip`, loads no CDN, drops stale state versions, stores no path/token/policy in view state, and renders coverage, risk and blocking reasons without color-only meaning. It shows server-owned `candidatePhysicalBytes`, `quarantinePhysicalBytes` and journal-derived `purgedPhysicalBytes`; it never presents the last value as an exact APFS free-space delta. A cancelled partial report is read-only. Quarantine provides per-entry restore and permanent delete only: no bulk selection, “clear all” or automatic purge.

### Verification

Run Testing Library tests, widget production build and root `pnpm check`. Inspect the built asset list for external runtime URLs.

### Constraints

UI never computes allowed actions. No server policy, quarantine code, plugin manifest, visual completion claim, merge or release.

## Русский

### Цель

Собрать автономный тёмный Audit Dashboard и Quarantine Center по frozen fixtures и server contracts.

### Объём

Создать React/Vite widget, Dashboard с тремя вкладками «Обзор», «Находки», «Карантин», локальные shadcn components, bridge abstraction, состояния отмены и UI tests из CMC-08.

### Критерии приёмки

Dashboard использует semantic tokens и утверждённые components, включая `Tabs`, `Button` и `Tooltip`, не загружает CDN, отбрасывает stale stateVersion, не хранит path/token/policy в view state и показывает coverage/risk/block reason не только цветом. Он выводит server-owned `candidatePhysicalBytes`, `quarantinePhysicalBytes` и вычисленный по журналу `purgedPhysicalBytes`, не называя последнее значение точным изменением свободного места APFS. Частичный отменённый отчёт read-only. В карантине доступны только поэлементные «Восстановить» и «Удалить навсегда»: без bulk selection, «Очистить всё» и автоматической очистки.

### Проверка

Запустить Testing Library tests, production build и root `pnpm check`; проверить built asset list на внешние runtime URLs.

### Ограничения

UI не вычисляет allowed actions. Не менять server policy, quarantine, plugin manifest, не заявлять visual completion, не выполнять merge/release.

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

Build the autonomous dark public-product Audit Dashboard shell with button-only decisions, FindingFacts, support levels and honest metrics.

### Scope

Create the CMC-08 React/Vite widget, five-tab shell, local shadcn components, bridge, cancellation states, `FindingFacts`/`ReclaimEstimate`, Delete/Exclude/Skip-now controls, support-level UI, Quarantine Center, five server-owned indicators and tests against synthetic frozen fixtures. CMC-12/13 will add Exclusions/Schedule behavior.

### Acceptance criteria

The dashboard uses semantic tokens, approved components and no CDN. It drops stale versions and stores no path/token/policy. It has Overview, Findings, Quarantine, Exclusions and Schedule tabs; the last two show honest dependency states until CMC-12/13. Finding details show component, category, time, installed/activity/open/startup/receipt states, sensitive-data flags, risk, reasons, recommended method and a non-causal reclaim estimate. Actionable findings show Delete, Exclude and Skip now; Skip only updates revision-local `skippedFindingIds` and calls no tool. Delete confirms consequences and quarantine of one object, not direct delete. `unsupported_manual` says advanced mode is required without shell/sudo. Quarantine remains per-entry only; no bulk or auto purge.

### Verification

Run Testing Library tests for five tabs, cancellation, Skip-now/no-tool, FindingFacts, support levels, five indicators, one-object Delete confirmation, absence of shell/bulk controls, keyboard/focus, widget production build and root `pnpm check`. Inspect built assets for external URLs.

### Constraints

UI never computes policy or metrics. No server policy, quarantine implementation, plugin manifest, visual completion claim, merge or release.

## Русский

### Цель

Собрать автономный тёмный public-product Audit Dashboard shell с решениями только кнопками, FindingFacts, support levels и честными метриками.

### Объём

Создать React/Vite widget CMC-08, пяти-вкладочный shell, локальные shadcn components, bridge, cancellation states, `FindingFacts`/`ReclaimEstimate`, controls «Удалить»/«Исключить»/«Пропустить сейчас», support-level UI, Quarantine Center, пять server-owned показателей и tests на synthetic frozen fixtures. Behavior «Исключений»/«Расписания» добавят CMC-12/13.

### Критерии приёмки

Dashboard использует semantic tokens, утверждённые components и не загружает CDN. Он имеет вкладки «Обзор», «Находки», «Карантин», «Исключения», «Расписание»; последние две до CMC-12/13 показывают честный dependency state. Finding details показывают компонент, категорию, время, installed/activity/open/startup/receipt states, sensitive flags, риск, причины, recommended method и непричинный reclaim estimate. «Пропустить сейчас» меняет только `skippedFindingIds` и не вызывает tool. «Удалить» подтверждает последствия и quarantine одного объекта, а не direct delete. `unsupported_manual` сообщает о расширенном режиме без shell/sudo. Карантин только поэлементный; bulk и auto purge отсутствуют.

### Проверка

Запустить Testing Library tests пяти вкладок, cancellation, «Пропустить сейчас» без tool, FindingFacts, support levels, пяти показателей, подтверждения одного Delete, отсутствия shell/bulk controls, keyboard/focus, production build и root `pnpm check`; проверить assets на внешние URLs.

### Ограничения

UI не вычисляет policy или метрики. Не менять server policy, quarantine implementation, plugin manifest, не заявлять visual completion, не выполнять merge/release.

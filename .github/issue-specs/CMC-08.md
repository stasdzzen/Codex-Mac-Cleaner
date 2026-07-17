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

Build the autonomous dark Audit Dashboard with button-only decisions, support levels and honest metrics.

### Scope

Create the CMC-08 React/Vite widget, three tabs, local shadcn components, bridge, cancellation states, session-local Keep action, support-level UI, Quarantine Center, five server-owned indicators and tests against synthetic frozen fixtures.

### Acceptance criteria

The dashboard uses semantic tokens, approved components and no CDN. It drops stale versions and stores no path/token/policy. Actionable findings show `Keep` and `Move to quarantine`; Keep only updates revision-local `reviewedFindingIds`, calls no tool and resets on a new audit. `unsupported_manual` shows a safe explanation without mutation, shell command or sudo. UI displays logical candidate bytes, physical candidate bytes, quarantine bytes, purged bytes and timestamped free-disk observation without calculating an APFS delta. Cancelled results are read-only. Quarantine offers per-entry restore and permanent delete only; no bulk, clear-all or automatic purge.

### Verification

Run Testing Library tests for tabs, cancellation, Keep/no-tool, support levels, five indicators, absence of shell/bulk controls, keyboard/focus, widget production build and root `pnpm check`. Inspect built assets for external URLs.

### Constraints

UI never computes policy or metrics. No server policy, quarantine implementation, plugin manifest, visual completion claim, merge or release.

## Русский

### Цель

Собрать автономный тёмный Audit Dashboard с решениями только кнопками, support levels и честными метриками.

### Объём

Создать React/Vite widget CMC-08, три вкладки, локальные shadcn components, bridge, cancellation states, session-local «Оставить», support-level UI, Quarantine Center, пять server-owned показателей и tests на synthetic frozen fixtures.

### Критерии приёмки

Dashboard использует semantic tokens, утверждённые components и не загружает CDN. Он отбрасывает stale versions и не хранит path/token/policy. Actionable finding показывает «Оставить» и «Переместить в карантин»; «Оставить» меняет только `reviewedFindingIds` текущей ревизии, не вызывает tool и сбрасывается при новом аудите. `unsupported_manual` показывает безопасное объяснение без mutation, shell-команды или sudo. UI отдельно выводит logical candidate bytes, physical candidate bytes, quarantine bytes, purged bytes и timestamped free-disk observation без APFS delta. Cancelled report read-only. Карантин предлагает только поэлементные restore и permanent delete; bulk, clear-all и auto purge отсутствуют.

### Проверка

Запустить Testing Library tests вкладок, cancellation, «Оставить» без tool, support levels, пяти показателей, отсутствия shell/bulk controls, keyboard/focus, production build и root `pnpm check`; проверить assets на внешние URLs.

### Ограничения

UI не вычисляет policy или метрики. Не менять server policy, quarantine implementation, plugin manifest, не заявлять visual completion, не выполнять merge/release.

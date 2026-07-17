```cto-issue
schema: 1
dependencies: #9
conflicts: none
touched_paths: packages/contracts/; packages/storage/; apps/mcp-server/; apps/widget/; skills/; tests/plugin/
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement explicit-opt-in monthly read-only audits through a capability-aware Codex automation bridge with an honest fallback.

### Scope

Add strict schedule intent/state contracts, atomic local state, app-visible schedule requests, model-visible host bridge completion, Skill capability flow, final reminder card, Schedule tab and lifecycle tests defined in CMC-13.

### Acceptance criteria

Schedule is disabled by default and exposes no raw RRULE. MCP App creates an intent but never calls a host-native tool. Skill/host checks capability, shows confirmation and creates or updates one automation; the opaque ID is persisted locally. Repeated enable updates instead of duplicating. Pause/resume/update/delete are supported. Without capability the UI is disabled and no cron, LaunchAgent or hidden scheduler is created. Scheduled prompt runs only read-only `application_remnants`, applies exclusions, reports count/estimate, requests no sudo and performs no mutation.

### Verification

Run schedule schema/store/intent, duplicate/update/pause/resume/delete, widget, read-only prompt and no-capability fallback tests plus root `pnpm check` and `git diff --check` on the final SHA. Keep real host smoke open if capability is unavailable.

### Constraints

No cron, LaunchAgent, system daemon, raw RRULE UI, cleanup mutation, false host-capability claim, merge, release or publication.

## Русский

### Цель

Реализовать ежемесячный read-only audit с явным opt-in через capability-aware Codex automation bridge и честный fallback.

### Объём

Добавить строгие schedule intent/state contracts, атомарный local state, app-visible schedule requests, model-visible завершение host bridge, Skill capability flow, финальную reminder card, вкладку «Расписание» и lifecycle tests из CMC-13.

### Критерии приёмки

Schedule выключен по умолчанию и не показывает raw RRULE. MCP App создаёт intent, но не вызывает host-native tool. Skill/host проверяет capability, показывает подтверждение и создаёт либо обновляет одну automation; opaque ID хранится локально. Повторный enable обновляет существующую запись. Поддержаны pause/resume/update/delete. Без capability UI disabled, cron, LaunchAgent и скрытый scheduler не создаются. Scheduled prompt запускает только read-only `application_remnants`, применяет exclusions, сообщает count/estimate, не запрашивает sudo и не выполняет mutation.

### Проверка

Запустить schedule schema/store/intent, duplicate/update/pause/resume/delete, widget, read-only prompt и no-capability fallback tests, затем root `pnpm check` и `git diff --check` на финальном SHA. Real host smoke оставить открытым, если capability недоступна.

### Ограничения

Запрещены cron, LaunchAgent, system daemon, raw RRULE UI, cleanup mutation, ложный host-capability claim, merge, release и publication.

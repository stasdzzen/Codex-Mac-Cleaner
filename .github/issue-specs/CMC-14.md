```cto-issue
schema: 1
dependencies: #10
conflicts: none
touched_paths: docs/superpowers/specs/; docs/decisions/; docs/safety/; docs/product/
risk: high
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Research Advanced Cleanup v0.2 and a trusted privileged-helper architecture without implementing system mutation.

### Scope

After explicit owner approval, produce a detector matrix, trust boundaries, signing/entitlement model, threat model, rollback/recovery design, test strategy, ADR proposal and atomic future Issue slices for system remnants and services.

### Acceptance criteria

Research covers relocated items, helpers, daemons, frameworks, missing executables, printer/VPN remnants, TCP listeners, Homebrew services, cron, StartupItems, system extensions and Time Machine snapshots. MCP cannot run sudo or arbitrary shell. The proposal defines why and how a separately trusted helper would be constrained. No runtime implementation or system change is included.

### Verification

Run documentation/OKF/link checks and independent architecture/security review on the final docs SHA.

### Constraints

Remain `cto:blocked` until CMC-10 is closed and the owner explicitly opens v0.2. No runtime code, helper installation, `/Library` mutation, sudo, TCC bypass, merge or release.

## Русский

### Цель

Исследовать Advanced Cleanup v0.2 и архитектуру trusted privileged helper без реализации системной mutation.

### Объём

После явного owner approval подготовить detector matrix, trust boundaries, signing/entitlement model, threat model, rollback/recovery design, test strategy, ADR proposal и атомарные будущие Issue slices для системных остатков и служб.

### Критерии приёмки

Research покрывает relocated items, helpers, daemons, frameworks, missing executables, printer/VPN remnants, TCP listeners, Homebrew services, cron, StartupItems, system extensions и Time Machine snapshots. MCP не выполняет sudo или arbitrary shell. Proposal определяет границы отдельного trusted helper. Runtime implementation и изменения системы отсутствуют.

### Проверка

Запустить documentation/OKF/link checks и независимый architecture/security review на финальном docs SHA.

### Ограничения

Оставаться `cto:blocked` до закрытия CMC-10 и явного открытия v0.2 владельцем. Запрещены runtime-код, установка helper, mutation `/Library`, sudo, TCC bypass, merge и release.

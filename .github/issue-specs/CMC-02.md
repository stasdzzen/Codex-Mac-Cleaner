```cto-issue
schema: 1
dependencies: #1, #20
conflicts: none
touched_paths: package.json; pnpm-lock.yaml; pnpm-workspace.yaml; tsconfig.base.json; tsconfig.json; packages/platform/
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Create the pinned TypeScript workspace and reject unsupported operating systems before any scan starts.

### Scope

Add the root pnpm workspace, shared TypeScript config, platform package and tests defined in CMC-02 of the implementation plan.

### Acceptance criteria

Node 24 LTS and pinned tool versions install from the lockfile. The guard accepts macOS 26+ on `arm64` and rejects every other platform, architecture and older macOS before adapters run.

### Verification

Run the platform package tests and the root `pnpm check`. Record commands and results on the final head SHA.

### Constraints

No product scanner, Swift, Electron, network runtime, mutation code, merge or release.

## Русский

### Цель

Создать зафиксированный TypeScript workspace и отклонять неподдерживаемую платформу до начала сканирования.

### Объём

Добавить root pnpm workspace, общий TypeScript config, platform package и тесты из CMC-02 плана.

### Критерии приёмки

Node 24 LTS и точные версии устанавливаются по lockfile. Guard принимает macOS 26+ на `arm64` и отклоняет другие ОС, архитектуры и старые macOS до adapters.

### Проверка

Запустить tests platform package и root `pnpm check`; записать команды и результаты на финальном head SHA.

### Ограничения

Не добавлять scanner, Swift, Electron, runtime network, mutation-код, merge или release.

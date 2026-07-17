```cto-issue
schema: 1
dependencies: #2
conflicts: none
touched_paths: .github/issue-specs/CMC-03.md; .github/issue-specs/CMC-18.md; docs/product/implementation-roadmap.md; docs/prompts/CMC-03-contracts-store-mcp.md; docs/prompts/CMC-18-lockfile-scope.md; docs/prompts/index.md; docs/log.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Unblock CMC-03 by aligning its canonical touched paths and dependency chain with the root pnpm lockfile update explicitly required by the implementation plan.

### Scope

Add CMC-18 to the local Issue canon, roadmap, prompt index and log. Make the local CMC-03 specification depend on this Issue and permit only the additional root `pnpm-lock.yaml` path required for its pinned Zod and MCP SDK dependencies. Update the CMC-03 Worker prompt to enforce frozen-lockfile verification. Do not implement CMC-03.

### Acceptance criteria

The local CMC-03 contract includes `pnpm-lock.yaml` and dependency CMC-18 while preserving its existing runtime paths and safety constraints. The roadmap critical path is synchronized. The CMC-03 prompt requires the lockfile to be committed and `pnpm install --frozen-lockfile` to pass. Repository contracts pass and no runtime, package or lockfile content is changed by this Issue.

### Verification

Run the repository validator, repository policy unit tests and `git diff --check` on the final head SHA. Confirm the diff contains only the declared documentation and Issue-spec paths.

### Constraints

Do not implement CMC-03, edit runtime or package files, update dependency contents, change architecture or safety invariants, merge another Issue, release or publish.

## Русский

### Цель

Разблокировать CMC-03: привести её канонические touched paths и цепочку зависимостей в соответствие с обязательным обновлением корневого pnpm lockfile из плана реализации.

### Объём

Добавить CMC-18 в локальный канон Issues, roadmap, индекс промптов и журнал. Сделать локальную спецификацию CMC-03 зависимой от этой Issue и разрешить только дополнительный корневой путь `pnpm-lock.yaml`, необходимый для закреплённых зависимостей Zod и MCP SDK. В промпте CMC-03 закрепить проверку frozen lockfile. Саму CMC-03 не реализовывать.

### Критерии приёмки

Локальный контракт CMC-03 содержит `pnpm-lock.yaml` и dependency CMC-18, сохраняя прежние runtime paths и safety-ограничения. Критический путь roadmap синхронизирован. Промпт CMC-03 требует закоммитить lockfile и успешно выполнить `pnpm install --frozen-lockfile`. Контракты репозитория проходят; runtime, package-файлы и содержимое lockfile в этой Issue не меняются.

### Проверка

Запустить repository validator, unit tests repository policy и `git diff --check` на финальном head SHA. Подтвердить, что diff содержит только заявленные documentation и Issue-spec paths.

### Ограничения

Не реализовывать CMC-03, не менять runtime и package-файлы, не обновлять содержимое dependencies, не менять архитектуру или safety-инварианты, не сливать другую Issue, не выпускать release и не публиковать продукт.

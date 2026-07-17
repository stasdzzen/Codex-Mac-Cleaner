```cto-issue
schema: 1
dependencies: #3
conflicts: none
touched_paths: .github/issue-specs/CMC-04.md; .github/issue-specs/CMC-05.md; .github/issue-specs/CMC-06.md; .github/issue-specs/CMC-08.md; .github/issue-specs/CMC-09.md; .github/issue-specs/CMC-19.md; docs/product/implementation-roadmap.md; docs/prompts/CMC-04-adapters.md; docs/prompts/CMC-05-classifier-policy.md; docs/prompts/CMC-06-quarantine.md; docs/prompts/CMC-08-dashboard.md; docs/prompts/CMC-09-plugin-integration.md; docs/prompts/CMC-19-lockfile-queue.md; docs/prompts/index.md; docs/log.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Unblock the remaining v0.1 implementation queue by aligning the canonical touched paths of every plan task that explicitly stages the root pnpm lockfile.

### Scope

Add CMC-19 to the local Issue canon, roadmap, prompt index and log. Add only the root `pnpm-lock.yaml` path to CMC-04, CMC-05, CMC-06, CMC-08 and CMC-09 because their approved implementation steps explicitly stage that file. Make local CMC-04 depend on this Issue while retaining dependency #3. Update the five Worker prompts with frozen-lockfile verification and a requirement to commit the lockfile when package manifests or pinned dependencies change. Do not implement any of those runtime Issues.

### Acceptance criteria

The five local Issue contracts permit `pnpm-lock.yaml` without removing or broadening their existing runtime paths and safety constraints. CMC-04 depends on #3 and CMC-19; downstream dependency identities remain unchanged. The roadmap inserts CMC-19 between CMC-03 and CMC-04 and synchronizes the critical path. Each affected Worker prompt requires `corepack pnpm install --frozen-lockfile`, verifies the lockfile is unchanged by frozen installation, and includes the required lockfile change in the same Issue PR. Runtime, package manifests and lockfile contents are not changed by CMC-19.

### Verification

Run the repository validator, repository policy unit tests and `git diff --check` on the final head SHA. Confirm the diff contains only the declared documentation and Issue-spec paths. Record the post-merge Controller gate to synchronize live Issues #4, #5, #6, #8 and #9 before their Workers start.

### Constraints

Do not implement CMC-04, CMC-05, CMC-06, CMC-08 or CMC-09. Do not edit runtime, package manifests or `pnpm-lock.yaml`; do not alter architecture or safety invariants, edit live downstream Issues from the Worker, merge another Issue, release or publish.

## Русский

### Цель

Разблокировать оставшуюся очередь реализации v0.1: привести канонические touched paths всех задач, в плане которых явно фиксируется корневой pnpm lockfile, в соответствие с утверждёнными шагами реализации.

### Объём

Добавить CMC-19 в локальный канон Issues, roadmap, индекс промптов и журнал. Добавить только корневой путь `pnpm-lock.yaml` в CMC-04, CMC-05, CMC-06, CMC-08 и CMC-09, поскольку утверждённые шаги этих задач явно включают этот файл. Сделать локальную CMC-04 зависимой от этой Issue, сохранив dependency #3. Дополнить пять Worker-промптов проверкой frozen lockfile и требованием коммитить lockfile при изменении package manifests или закреплённых зависимостей. Не реализовывать runtime этих задач.

### Критерии приёмки

Пять локальных контрактов Issues разрешают `pnpm-lock.yaml`, не удаляя и не расширяя их существующие runtime paths и safety-ограничения. CMC-04 зависит от #3 и CMC-19; identity последующих зависимостей не меняется. Roadmap вставляет CMC-19 между CMC-03 и CMC-04 и синхронизирует критический путь. Каждый затронутый Worker-промпт требует `corepack pnpm install --frozen-lockfile`, подтверждает неизменность lockfile после frozen installation и включает требуемое изменение lockfile в PR той же Issue. CMC-19 не меняет runtime, package manifests и содержимое lockfile.

### Проверка

Запустить repository validator, unit tests repository policy и `git diff --check` на финальном head SHA. Подтвердить, что diff содержит только заявленные documentation и Issue-spec paths. Зафиксировать post-merge gate Controller: синхронизировать live Issues #4, #5, #6, #8 и #9 до запуска их Workers.

### Ограничения

Не реализовывать CMC-04, CMC-05, CMC-06, CMC-08 или CMC-09. Не менять runtime, package manifests или `pnpm-lock.yaml`; не менять архитектуру или safety-инварианты, не редактировать live downstream Issues из Worker, не сливать другую Issue, не выпускать release и не публиковать продукт.

```cto-issue
schema: 1
dependencies: #1
conflicts: none
touched_paths: .gitignore; .github/issue-specs/CMC-02.md; .github/issue-specs/CMC-17.md; docs/product/implementation-roadmap.md; docs/prompts/CMC-02-foundation.md; docs/prompts/CMC-17-generated-artifacts.md; docs/prompts/index.md; docs/log.md
risk: medium
parallel_safety: serial
execution_profile: default
```

## English

### Goal

Unblock CMC-02 by ignoring pnpm generated artifacts before the workspace installation is introduced.

### Scope

Add the root `node_modules/` ignore rule, record CMC-17 in the local Issue canon and prompt index, and make CMC-02 depend on this Issue. Do not create the TypeScript workspace itself.

### Acceptance criteria

Root and nested `node_modules` paths are ignored by Git. Local CMC-02 metadata and the live Issue include this dependency. Repository contracts pass and no runtime or package files are added.

### Verification

Run `git check-ignore --no-index node_modules/example packages/platform/node_modules/example`, the repository validator, its unit tests and `git diff --check` on the final head SHA.

### Constraints

Do not implement CMC-02, install dependencies, create generated artifacts, change architecture, merge another Issue, release or publish.

## Русский

### Цель

Разблокировать CMC-02, заранее исключив generated artifacts pnpm из Git.

### Объём

Добавить корневое правило `node_modules/`, зафиксировать CMC-17 в локальном каноне Issues и индексе промптов, а CMC-02 сделать зависимой от этой Issue. Сам TypeScript workspace не создавать.

### Критерии приёмки

Корневые и вложенные `node_modules` игнорируются Git. Локальная metadata CMC-02 и live Issue содержат новую зависимость. Контракты репозитория проходят; runtime и package-файлы не добавляются.

### Проверка

Запустить `git check-ignore --no-index node_modules/example packages/platform/node_modules/example`, repository validator, его unit tests и `git diff --check` на финальном head SHA.

### Ограничения

Не реализовывать CMC-02, не устанавливать зависимости, не создавать generated artifacts, не менять архитектуру, не сливать другую Issue, не выпускать release и не публиковать продукт.

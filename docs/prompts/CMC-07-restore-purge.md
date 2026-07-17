---
type: Worker Prompt
title: Промпт CMC-07 — restore и purge
description: Готовый вход Worker для безопасного восстановления и ручной очистки карантина.
tags: [prompt, worker, restore, purge, cmc-07]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker Issue CMC-07. Scope ограничен restore и purge внутри packages/quarantine и их tests. Не меняй classifier, UI, plugin manifests и не выполняй merge/release.

Прочитай AGENTS.md, docs/architecture/runtime-flows.md, docs/contracts/domain-model.md, docs/contracts/quarantine-manifest.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/safety/safety-model.md, docs/safety/path-policy.md, docs/quality/acceptance-gates.md и раздел CMC-07 плана. Dependency CMC-06 должна быть закрыта; Issue должна пройти validator.

Restore возвращает payload только в свободный исходный путь при существующем неизменном parent fingerprint. Нельзя создавать parent, перезаписывать объект или выбирать alternate destination. Используй same-volume atomic rename и проверяй metadata/xattrs. Move, restore и purge возвращают новый `stateVersion` и server-owned `StorageSummary`.

Purge только ручной, по одному manifest/payload, после отдельного preview token. Он работает строго внутри quarantine root, использует lstat traversal и не следует symlinks. Успешный purge увеличивает вычисленный по локальному журналу `purgedPhysicalBytes`; это не обещание точного изменения свободного места APFS. При ошибке запись карантина и сводка остаются неизменными. Автоматический TTL, bulk purge и «очистить всё» запрещены.

Сначала conflict/symlink и summary/purge-failure tests, затем реализация. Запусти полный quarantine suite и pnpm check. Открой PR и передай русский отчёт с Issue/PR, SHA, доказательствами и неполными manual gates; self-review и merge запрещены.
```

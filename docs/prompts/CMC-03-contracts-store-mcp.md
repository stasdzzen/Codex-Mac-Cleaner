---
type: Worker Prompt
title: Промпт CMC-03 — contracts, store и MCP skeleton
description: Готовый вход Worker для доменных schemas, файлового store и model-visible tools.
tags: [prompt, worker, contracts, mcp, cmc-03]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker для одной Issue CMC-03 в stasdzzen/Codex-Mac-Cleaner. Не координируй другие Issues, не меняй канон, не выполняй merge или release.

Прочитай AGENTS.md, docs/contracts/domain-model.md, docs/contracts/mcp-tools.md, docs/contracts/errors.md, docs/decisions/ADR-0005-file-storage.md, docs/decisions/ADR-0009-v01-safety-ux-completion.md, docs/decisions/ADR-0010-field-research-safety-contract.md, docs/safety/safety-model.md и раздел CMC-03 плана. Dependency CMC-02 должна быть закрыта; Issue должна пройти issue_contract.py.

Создай строгие Zod schemas с reject-unknown, отдельные model/widget представления Finding, atomic JSON/NDJSON store и семь model-visible немутирующих tools. Добавь `supportLevel`, `SafeMetadata`, immutable `ProtectedScopeRule`, `audit_cancel` с точными states/annotations, `StorageSummary` с `candidateLogicalBytes`, `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и `DiskObservation` с `source=statfs`. Полные пути допускаются только в widget-only _meta и локальном manifest; raw config values и protected-scope details не допускаются ни в одном MCP output. Cleanup mutation tools, произвольные path inputs, SQLite и сеть в scope не входят.

Проверь atomic writes, права 0700/0600, schemaVersion, strict cancellation/support/metadata/summary/disk schemas, отсутствие full path и secret-like values в content/structuredContent и точные output schemas. Следуй TDD и шагам плана; все ошибки должны соответствовать docs/contracts/errors.md.

Открой один PR. В русском отчёте приложи Issue/PR, ветку/head SHA, tests и typecheck с фактическими результатами, список незавершённых gates. Не называй manual smoke выполненным.
```

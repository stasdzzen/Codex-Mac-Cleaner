---
type: Worker Prompt
title: Промпт CMC-06 — quarantine transaction
description: Готовый вход Worker для preview, atomic move, journal и crash recovery.
tags: [prompt, worker, quarantine, recovery, cmc-06]
status: approved
owner: Architect
date: 2026-07-15
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-06. Работай только над packages/quarantine transaction и tests. Не реализуй restore/purge из CMC-07, UI, plugin packaging, merge или release.

Прочитай AGENTS.md, docs/architecture/runtime-flows.md, docs/contracts/quarantine-manifest.md, docs/contracts/errors.md, docs/safety/path-policy.md, docs/safety/threat-model.md и CMC-06 в пошаговом плане. Проверь закрытие CMC-05 и Issue contract.

Реализуй одноразовый пяти минутный preview token, object lock, server-side revalidation, durable prepared manifest, append-only journal и только same-volume rename в quarantine/<operation-id>/payload/object. Copy-delete, произвольный destination и follow-links запрещены.

Fault injection обязателен до manifest, после prepared, после rename и до journal append. Recovery сверяет source/payload и либо восстанавливает однозначный state, либо блокирует mutation. Повтор с тем же operationId идемпотентен.

Следуй TDD и выполни E2E, race, fault tests и pnpm check на synthetic temp trees. Открой один PR; отчёт по-русски с Issue/PR, SHA, командами/результатами и незавершёнными gates. Не проверяй и не принимай свой PR.
```

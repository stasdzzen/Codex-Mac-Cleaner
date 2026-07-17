---
type: Worker Prompt
title: Промпт CMC-12 — persistent exclusions
description: Готовый вход Worker для versioned identity-based exclusions и вкладки управления.
tags: [prompt, worker, exclusions, state, cmc-12]
status: approved
owner: Architect
date: 2026-07-17
---

# Готовый промпт

```text
Ты Worker high-risk Issue CMC-12. Работай только над versioned exclusions, identity matcher, exclusion tools и вкладкой «Исключения». Не меняй protected classes, quarantine semantics, schedule, plugin distribution и не выполняй merge/release.

Прочитай AGENTS.md, ADR-0011, domain-model, MCP contract, safety model, path policy, test strategy и раздел CMC-12 плана дополнений. CMC-07 и CMC-08 должны быть закрыты; валидируй Issue.

Следуй TDD. Реализуй UserExclusionSchema, sequential migrations, atomic state в user Application Support с 0700/0600, stable identity matcher без path-only equality, filtering до дорогого анализа и повторную проверку перед token issuance. Excluded finding возвращает EXCLUDED_FINDING; identity mismatch снова показывает finding. Unknown/corrupt schema не скрывает findings и блокирует destructive-token issuance.

Добавь app-visible exclusion_create/list/remove/reset_prepare/reset с reject-unknown inputs без path/identity fields. Вкладка поддерживает search/filter, дату, reason, «Снова проверять», удаление одной записи и подтверждаемый reset all. Model-visible output содержит только excludedCount.

Запусти точные contract/storage/policy/server/widget/security tests и pnpm check. Открой один PR. Русский отчёт: Issue/PR, branch/head SHA, migration matrix, permission checks, identity mismatch, negative mutation result и открытые gates. Не проверяй собственный PR.
```

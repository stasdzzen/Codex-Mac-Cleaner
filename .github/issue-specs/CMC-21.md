```cto-issue
schema: 1
dependencies: #35, #39
conflicts: none
touched_paths: packages/contracts/; packages/adapters/; packages/evidence/; packages/classifier/; packages/policy/; packages/storage/; tests/security/; pnpm-lock.yaml
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Continue the existing core server-owned correlation/evidence resolver under ADR-0012 and ADR-0013 so a real user-Library cache/log artifact can safely reach one-object quarantine, while the existing CMC-09 integration remains paused until this Issue merges.

### Scope

Preserve the existing Issue #36 task/worktree/branch/PR #38 and revise its implementation to separate `library_artifact` from `owner_application`. Add authoritative `remnant_of` bindings, receipt lifecycle, canonical owner/uninstaller inventories, installation-keyed historical binding, server-owned requirement profiles/applicability and production Library integration. Keep versioned correlation subjects/edges, provenance, completeness certificates, Snapshot A/B revisions, safe views and keyed UserExclusion recovery. Do not wire the MCP App or packaged plugin in this Issue.

### Acceptance criteria

Only exact receipt payload mapping, OS-owned individual-container metadata or validated installation-local signed process/open-file history can create an authoritative owner binding; path/name/bundle-only hints and user attestation cannot. Artifact existence and owner app/executable lifecycle are separate. Receipt lifecycle is `live | stale | absent | unknown`. Only server-owned `private_regenerable_remnant_v1` may make private regenerable `cache | log` actionable; all other v0.1 Library categories remain inspect-only. `not_applicable` is not `absent`, cannot replace a failed query and never suppresses positive evidence. A production-adapter synthetic `~/Library/Caches` or `~/Library/Logs` artifact reaches `prepare_move` only with authoritative binding, complete required evidence and stable A/B; incomplete/ambiguous/mismatch/stale and all counter-evidence fail closed. UserExclusion migration and all privacy invariants remain intact.

### Verification

Run focused contracts/adapters/evidence/classifier/policy/storage tests, owner-binding/receipt/profile/applicability/coverage matrices, migration/rekey/dictionary-attack/privacy tests, security tests, root `pnpm check`, repository validator, repository policy tests and `git diff --check` on one final head SHA. Prove through production adapters—not an `.app` candidate fixture—that a generated user-Library cache/log can feed audit → prepare → move → restore, while every non-actionable category and evidence gap remains inspect-only/fail-closed.

### Constraints

Do not modify apps/mcp-server, the widget, `.codex-plugin`, `.mcp.json`, Skill or PR #34. Do not create another CMC-09 Worker/worktree/branch/PR, perform real-Mac cleanup, merge, release, tag, publish, add telemetry/network transport or weaken protected scopes, quarantine, one-object confirmation and no-terminal flow.

## Русский

### Цель

Продолжить существующий core server-owned correlation/evidence resolver по ADR-0012 и ADR-0013, чтобы реальный user-Library cache/log artifact мог безопасно дойти до пообъектного карантина, а существующая интеграция CMC-09 оставалась приостановленной до merge этой Issue.

### Объём

Сохранить существующие задачу #36, worktree, ветку и PR #38 и исправить реализацию: разделить `library_artifact` и `owner_application`; добавить authoritative `remnant_of`, receipt lifecycle, канонические owner/uninstaller inventories, installation-keyed historical binding, server-owned requirement profiles/applicability и production Library integration. Сохранить versioned subjects/edges, provenance, completeness certificates, Snapshot A/B revisions, safe views и recovery keyed UserExclusion. Не выполнять wiring MCP App или packaged plugin.

### Критерии приёмки

Только exact receipt payload mapping, OS-owned metadata отдельного container или валидная installation-local signed process/open-file history создают authoritative owner binding; path/name/bundle-only hints и user attestation не могут. Artifact existence и lifecycle owner app/executable раздельны. Receipt lifecycle: `live | stale | absent | unknown`. Только server-owned `private_regenerable_remnant_v1` может сделать приватный регенерируемый `cache | log` actionable; остальные Library categories v0.1 остаются inspect-only. `not_applicable` не является `absent`, не заменяет failed query и не подавляет positive evidence. Синтетический `~/Library/Caches` или `~/Library/Logs` artifact через production adapters достигает `prepare_move` только при authoritative binding, полном required evidence и стабильных A/B; incomplete/ambiguous/mismatch/stale и counter-evidence блокируют действие. Recovery UserExclusion и все privacy-инварианты сохраняются.

### Проверка

Запустить focused tests contracts/adapters/evidence/classifier/policy/storage, матрицы owner-binding/receipt/profile/applicability/coverage, migration/rekey/dictionary-attack/privacy tests, security tests, корневой `pnpm check`, repository validator, repository policy tests и `git diff --check` на одном финальном head SHA. Через production adapters, а не `.app` candidate fixture, доказать generated user-Library cache/log → audit → prepare → move → restore; все остальные categories и evidence gaps должны остаться inspect-only/fail-closed.

### Ограничения

Не менять apps/mcp-server, widget, `.codex-plugin`, `.mcp.json`, Skill или PR #34. Не создавать другой CMC-09 Worker/worktree/branch/PR, не выполнять реальную очистку Mac, merge, release, tag, публикацию, не добавлять telemetry/network transport и не ослаблять protected scopes, quarantine, one-object confirmation и no-terminal flow.

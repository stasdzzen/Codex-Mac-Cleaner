```cto-issue
schema: 1
dependencies: #35
conflicts: none
touched_paths: packages/contracts/; packages/adapters/; packages/evidence/; packages/classifier/; packages/policy/; packages/storage/; tests/security/; pnpm-lock.yaml
risk: high
parallel_safety: serial
execution_profile: deep
```

## English

### Goal

Implement the core server-owned correlation/evidence resolver approved by ADR-0012 so candidate-specific counter-evidence and negative evidence are safe, deterministic and usable by the existing CMC-09 integration after this Issue merges.

### Scope

Add versioned correlation subjects/edges, ephemeral raw-identity claims, source provenance, completeness certificates, Snapshot A/B correlation revisions and safe views across contracts, adapters and evidence. Integrate fail-closed correlation states into classifier/policy. Migrate UserExclusion persistence to installation-keyed domain-separated digests with recovery/versioning. Add deterministic synthetic builders, privacy canaries and core integration tests. Do not wire the MCP App or packaged plugin in this Issue.

### Acceptance criteria

Path-only, basename, display-name and any single bundle/package/signing/owner claim cannot resolve ownership or enable mutation. Bundle/package/signing/owner/filesystem rules return `resolved`, `ambiguous`, `missing` or `mismatch` deterministically. `absent` is emitted only with full source coverage and a completed same-snapshot query; permission/capability gaps, partial inventory, parse loss, cancellation and ambiguous/missing/mismatch states return `unknown`. Positive installed-app, process, open-file, startup, receipt, uninstaller and dependency evidence remains blocking counter-evidence. Snapshot A/B changes set `staleDuringAudit`, change the immutable correlation revision and invalidate actions. UserExclusion uses an installation-local keyed digest rather than plaintext, plain hash or public salt; known migrations are atomic, while unknown schema, missing key and ambiguous migration keep findings visible and block token issuance. Safe views and test outputs contain no raw path, inventory, bundle/package/signing identity, token or personal data.

### Verification

Run focused contracts/adapters/evidence/classifier/policy/storage tests, deterministic correlation and coverage matrices, migration/rekey/dictionary-attack/privacy tests, security tests, root `pnpm check`, repository validator, repository policy tests and `git diff --check` on one final head SHA. Prove the core integration harness can feed a future packaged stdio audit → prepare → move → restore E2E without exposing raw identities.

### Constraints

Do not modify apps/mcp-server, the widget, `.codex-plugin`, `.mcp.json`, Skill or PR #34. Do not create another CMC-09 Worker/worktree/branch/PR, perform real-Mac cleanup, merge, release, tag, publish, add telemetry/network transport or weaken protected scopes, quarantine, one-object confirmation and no-terminal flow.

## Русский

### Цель

Реализовать утверждённый ADR-0012 core server-owned correlation/evidence resolver, чтобы candidate-specific counter-evidence и negative evidence стали безопасными, детерминированными и пригодными для существующей интеграции CMC-09 после merge этой Issue.

### Объём

Добавить versioned correlation subjects/edges, ephemeral raw-identity claims, source provenance, completeness certificates, Snapshot A/B correlation revisions и safe views в contracts, adapters и evidence. Интегрировать fail-closed correlation states в classifier/policy. Перевести persistence UserExclusion на installation-keyed domain-separated digests с recovery/versioning. Добавить deterministic synthetic builders, privacy canaries и core integration tests. Не выполнять wiring MCP App или packaged plugin в этой Issue.

### Критерии приёмки

Path-only, basename, display-name и один bundle/package/signing/owner claim не могут разрешить ownership или mutation. Правила bundle/package/signing/owner/filesystem детерминированно возвращают `resolved`, `ambiguous`, `missing` или `mismatch`. `absent` выпускается только при полном source coverage и завершённом same-snapshot query; permission/capability gaps, partial inventory, parse loss, cancellation и ambiguous/missing/mismatch дают `unknown`. Positive installed-app, process, open-file, startup, receipt, uninstaller и dependency evidence остаются блокирующими counter-evidence. Изменение Snapshot A/B выставляет `staleDuringAudit`, меняет immutable correlation revision и инвалидирует actions. UserExclusion использует installation-local keyed digest вместо plaintext, plain hash или public salt; известные migrations атомарны, а unknown schema, missing key и ambiguous migration оставляют findings видимыми и блокируют token issuance. Safe views и test outputs не содержат raw path, inventory, bundle/package/signing identity, token или personal data.

### Проверка

Запустить focused tests contracts/adapters/evidence/classifier/policy/storage, deterministic correlation/coverage matrices, migration/rekey/dictionary-attack/privacy tests, security tests, корневой `pnpm check`, repository validator, repository policy tests и `git diff --check` на одном финальном head SHA. Доказать, что core integration harness может питать будущий packaged stdio E2E audit → prepare → move → restore без раскрытия raw identities.

### Ограничения

Не менять apps/mcp-server, widget, `.codex-plugin`, `.mcp.json`, Skill или PR #34. Не создавать другой CMC-09 Worker/worktree/branch/PR, не выполнять реальную очистку Mac, merge, release, tag, публикацию, не добавлять telemetry/network transport и не ослаблять protected scopes, quarantine, one-object confirmation и no-terminal flow.

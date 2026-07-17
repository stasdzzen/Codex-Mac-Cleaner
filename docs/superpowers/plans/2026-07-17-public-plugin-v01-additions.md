---
type: Implementation Plan
title: План дополнений публичного Codex Mac Cleaner
description: TDD-план persistent exclusions, Codex scheduling и заблокированных исследований после v0.1.
tags: [implementation, public-plugin, exclusions, scheduling, research]
status: approved
owner: Architect
date: 2026-07-17
---

# Назначение

Этот план продолжает [базовый план v0.1](2026-07-15-codex-mac-cleaner-v01.md). Он не разрешает запуск Issues автоматически. Каждый Worker выполняет только свою GitHub Issue в отдельном worktree/branch/PR и использует `superpowers:test-driven-development`.

# Общие ограничения

* Публичный runtime не содержит персональных app/path rules, username и real-Mac inventory.
* Exclusion не ослабляет `ProtectedScopeRule` и не разрешает mutation.
* Schedule выключен по умолчанию и никогда не создаёт cron, LaunchAgent или automatic cleanup.
* MCP App не вызывает host-native automation напрямую.
* Все fixtures используют synthetic identity, signing data, paths и timestamps.
* Release, tag, merge, publication и real-Mac mutation не входят в эти задачи.

---

## `CMC-12` — persistent exclusions и вкладка управления

**Зависимости:** закрытые `CMC-07` и `CMC-08`.

**Создать или изменить:**

* `packages/contracts/src/user-exclusion.ts`;
* `packages/storage/src/versioned-state-store.ts`;
* `packages/policy/src/exclusion-matcher.ts`;
* `apps/mcp-server/src/tools/exclusions.ts`;
* `apps/widget/src/components/exclusions-tab.tsx`;
* `packages/storage/test/exclusion-migrations.test.ts`;
* `packages/policy/test/exclusion-matcher.test.ts`;
* `apps/mcp-server/test/exclusion-tools.test.ts`;
* `apps/widget/test/exclusions-tab.test.tsx`;
* `tests/security/excluded-finding.test.ts`.

### RED

Сначала зафиксировать падающие tests:

```ts
it("сохраняет exclusion после перезапуска", async () => {
  const first = await createSyntheticServer();
  await first.exclusions.create({ findingId: "finding-a", auditRevision: 3, requestId: "r1" });
  const second = await createSyntheticServer({ stateRoot: first.stateRoot });
  expect(await second.exclusions.list()).toHaveLength(1);
});

it("не совпадает с другим объектом по прежнему path", () => {
  const exclusion = syntheticExclusion({ ownerTypeFingerprint: "owner-a:file" });
  const replacement = syntheticIdentity({ ownerTypeFingerprint: "owner-b:directory" });
  expect(matchExclusion(exclusion, replacement)).toEqual({ matched: false, reason: "identity_mismatch" });
});

it("не выдаёт preview исключённому finding", async () => {
  await expect(prepareExcludedFinding()).rejects.toMatchObject({ errorCode: "EXCLUDED_FINDING" });
});

it("не скрывает finding при неизвестной schema", async () => {
  const result = await auditWithUnknownExclusionSchema();
  expect(result.findings).toHaveLength(1);
  expect(result.tokenIssuance).toBe("blocked");
});
```

UI tests до реализации проверяют «Исключить», persistence после remount, «Снова проверять», search/filter, удаление одной записи, отдельное подтверждение reset all и отсутствие raw path в bridge calls.

### GREEN

1. Реализовать reject-unknown `UserExclusionSchema` и последовательные migrations от каждой поддержанной версии к текущей.
2. Создать state root `~/Library/Application Support/Codex Mac Cleaner/state` с `0700`; `exclusions.json` — `0600`, temp + `fsync` + atomic rename.
3. Identity matcher сравнивает `ruleId`, `artifactKind`, `normalizedTargetIdentity`, применимые bundle/package IDs, signing identity и owner/type fingerprint. Path-only equality не используется.
4. В Audit Coordinator выполнять minimal identity discovery, затем фильтровать matched exclusions до дорогих adapters. Возвращать только `excludedCount`.
5. Перед любым preview повторно проверять exclusion store. Matched finding получает `EXCLUDED_FINDING`.
6. Добавить app-visible `exclusion_create/list/remove/reset_prepare/reset`. Inputs принимают только server IDs и reject unknown fields.
7. Реализовать вкладку «Исключения». Reset all использует одноразовый token и отдельный `AlertDialog`.

### VERIFY

```bash
pnpm --filter @codex-mac-cleaner/contracts test
pnpm --filter @codex-mac-cleaner/storage test
pnpm --filter @codex-mac-cleaner/policy test
pnpm --filter @codex-mac-cleaner/mcp-server test
pnpm --filter @codex-mac-cleaner/widget test
pnpm test -- tests/security/excluded-finding.test.ts
pnpm check
git diff --check
```

PR evidence содержит final head SHA, migration matrix, permission assertions, identity mismatch и negative mutation result. Реальные paths и identities отсутствуют.

---

## `CMC-13` — capability-aware ежемесячный аудит

**Зависимость:** закрытая `CMC-09`.

**Создать или изменить:**

* `packages/contracts/src/schedule.ts`;
* `packages/storage/src/schedule-store.ts`;
* `apps/mcp-server/src/tools/schedule.ts`;
* `apps/widget/src/components/schedule-tab.tsx`;
* `skills/codex-mac-cleaner/references/scheduled-audit.md`;
* `packages/storage/test/schedule-store.test.ts`;
* `apps/mcp-server/test/schedule-intent.test.ts`;
* `apps/widget/test/schedule-tab.test.tsx`;
* `tests/plugin/scheduled-audit.test.ts`.

### RED

```ts
it("не включает расписание по умолчанию", async () => {
  expect(await scheduleState()).toMatchObject({ enabled: false, automationId: null });
});

it("обновляет одну automation без дубликата", async () => {
  const first = await enableMonthlySchedule({ day: 7, time: "10:00" });
  const second = await enableMonthlySchedule({ day: 14, time: "11:30" });
  expect(second.automationId).toBe(first.automationId);
  expect(hostAutomationCalls()).toEqual(["create", "update"]);
});

it("при отсутствии capability не создаёт системный scheduler", async () => {
  const result = await enableWithoutCapability();
  expect(result.errorCode).toBe("AUTOMATION_CAPABILITY_UNAVAILABLE");
  expect(systemSchedulerWrites()).toHaveLength(0);
});

it("scheduled prompt остаётся read-only", () => {
  expect(renderScheduledPrompt()).not.toMatch(/sudo|quarantine_move|quarantine_purge|shell/i);
});
```

UI tests проверяют финальную карточку «Напоминать проверять Mac раз в месяц», кнопки «Включить ежемесячную проверку», «Настроить», «Не сейчас», вкладку «Расписание», next/last run, update/pause/resume/delete и отсутствие raw RRULE.

### GREEN

1. Реализовать `ScheduleIntent`/`ScheduleState` schemas и versioned atomic `schedule.json` с `0600`.
2. `schedule_request` создаёт только intent. `schedule_intent_get` отдаёт Skill безопасные action/day/time и current opaque automation ID. `schedule_intent_complete` принимает outcome только для pending intent.
3. Skill проверяет доступность host-native Codex automation capability и показывает подтверждение. MCP App не вызывает host tool.
4. Create сохраняет один opaque automation ID. Повторный enable выполняет update; pause/resume/delete используют существующий ID. Конфликт возвращает `SCHEDULE_CONFLICT`.
5. Capability unavailable завершает intent предупреждением и оставляет schedule disabled. Не создавать cron, LaunchAgent или скрытый fallback.
6. Scheduled prompt запускает `application_remnants`, применяет exclusions, сообщает count и `ReclaimEstimate`, предлагает открыть Dashboard и не вызывает mutation.

### VERIFY

```bash
pnpm --filter @codex-mac-cleaner/contracts test
pnpm --filter @codex-mac-cleaner/storage test
pnpm --filter @codex-mac-cleaner/mcp-server test
pnpm --filter @codex-mac-cleaner/widget test
pnpm test -- tests/plugin/scheduled-audit.test.ts
pnpm check
git diff --check
```

Если automation capability невозможно вызвать в clean-room среде, automated contract/fallback tests всё равно обязательны, а real host smoke остаётся незавершённым owner gate. Нельзя заменять его ложным completion claim.

---

## `CMC-14` — Advanced Cleanup v0.2 research

**Статус:** `cto:blocked`. Не запускать до закрытия `CMC-10`, отдельного owner approval и назначения Архитектора.

Результат Issue — только research/spec/ADR proposal для trusted privileged helper и read-only detector matrix: relocated items, system frameworks, helpers, daemons, missing executables, printer/VPN remnants, TCP listeners, Homebrew services, cron, StartupItems, system extensions и Time Machine snapshots.

Запрещены runtime implementation, `sudo`, TCC bypass, LaunchDaemon installation и system mutation. Definition of Done — threat model, trust boundary, entitlement/signing plan, rollback model, test strategy и отдельные implementation slices, а не работающий cleaner.

---

## `CMC-15` — Browser/Developer Storage profiles v0.2 research

**Статус:** `cto:blocked`. Не запускать до закрытия `CMC-10`, отдельного owner approval и новых threat models.

Результат Issue — только research/spec/ADR proposals для раздельных профилей browser storage и developer storage. Матрица покрывает on-device AI models, обычные browser caches, Service Worker CacheStorage и offline data, SDK/runtimes, package-manager caches, duplicate versions и consumer Android emulators отдельно от Android SDK.

Запрещены runtime implementation, сканирование personal browser profiles, cookies/passwords/bookmarks, удаление active/open caches и скрытое расширение `application_remnants`.

# Финальная самопроверка

* `CMC-12` и `CMC-13` входят в release-blocking v0.1 chain.
* `CMC-14` и `CMC-15` остаются future research и `cto:blocked`.
* `CMC-10` зависит от `CMC-13` и проверяет все новые contracts.
* Ни одна Issue не получает release, merge или publication authority.

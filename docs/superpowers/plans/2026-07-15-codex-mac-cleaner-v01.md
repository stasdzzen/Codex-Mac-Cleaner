---
type: Implementation Plan
title: План реализации Codex Mac Cleaner v0.1
description: Пошаговый TDD-план для десяти GitHub Issues с точными файлами, интерфейсами и проверками.
tags: [implementation, plan, tdd, workers]
status: approved
owner: Architect
date: 2026-07-15
updated: 2026-07-17
---

# План реализации Codex Mac Cleaner v0.1

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЕ НАВЫКИ — `superpowers:test-driven-development` и один из `superpowers:subagent-driven-development` (рекомендуется для Controller) или `superpowers:executing-plans` (для назначенного Worker). Выполняйте план строго по задачам; шаги используют `- [ ]` для отслеживания.

**Цель:** собрать локальный Codex-плагин, который безопасно аудирует остатки приложений и выполняет поэлементный quarantine, restore и purge по серверной policy.

**Архитектура:** pnpm workspace разделяет локальный MCP-сервер, React widget и сфокусированные packages. Read-only audit pipeline отделён от mutation-контура; общие Zod schemas являются единственным контрактом между сервером и UI. Файловые операции работают только с server-generated identifiers и fail closed.

**Стек:** Node.js 24 LTS, pnpm 11.13.0, TypeScript 7.0.2, MCP TypeScript SDK 1.29.0, Zod 4.4.3, Vitest 4.1.10, fast-check 4.9.0, React 19.2.7, Vite 8.1.3, shadcn CLI 4.13.0, Tailwind CSS 4.3.2.

## Глобальные ограничения

* Целевая платформа: macOS 26 и новее, только Apple Silicon `arm64`.
* Профиль v0.1: только `application_remnants`; developer cleanup исключён.
* Full Disk Access необязателен; пробел покрытия — структурированный результат.
* Модель и UI не передают произвольные пути в mutation-tools.
* Только server policy вычисляет `allowedActions`.
* `audit_cancel` кооперативно завершает аудит; частичный отчёт `cancelled` всегда read-only и имеет пустые `allowedActions`.
* Quarantine — same-volume atomic rename одного объекта после durable `prepared` manifest.
* Restore — только исходный свободный путь при неизменном родителе.
* Purge — только ручной и поэлементный; bulk selection, «Очистить всё» и автоматического срока нет.
* Dashboard имеет три вкладки: «Обзор», «Находки», «Карантин».
* Сервер вычисляет `candidatePhysicalBytes`, `quarantinePhysicalBytes` и `purgedPhysicalBytes`; UI не пересчитывает их и не выдаёт `purgedPhysicalBytes` за точное изменение свободного места APFS.
* Полные пути не попадают в model-visible ответы или обычные логи.
* Нет Swift, `sudo`, privileged helper, SQLite, сети и телеметрии.
* Каждый Worker читает `AGENTS.md`, свою Issue и связанные документы канона.
* Commit message, PR и отчёт Worker пишутся на русском языке.
* Каждый workspace package имеет имя `@codex-mac-cleaner/<имя-каталога>`, `private: true`, `type: module`, собственный `tsconfig.json` и scripts `typecheck`/`test`; server и widget дополнительно имеют `build`.
* Внешняя dependency объявляется в том package, который её импортирует; неявное использование root dependency запрещено.

---

### Задача 1: `CMC-01` — нормализация Apache-2.0

**Предусловие:** прямое разрешение владельца на legal action и label `cto:ready`.

**Файлы:**

* Изменить: `LICENSE`
* Изменить: `README.md`
* Проверить: `docs/decisions/ADR-0008-apache-license.md`

**Интерфейсы:**

* Использует: ADR-0008 и официальный текст Apache License 2.0.
* Создаёт: согласованную лицензионную границу для всех следующих задач.

- [ ] **Шаг 1: зафиксировать падающую проверку текущей лицензии**

Запустить:

```bash
rg -n '^Apache License$|^Version 2\.0, January 2004$' LICENSE
```

Ожидаемый результат до изменения: exit code `1`, совпадений нет.

- [ ] **Шаг 2: заменить лицензию точным официальным текстом**

Использовать текст без сокращений из `https://www.apache.org/licenses/LICENSE-2.0.txt`. Сохранить строку copyright проекта только там, где это допускает выбранная форма уведомления; не создавать пустой `NOTICE`.

- [ ] **Шаг 3: синхронизировать README**

Раздел должен содержать:

```markdown
## Лицензия

Проект распространяется по Apache License 2.0. Полный текст находится в [LICENSE](LICENSE).
```

- [ ] **Шаг 4: проверить результат**

Запустить:

```bash
rg -n '^Apache License$|^Version 2\.0, January 2004$' LICENSE
git diff --check
```

Ожидаемый результат: две строки лицензии найдены; `git diff --check` завершается с exit code `0`.

- [ ] **Шаг 5: зафиксировать изменение**

```bash
git add LICENSE README.md
git commit -m "docs: перейти на лицензию Apache-2.0"
```

### Задача 2: `CMC-02` — workspace и platform guard

**Файлы:**

* Создать: `package.json`
* Создать: `pnpm-workspace.yaml`
* Создать: `tsconfig.base.json`
* Создать: `tsconfig.json`
* Создать: `packages/platform/package.json`
* Создать: `packages/platform/tsconfig.json`
* Создать: `packages/platform/src/assert-supported-platform.ts`
* Создать: `packages/platform/test/assert-supported-platform.test.ts`

**Интерфейсы:**

* Использует: закрытый `CMC-01`.
* Создаёт: `assertSupportedPlatform(input: PlatformInput): void`, общие scripts `typecheck`, `test`, `check`.

- [ ] **Шаг 1: создать падающий platform test**

```ts
import { describe, expect, it } from "vitest";
import { assertSupportedPlatform } from "../src/assert-supported-platform.js";

describe("assertSupportedPlatform", () => {
  it("принимает только darwin arm64 с major 26 или выше", () => {
    expect(() => assertSupportedPlatform({ platform: "darwin", arch: "arm64", release: "26.0.0" })).not.toThrow();
    expect(() => assertSupportedPlatform({ platform: "darwin", arch: "x64", release: "26.0.0" })).toThrow("UNSUPPORTED_ARCH");
    expect(() => assertSupportedPlatform({ platform: "darwin", arch: "arm64", release: "25.9.0" })).toThrow("UNSUPPORTED_MACOS");
    expect(() => assertSupportedPlatform({ platform: "linux", arch: "arm64", release: "26.0.0" })).toThrow("UNSUPPORTED_PLATFORM");
  });
});
```

- [ ] **Шаг 2: создать точный root workspace**

`package.json`:

```json
{
  "name": "codex-mac-cleaner",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.13.0",
  "engines": { "node": ">=24.18.0 <25" },
  "scripts": {
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "check": "pnpm typecheck && pnpm test"
  },
  "devDependencies": {
    "fast-check": "4.9.0",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": false
  }
}
```

`packages/platform/package.json`:

```json
{
  "name": "@codex-mac-cleaner/platform",
  "private": true,
  "type": "module",
  "exports": "./src/assert-supported-platform.ts",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run test"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Root `tsconfig.json` не компилирует исходники сам; typecheck выполняют package configs, чтобы границы зависимостей оставались явными:

```json
{
  "extends": "./tsconfig.base.json",
  "files": []
}
```

`packages/platform/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Шаг 3: реализовать guard без чтения global state**

```ts
export interface PlatformInput {
  platform: string;
  arch: string;
  release: string;
}

export function assertSupportedPlatform(input: PlatformInput): void {
  if (input.platform !== "darwin") throw new Error("UNSUPPORTED_PLATFORM");
  if (input.arch !== "arm64") throw new Error("UNSUPPORTED_ARCH");
  const major = Number.parseInt(input.release.split(".")[0] ?? "", 10);
  if (!Number.isInteger(major) || major < 26) throw new Error("UNSUPPORTED_MACOS");
}
```

- [ ] **Шаг 4: установить lockfile и проверить**

```bash
corepack enable
pnpm install --frozen-lockfile=false
pnpm --filter @codex-mac-cleaner/platform test
pnpm check
```

Ожидаемый результат: четыре assertions проходят; typecheck и tests завершаются с exit code `0`.

- [ ] **Шаг 5: commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json packages/platform
git commit -m "build: добавить workspace и проверку платформы"
```

### Задача 3: `CMC-03` — contracts, local store и model-visible MCP skeleton

**Файлы:**

* Создать: `packages/contracts/src/audit.ts`
* Создать: `packages/contracts/src/finding.ts`
* Создать: `packages/contracts/src/errors.ts`
* Создать: `packages/contracts/src/tools.ts`
* Создать: `packages/contracts/src/storage-summary.ts`
* Создать: `packages/storage/src/json-store.ts`
* Создать: `apps/mcp-server/src/server.ts`
* Создать: `packages/contracts/test/contracts.test.ts`
* Создать: `apps/mcp-server/test/audit-cancel-schema.test.ts`
* Создать: `packages/storage/test/json-store.test.ts`
* Создать: `packages/contracts/package.json`
* Создать: `packages/storage/package.json`
* Создать: `apps/mcp-server/package.json`

**Интерфейсы:**

* Использует: `assertSupportedPlatform` из `CMC-02`.
* Создаёт: Zod schemas `AuditRunSchema`, `AuditCancelInputSchema`, `StorageSummarySchema`, `FindingSchema`, `ToolErrorSchema`; `JsonStore`; семь model-visible немутирующих tools.

- [ ] **Шаг 1: написать contract tests**

```ts
import { expect, it } from "vitest";
import {
  AuditCancelInputSchema,
  AuditRunStateSchema,
  AuditStartInputSchema,
  FindingSchema,
  StorageSummarySchema
} from "../src/index.js";

const findingFixture = {
  model: {
    findingId: "finding-1",
    displayName: "Старый кэш",
    category: "cache",
    physicalSize: 42,
    label: "orphaned",
    confidence: "high",
    risk: "low",
    allowedActions: ["inspect"]
  },
  widget: {
    canonicalPath: "/synthetic/Library/Caches/com.example.old",
    evidence: []
  }
};

it("отклоняет неизвестные поля audit_start", () => {
  expect(() => AuditStartInputSchema.parse({ requestId: "r1", profile: "application_remnants", path: "/tmp" })).toThrow();
});

it("не включает canonicalPath в model-visible finding", () => {
  const finding = FindingSchema.parse(findingFixture);
  expect(finding.model).not.toHaveProperty("canonicalPath");
  expect(finding.widget.canonicalPath).toBe("/synthetic/Library/Caches/com.example.old");
});

it("отклоняет произвольный path в audit_cancel", () => {
  expect(() => AuditCancelInputSchema.parse({ auditId: "a1", requestId: "r2", path: "/tmp" })).toThrow();
});

it("принимает terminal state cancelled и неотрицательную server summary", () => {
  expect(AuditRunStateSchema.parse("cancelled")).toBe("cancelled");
  expect(StorageSummarySchema.parse({
    candidatePhysicalBytes: 42,
    quarantinePhysicalBytes: 10,
    purgedPhysicalBytes: 7,
    stateVersion: 3
  })).toEqual(expect.objectContaining({ purgedPhysicalBytes: 7 }));
});
```

Package manifests фиксируют `zod: 4.4.3` в contracts и `@modelcontextprotocol/sdk: 1.29.0`, `zod: 4.4.3`, `@codex-mac-cleaner/contracts: workspace:*`, `@codex-mac-cleaner/storage: workspace:*`, `@codex-mac-cleaner/platform: workspace:*` в MCP server.

- [ ] **Шаг 2: запустить тест и получить ожидаемый FAIL**

```bash
pnpm --filter @codex-mac-cleaner/contracts test
```

Ожидаемый результат: FAIL из-за отсутствующих exports.

- [ ] **Шаг 3: определить строгие schemas**

```ts
import { z } from "zod";

export const AuditStartInputSchema = z.object({
  requestId: z.string().min(1),
  profile: z.literal("application_remnants")
}).strict();

export const AuditCancelInputSchema = z.object({
  auditId: z.string().min(1),
  requestId: z.string().min(1)
}).strict();

export const AuditRunStateSchema = z.enum([
  "queued", "running", "cancelling", "cancelled",
  "completed", "completed_with_warnings", "failed"
]);

export const StorageSummarySchema = z.object({
  candidatePhysicalBytes: z.number().int().nonnegative().safe(),
  quarantinePhysicalBytes: z.number().int().nonnegative().safe(),
  purgedPhysicalBytes: z.number().int().nonnegative().safe(),
  stateVersion: z.number().int().nonnegative().safe()
}).strict();

export const AllowedActionSchema = z.enum([
  "inspect", "reveal", "prepare_move", "prepare_restore", "prepare_purge"
]);

export const ToolErrorSchema = z.object({
  errorCode: z.string().min(1),
  severity: z.enum(["warning", "blocking", "fatal"]),
  scope: z.string().min(1),
  message: z.string().min(1),
  recommendedAction: z.string().min(1),
  retryable: z.boolean(),
  correlationId: z.string().min(1)
}).strict();
```

`FindingSchema` хранит полный путь только в `widget`; `model` содержит `findingId`, display name, категорию, размеры, label, confidence, risk и actions. `AuditRunSchema` принимает `cancelling` и `cancelled`; только `completed`/`completed_with_warnings` могут образовать actionable revision, а cancelled findings имеют пустые `allowedActions`.

- [ ] **Шаг 4: реализовать atomic JSON/NDJSON store и model-visible tools**

`JsonStore.writeJsonAtomic` пишет файл во временный sibling, вызывает `fsync`, затем `rename`. `appendEvent` открывает журнал с mode `0o600`, добавляет одну JSON-строку и вызывает `fsync`. `apps/mcp-server/src/server.ts` регистрирует `audit_start`, `audit_status`, `audit_cancel`, `audit_results`, `dashboard_open`, `finding_inspect`, `finding_reveal`; cleanup mutation-tools в этой задаче отсутствуют. Для `audit_cancel` зафиксировать `readOnlyHint=false`, `destructiveHint=false`, `idempotentHint=true`, `openWorldHint=false`.

Запустить:

```bash
pnpm --filter @codex-mac-cleaner/contracts test
pnpm --filter @codex-mac-cleaner/storage test
pnpm check
```

Ожидаемый результат: schema, permission и atomic-write tests проходят.

- [ ] **Шаг 5: commit**

```bash
git add apps/mcp-server packages/contracts packages/storage pnpm-lock.yaml
git commit -m "feat: добавить контракты аудита и локальное хранилище"
```

### Задача 4: `CMC-04` — source adapters и capability report

**Файлы:**

* Создать: `packages/adapters/src/types.ts`
* Создать: `packages/adapters/src/installed-apps.ts`
* Создать: `packages/adapters/src/library-roots.ts`
* Создать: `packages/adapters/src/processes.ts`
* Создать: `packages/adapters/src/autostart.ts`
* Создать: `packages/adapters/src/receipts.ts`
* Создать: `packages/adapters/src/filesystem-metadata.ts`
* Создать: `packages/adapters/src/coordinator.ts`
* Создать: `packages/adapters/test/fixtures/`
* Создать: `packages/adapters/test/coordinator.test.ts`

**Интерфейсы:**

* Использует: contracts и `JsonStore` из `CMC-03`.
* Создаёт: `SourceAdapter`, `Observation`, `AdapterWarning`, `CapabilityReport`, кооперативную отмену через `AbortSignal`.

- [ ] **Шаг 1: написать fixture test ошибки доступа**

```ts
it("превращает EACCES одного adapter в coverage warning", async () => {
  const result = await runAdapters([okAdapter, deniedAdapter]);
  expect(result.observations).toHaveLength(1);
  expect(result.coverage.gaps).toEqual([
    expect.objectContaining({ source: "library:containers", errorCode: "PERMISSION_DENIED" })
  ]);
  expect(result.state).toBe("completed_with_warnings");
});

it("закрывает writers и создаёт один cancelled terminal state", async () => {
  const controller = new AbortController();
  const run = runAdapters([slowAdapter], { signal: controller.signal });
  controller.abort();
  const result = await run;
  expect(result.stateTransitions.filter((state) => state === "cancelled")).toHaveLength(1);
  expect(result.findings.every((finding) => finding.allowedActions.length === 0)).toBe(true);
  expect(result.writersClosed).toBe(true);
});
```

- [ ] **Шаг 2: запустить падающий тест**

```bash
pnpm --filter @codex-mac-cleaner/adapters test
```

Ожидаемый результат: FAIL, `runAdapters` отсутствует.

- [ ] **Шаг 3: определить единый adapter contract**

```ts
export interface SourceAdapter {
  readonly id: string;
  scan(context: Readonly<ScanContext & { signal: AbortSignal }>): Promise<ReadonlyArray<Observation>>;
}

export interface AdapterWarning {
  source: string;
  errorCode: "CAPABILITY_UNAVAILABLE" | "PERMISSION_DENIED" | "INTERNAL_ERROR";
  safeMessage: string;
}
```

Каждый adapter получает общий `AbortSignal`, command runner с argv-массивом и filesystem facade; shell string запрещена. Fixtures покрывают корректный, пустой, повреждённый, Unicode, denied и cancelled input.

- [ ] **Шаг 4: реализовать coordinator и два snapshot**

Coordinator фиксирует capability report, Snapshot A, observations и Snapshot B. Изменившийся объект получает `staleDuringAudit=true` и пустой `allowedActions`. При abort coordinator переводит run через `cancelling` ровно в один terminal state `cancelled`, закрывает writers и сохраняет частичный read-only отчёт с пустыми actions. Повторный cancel и гонка с terminal state возвращают уже достигнутое состояние. Library adapter обходит только девять allowlisted roots и исключает quarantine root, developer artifacts, external и network volumes.

```bash
pnpm --filter @codex-mac-cleaner/adapters test
pnpm check
```

Ожидаемый результат: все adapter fixtures и coverage tests проходят; read-only fixture tree не изменён.

- [ ] **Шаг 5: commit**

```bash
git add packages/adapters pnpm-lock.yaml
git commit -m "feat: добавить источники аудита и отчёт покрытия"
```

### Задача 5: `CMC-05` — evidence, classifier, policy и path guard

**Файлы:**

* Создать: `packages/evidence/src/normalize.ts`
* Создать: `packages/classifier/src/rules.ts`
* Создать: `packages/classifier/test/golden/`
* Создать: `packages/policy/src/evaluate.ts`
* Создать: `packages/policy/src/path-guard.ts`
* Создать: `packages/policy/test/policy.test.ts`
* Создать: `packages/policy/test/path-guard.property.test.ts`
* Создать: `packages/policy/test/fixtures.ts`

**Интерфейсы:**

* Использует: `Observation[]` и fingerprints из `CMC-04`.
* Создаёт: `EvidenceSet`, `Classification`, `PolicyDecision`, `validateMutationPath`.

- [ ] **Шаг 1: написать negative policy tests**

```ts
import { safeFinding, syntheticRoot } from "./fixtures.js";

it.each([
  "group_container", "database", "sync_data", "vpn_data", "personal_file", "preference"
])("не разрешает prepare_move для %s", (category) => {
  const decision = evaluatePolicy({ ...safeFinding, category });
  expect(decision.allowedActions).not.toContain("prepare_move");
});

it("orphaned не означает разрешение при open file", () => {
  const decision = evaluatePolicy({ ...safeFinding, label: "orphaned", openFile: true });
  expect(decision.blockingRuleIds).toContain("POLICY_OPEN_FILE");
});
```

- [ ] **Шаг 2: написать property test containment**

```ts
fc.assert(fc.property(fc.string(), (segment) => {
  const result = validateMutationPath({ root: syntheticRoot, candidate: `${syntheticRoot}/${segment}` });
  return result.ok ? result.canonical.startsWith(`${syntheticRoot}/`) : true;
}));
```

- [ ] **Шаг 3: реализовать named rules без score**

Classifier возвращает только `ruleIds`, label, `high|medium|low`, explanation, counterEvidence и missingEvidence. Policy независимо проверяет category, confidence, app presence, activity, open files, capability prerequisites, stale flag, owner, type, device, mount ID, ancestry и links.

```ts
export interface PolicyDecision {
  allowedActions: readonly AllowedAction[];
  blockingRuleIds: readonly string[];
  warnings: readonly string[];
  evaluatedFingerprint: SnapshotFingerprint;
}
```

- [ ] **Шаг 4: запустить golden, matrix и fuzz tests**

```bash
pnpm --filter @codex-mac-cleaner/classifier test
pnpm --filter @codex-mac-cleaner/policy test
pnpm check
```

Ожидаемый результат: golden outputs стабильны; любая link/mount/escape генерация блокируется; high-risk categories analysis-only.

- [ ] **Шаг 5: commit**

```bash
git add packages/evidence packages/classifier packages/policy pnpm-lock.yaml
git commit -m "feat: добавить классификацию и серверную политику"
```

### Задача 6: `CMC-06` — quarantine transaction и recovery

**Файлы:**

* Создать: `packages/quarantine/src/preview-token.ts`
* Создать: `packages/quarantine/src/manifest.ts`
* Создать: `packages/quarantine/src/move.ts`
* Создать: `packages/quarantine/src/recover.ts`
* Создать: `packages/quarantine/test/move.e2e.test.ts`
* Создать: `packages/quarantine/test/recovery.fault.test.ts`
* Создать: `packages/quarantine/test/race.test.ts`

**Интерфейсы:**

* Использует: `PolicyDecision`, `SnapshotFingerprint`, `JsonStore`.
* Создаёт: `prepareMove`, `moveToQuarantine`, `recoverPreparedOperations`.

- [ ] **Шаг 1: написать E2E test транзакции**

```ts
it("пишет prepared до rename и завершает moved", async () => {
  const token = await prepareMove(safeFinding, uiSession);
  const result = await moveToQuarantine({ token, operationId: "op-1" });
  expect(result.state).toBe("moved");
  expect(await exists(sourcePath)).toBe(false);
  expect(await exists(`${quarantineRoot}/op-1/payload/object`)).toBe(true);
  expect(readManifest("op-1").eventSequence).toBeGreaterThan(1);
});
```

- [ ] **Шаг 2: написать fault matrix**

Проверить остановку до manifest, после `prepared`, после filesystem rename и до journal append. Ожидания должны совпадать с четырьмя строками recovery matrix из `runtime-flows.md`.

- [ ] **Шаг 3: реализовать одноразовый token и manifest state machine**

```ts
export type QuarantineState =
  | "previewed" | "prepared" | "moved"
  | "restored" | "purged" | "aborted" | "conflicted" | "inconsistent";

export interface PreviewClaims {
  action: "move" | "restore" | "purge";
  subjectId: string;
  uiSessionId: string;
  fingerprint: SnapshotFingerprint;
  expiresAt: string;
}
```

Token хранится только как random 256-bit secret и server-side digest, действует пять минут и используется один раз. Повтор с тем же `operationId` возвращает прежний результат.

- [ ] **Шаг 4: реализовать rename и recovery**

До rename: lock объекта → policy revalidation → ancestry/fingerprint/open-file checks → manifest `prepared` + fsync. Затем только `rename(source, payload/object)` на том же device. Любой `EXDEV` возвращает `CROSS_VOLUME`; copy-delete отсутствует.

```bash
pnpm --filter @codex-mac-cleaner/quarantine test
pnpm check
```

Ожидаемый результат: E2E, race и fault tests проходят; ни один failure path не меняет другой объект.

- [ ] **Шаг 5: commit**

```bash
git add packages/quarantine pnpm-lock.yaml
git commit -m "feat: добавить транзакционный карантин и recovery"
```

### Задача 7: `CMC-07` — restore и ручной purge

**Файлы:**

* Создать: `packages/quarantine/src/restore.ts`
* Создать: `packages/quarantine/src/purge.ts`
* Создать: `packages/quarantine/src/summary.ts`
* Создать: `packages/quarantine/test/restore.e2e.test.ts`
* Создать: `packages/quarantine/test/purge.e2e.test.ts`
* Создать: `packages/quarantine/test/summary.test.ts`

**Интерфейсы:**

* Использует: manifest и tokens из `CMC-06`.
* Создаёт: `prepareRestore`, `restoreFromQuarantine`, `preparePurge`, `purgeQuarantineEntry`, `readStorageSummary`; каждый успешный move/restore/purge возвращает новый `stateVersion` и `StorageSummary`.

- [ ] **Шаг 1: написать restore conflict tests**

```ts
it("не перезаписывает занятый исходный путь", async () => {
  await writeFile(sourcePath, "new-data");
  await expect(restoreFromQuarantine(request)).rejects.toMatchObject({ errorCode: "RESTORE_PATH_OCCUPIED" });
  expect(await readFile(sourcePath, "utf8")).toBe("new-data");
  expect(await exists(payloadPath)).toBe(true);
});

it("не создаёт отсутствующего исходного родителя", async () => {
  await rm(sourceParent, { recursive: true });
  await expect(restoreFromQuarantine(request)).rejects.toMatchObject({ errorCode: "RESTORE_PARENT_CHANGED" });
});
```

- [ ] **Шаг 2: написать purge symlink test**

Создать payload tree с симлинком на внешний synthetic file. После purge внешний файл должен существовать с прежним содержимым, а quarantine entry — отсутствовать.

Добавить summary/failure tests до реализации:

```ts
it("увеличивает purgedPhysicalBytes после успешного purge", async () => {
  const before = await readStorageSummary(store);
  const result = await purgeQuarantineEntry(request);
  expect(result.summary.purgedPhysicalBytes).toBe(before.purgedPhysicalBytes + payloadPhysicalBytes);
  expect(result.stateVersion).toBeGreaterThan(before.stateVersion);
});

it("не меняет запись и summary после ошибки purge", async () => {
  const before = await readStorageSummary(store);
  await expect(purgeQuarantineEntry(failingRequest)).rejects.toMatchObject({ errorCode: "PURGE_FAILED" });
  expect(await exists(payloadPath)).toBe(true);
  expect(await readStorageSummary(store)).toEqual(before);
});
```

- [ ] **Шаг 3: реализовать restore**

Restore проверяет manifest schema/state, payload identity, свободный source, fingerprint родителя, allowlist ancestry и same device. Операция использует atomic rename; alternate destination и overwrite API отсутствуют. После commit сервер атомарно обновляет journal-derived summary и возвращает новый `stateVersion`.

- [ ] **Шаг 4: реализовать purge без follow-links**

Purge принимает только `operationId` и preview token, сверяет fixed path `payload/object`, удаляет entries через `lstat`-обход и никогда не вызывает `stat` для перехода по ссылке. `purgedPhysicalBytes` — сумма physical size записей `purged` в действующем локальном журнале, а не измерение свободного места APFS. Ошибка удаления не переводит manifest в `purged`, не удаляет запись из list и не меняет `StorageSummary`.

```bash
pnpm --filter @codex-mac-cleaner/quarantine test
pnpm check
```

Ожидаемый результат: restore сохраняет mode, timestamps и synthetic xattrs; purge не затрагивает внешние targets; успешные операции возвращают новый `stateVersion`/summary, а неуспешный purge сохраняет прежнюю запись и summary.

- [ ] **Шаг 5: commit**

```bash
git add packages/quarantine
git commit -m "feat: добавить восстановление и ручную очистку карантина"
```

### Задача 8: `CMC-08` — тёмный Audit Dashboard

**Файлы:**

* Создать: `apps/widget/package.json`
* Создать: `apps/widget/vite.config.ts`
* Создать: `apps/widget/src/main.tsx`
* Создать: `apps/widget/src/app.tsx`
* Создать: `apps/widget/src/lib/bridge.ts`
* Создать: `apps/widget/src/components/audit-dashboard.tsx`
* Создать: `apps/widget/src/components/audit-progress.tsx`
* Создать: `apps/widget/src/components/finding-sheet.tsx`
* Создать: `apps/widget/src/components/action-dialog.tsx`
* Создать: `apps/widget/src/components/quarantine-center.tsx`
* Создать: `apps/widget/src/components/storage-summary.tsx`
* Создать: `apps/widget/src/styles.css`
* Создать: `apps/widget/test/dashboard.test.tsx`
* Создать: `apps/widget/test/quarantine-center.test.tsx`

**Интерфейсы:**

* Использует: model/widget schemas и fixtures после `CMC-05`.
* Создаёт: autonomous `dashboard-v1.html`, `WidgetBridge`, UI states `running`/`cancelling`/`cancelled`, три вкладки Dashboard и Quarantine Center.

- [ ] **Шаг 1: написать UI contract test**

```tsx
it("показывает coverage warning и не показывает запрещённое действие", () => {
  render(<AuditDashboard snapshot={analysisOnlyFixture} bridge={fakeBridge} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Часть областей не проверена");
  expect(screen.queryByRole("button", { name: "Переместить в карантин" })).toBeNull();
  expect(screen.getByText("Действие недоступно: POLICY_RISK_CATEGORY")).toBeVisible();
});

it("показывает три вкладки и не предлагает bulk purge", () => {
  render(<AuditDashboard snapshot={quarantineFixture} bridge={fakeBridge} />);
  expect(screen.getByRole("tab", { name: "Обзор" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Находки" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Карантин" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Очистить всё" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: /выбрать все/i })).toBeNull();
});

it("оставляет отменённый частичный отчёт без cleanup actions", () => {
  render(<AuditDashboard snapshot={cancelledFixture} bridge={fakeBridge} />);
  expect(screen.getByText("Аудит отменён")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Переместить в карантин" })).toBeNull();
});
```

- [ ] **Шаг 2: создать точные UI dependencies**

Использовать React `19.2.7`, React DOM `19.2.7`, Vite `8.1.3`, `@vitejs/plugin-react` `6.0.3`, Tailwind CSS `4.3.2`, shadcn CLI `4.13.0`, `@testing-library/react` `16.3.2`, `@testing-library/dom` `10.4.1`, `@testing-library/jest-dom` `6.9.1`, jsdom `29.1.1`, lucide-react `1.24.0`.

Сгенерировать локальные components:

```bash
pnpm dlx shadcn@4.13.0 add card progress table badge sheet alert alert-dialog skeleton tabs button tooltip sonner
```

- [ ] **Шаг 3: реализовать bridge и version gate**

```ts
export interface WidgetBridge {
  callTool<T>(name: string, input: Record<string, unknown>): Promise<T>;
  setViewState(state: {
    activeTab: "overview" | "findings" | "quarantine";
    filter: string;
    selectedFindingId: string | null;
    selectedQuarantineEntryId: string | null;
    panel: "none" | "evidence";
  }): void;
}

export function acceptSnapshot(currentVersion: number, incomingVersion: number): boolean {
  return incomingVersion >= currentVersion;
}
```

Widget state не содержит path, preview token или policy decision. App-only tool result остаётся в memory ровно до завершения dialog flow. `audit_cancel` вызывается с `auditId` и новым `requestId`; при `cancelling` кнопка disabled, а при `cancelled` частичный отчёт отображается read-only. Входящие snapshots и `StorageSummary` принимаются только через version gate.

- [ ] **Шаг 4: собрать автономный bundle и проверить UX**

Dashboard использует `Card`, `Progress`, `Table`, `Badge`, `Sheet`, `Alert`, `AlertDialog`, `Skeleton`, `Tabs`, `Button`, `Tooltip`, `sonner`; semantic tokens; тёмную тему. Вкладки имеют названия «Обзор», «Находки», «Карантин». Quarantine Center даёт отдельные «Восстановить» и «Удалить навсегда» для каждой записи; bulk controls и auto-purge отсутствуют. Summary показывает «Найдено кандидатов», «В карантине», «Удалено навсегда» из server-owned значений; copy не обещает точный APFS free-space delta. Для `cancelled` точный `Alert`: «Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно. Начните новый аудит». Coverage, risk и action state различимы текстом и icon, не только цветом. Keyboard navigation, focus return после dialog и disabled state проверяются tests. CSP не объявляет network domains.

```bash
pnpm --filter @codex-mac-cleaner/widget test
pnpm --filter @codex-mac-cleaner/widget build
pnpm check
```

Ожидаемый результат: UI tests проходят, включая tabs/cancellation/quarantine/keyboard/focus; `dist/dashboard-v1.html` и local assets создаются без внешних URL.

- [ ] **Шаг 5: commit**

```bash
git add apps/widget pnpm-lock.yaml
git commit -m "feat: добавить тёмный интерфейс аудита"
```

### Задача 9: `CMC-09` — MCP App integration и plugin package

**Файлы:**

* Изменить: `apps/mcp-server/src/server.ts`
* Создать: `apps/mcp-server/src/tools/quarantine.ts`
* Создать: `apps/mcp-server/src/resources/dashboard.ts`
* Создать: `.codex-plugin/plugin.json`
* Создать: `.mcp.json`
* Создать: `skills/codex-mac-cleaner/SKILL.md`
* Создать: `tests/plugin/plugin-contract.test.ts`
* Создать: `tests/plugin/model-visibility.test.ts`

**Интерфейсы:**

* Использует: `CMC-07` quarantine APIs и `CMC-08` widget bundle.
* Создаёт: complete MCP surface с семью model-visible tools, server-owned summary/cancellation integration и repository marketplace package.

- [ ] **Шаг 1: написать visibility test**

```ts
it("скрывает mutation tools от модели", () => {
  const tools = describeRegisteredTools(server);
  expect(tools.get("quarantine_move")?._meta?.ui?.visibility).toEqual(["app"]);
  expect(tools.get("audit_results")?._meta?.ui?.visibility).toBeUndefined();
  expect(tools.get("audit_cancel")?._meta?.ui?.visibility).toBeUndefined();
  expect(tools.get("audit_cancel")?.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  });
  expect(JSON.stringify(tools.get("quarantine_move")?.inputSchema)).not.toContain("path");
});
```

- [ ] **Шаг 2: зарегистрировать tool annotations**

Точные значения взять из `docs/contracts/mcp-tools.md`. Для всех tools `openWorldHint=false`; `quarantine_move` и `quarantine_purge` получают `destructiveHint=true`; app-only tools получают `_meta.ui.visibility=["app"]`. `audit_cancel` остаётся model-visible, принимает только `auditId`/`requestId` и получает `readOnlyHint=false`, `destructiveHint=false`, `idempotentHint=true`.

- [ ] **Шаг 3: зарегистрировать versioned UI resource**

`dashboard_open` возвращает resource URI `ui://codex-mac-cleaner/dashboard-v1.html`. `structuredContent` содержит model-safe snapshot, server-owned `StorageSummary` и audit cancellation state; `_meta` — widget-only full paths и evidence details. `quarantine_list`, move, restore и purge возвращают актуальные `stateVersion`/summary. Breaking widget change требует `dashboard-v2.html`.

- [ ] **Шаг 4: создать plugin manifests и Skill**

`.mcp.json` запускает локальный stdio server без network transport. Skill объясняет scope, запускает только `application_remnants`, показывает coverage gaps, может вызвать `audit_cancel` только по явному запросу пользователя и не вызывает app-only cleanup tools. Tests проверяют JSON schema, существование command entrypoint и отсутствие секретов/absolute build paths.

```bash
pnpm --filter @codex-mac-cleaner/mcp-server test
pnpm test -- tests/plugin
pnpm check
```

Ожидаемый результат: contracts и visibility tests проходят; plugin manifests ссылаются на существующие build outputs.

- [ ] **Шаг 5: commit**

```bash
git add apps/mcp-server .codex-plugin .mcp.json skills tests/plugin pnpm-lock.yaml
git commit -m "feat: собрать MCP App и пакет плагина"
```

### Задача 10: `CMC-10` — security, clean-room и release evidence

**Предусловие:** задача не выполняет tag, publication или release без отдельной команды владельца.

**Файлы:**

* Создать: `tests/security/privacy.test.ts`
* Создать: `tests/security/command-injection.test.ts`
* Создать: `tests/security/audit-cancel.test.ts`
* Создать: `tests/security/quarantine-summary.test.ts`
* Создать: `tests/security/supply-chain.test.ts`
* Создать: `scripts/package-release.mjs`
* Создать: `.github/workflows/ci.yml`
* Создать: `.github/workflows/release-evidence.yml`
* Создать: `docs/release/real-mac-smoke.md`
* Изменить: `README.md`

**Интерфейсы:**

* Использует: merged plugin из `CMC-09` и все gates A–H.
* Создаёт: regression evidence для отмены/метрик quarantine, deterministic artifact, checksum, SBOM, provenance inputs и незаполненный real-Mac protocol.

- [ ] **Шаг 1: написать privacy и injection tests**

```ts
it("не отдаёт полный путь модели", async () => {
  const response = await callModelVisibleTool("audit_results", fixtureRequest);
  expect(JSON.stringify(response.structuredContent)).not.toContain("/Users/");
  expect(response.content.join(" ")).not.toContain("Library/Caches");
});

it("передаёт имя с shell metacharacters как один argv", async () => {
  await inspectFixture("name; touch pwned");
  expect(commandRunner.calls[0]?.argv).toContain("name; touch pwned");
  expect(await exists("pwned")).toBe(false);
});

it("оставляет cancelled partial report без действий", async () => {
  const report = await cancelAuditDuringFixtureScan();
  expect(report.state).toBe("cancelled");
  expect(report.findings.every((finding) => finding.allowedActions.length === 0)).toBe(true);
  expect(report.stateTransitions.filter((state) => state === "cancelled")).toHaveLength(1);
});

it("не меняет quarantine summary при ошибке purge", async () => {
  const before = await quarantineList();
  await expect(purgeWithInjectedFailure()).rejects.toMatchObject({ errorCode: "PURGE_FAILED" });
  expect(await quarantineList()).toEqual(before);
});
```

Добавить отдельный race-case: `audit_cancel`, пришедший одновременно с `completed`, возвращает уже достигнутый terminal state, не создаёт вторую terminal transition и не меняет completed report. Проверить также отсутствие app-visible bulk purge tool и текстов, которые называют `purgedPhysicalBytes` точным изменением свободного места APFS.

- [ ] **Шаг 2: создать CI без release mutation**

`ci.yml` выполняет `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm check`, build widget/server и plugin contract tests на macOS `arm64` runner, когда он доступен. Workflow не содержит deploy, publish, release или credential-writing steps.

- [ ] **Шаг 3: создать deterministic package script**

`package-release.mjs` собирает только production server, widget, manifests, Skill, README и LICENSE; сортирует entries; исключает source maps, tests и absolute paths; создаёт SHA-256 и CycloneDX SBOM через pinned tool. Повторная сборка одного commit должна давать одинаковый file list и content hash для deterministic entries.

- [ ] **Шаг 4: выполнить автоматические gates и подготовить ручной протокол**

```bash
pnpm check
pnpm test -- tests/security tests/plugin
pnpm --filter @codex-mac-cleaner/widget build
pnpm --filter @codex-mac-cleaner/mcp-server build
node scripts/package-release.mjs --verify-only
git diff --check
```

Ожидаемый результат: все автоматические gates проходят. `docs/release/real-mac-smoke.md` содержит шаги отмены активного аудита, проверки read-only частичного отчёта, просмотра server-owned метрик, restore, успешного purge и ошибки purge, а также поля `commit SHA`, `macOS`, `hardware`, `FDA mode`, `result`, `evidence`; ни одно поле результата не помечено выполненным заранее.

- [ ] **Шаг 5: commit и передача Controller**

```bash
git add .github/workflows scripts tests/security docs/release README.md
git commit -m "test: добавить проверки безопасности и release evidence"
```

Worker передаёт PR с текущим head SHA. Controller требует независимые verdicts specification compliance, code quality и evidence freshness; release остаётся отдельным owner action.

# Самопроверка плана

* Все требования из PRD сопоставлены задачам через `requirements-traceability.md`.
* Имена `AuditRun`, `Finding`, `PolicyDecision`, `SnapshotFingerprint`, `QuarantineOperation`, `StorageSummary` и tool names совпадают с контрактами.
* `audit_cancel`, `cancelling`, `cancelled` и пустые `allowedActions` отменённого отчёта покрыты в CMC-03/04/08/09/10.
* `candidatePhysicalBytes`, `quarantinePhysicalBytes`, `purgedPhysicalBytes` и их server-owned semantics покрыты в CMC-03/07/08/09/10.
* Path, destination, overwrite, alternate restore, bulk purge, «Очистить всё» и automatic purge отсутствуют в публичных inputs/UI.
* UI не выдаёт `purgedPhysicalBytes` за точное изменение свободного места APFS.
* Ручные gates описаны как будущие и не отмечены выполненными.
* Задачи `CMC-06` и `CMC-08` — единственная разрешённая параллельная ветка после `CMC-05`.

# Передача выполнения

План завершён и сохранён в `docs/superpowers/plans/2026-07-15-codex-mac-cleaner-v01.md`. Выполнение должен начать только отдельно назначенный Controller после проверки GitHub Issue и прямой команды владельца. Этот архитектурный чат не запускает Workers.

# Источники версий

* [Node.js Releases](https://nodejs.org/en/about/previous-releases)
* [MCP TypeScript SDK](https://www.npmjs.com/package/%40modelcontextprotocol/sdk)
* [React](https://www.npmjs.com/package/react)
* [Vite](https://www.npmjs.com/package/vite)
* [Vitest](https://www.npmjs.com/package/vitest)
* [Zod](https://www.npmjs.com/package/zod)

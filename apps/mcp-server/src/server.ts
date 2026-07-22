import {
  AuditCancelInputSchema,
  AuditCancelOutputSchema,
  AuditResultsInputSchema,
  AuditResultsOutputSchema,
  AuditStartInputSchema,
  AuditStartOutputSchema,
  AuditStatusInputSchema,
  AuditStatusOutputSchema,
  DashboardOpenInputSchema,
  DashboardOpenOutputSchema,
  ExclusionCreateInputSchema,
  ExclusionCreateOutputSchema,
  ExclusionListInputSchema,
  ExclusionListOutputSchema,
  ExclusionListItemSchema,
  ExclusionRemoveInputSchema,
  ExclusionRemoveOutputSchema,
  ExclusionResetInputSchema,
  ExclusionResetOutputSchema,
  ExclusionResetPrepareInputSchema,
  ExclusionResetPrepareOutputSchema,
  FindingInspectInputSchema,
  FindingInspectOutputSchema,
  FindingRevealInputSchema,
  FindingRevealOutputSchema,
  ModelSafeTextSchema,
  UserExclusionSchema,
  containsSecretLikeValue,
  type ExclusionCreateInput,
  type ExclusionListInput,
  type ExclusionListItem,
  type ExclusionRemoveInput,
  type ExclusionResetInput,
  type ExclusionResetPrepareInput,
  type UserExclusion,
  type UserExclusionIdentity,
} from "@codex-mac-cleaner/contracts";
import {
  assertSupportedPlatform,
  type PlatformInput,
} from "@codex-mac-cleaner/platform";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { z } from "zod";

import {
  DASHBOARD_RESOURCE_URI,
  registerDashboardResource,
} from "./resources/dashboard.js";
import {
  createRuntimeCore,
  type RuntimeServiceOptions,
} from "./runtime.js";
import {
  APP_VISIBLE_QUARANTINE_TOOL_DEFINITIONS,
  type AppVisibleQuarantineToolName,
  type QuarantineToolService,
} from "./tools/quarantine.js";
import {
  APP_VISIBLE_SCHEDULE_TOOL_DEFINITIONS,
  MODEL_VISIBLE_SCHEDULE_TOOL_DEFINITIONS,
  ScheduleIntentCoordinator,
  type ScheduleIntentCoordinatorOptions,
} from "./tools/schedule.js";

export { DASHBOARD_RESOURCE_URI, ScheduleIntentCoordinator };

const ModelToolAnnotations = {
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

interface ModelToolDefinition {
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodObject;
  readonly outputSchema: z.ZodObject;
  readonly annotations: ToolAnnotations;
  readonly _meta?: {
    readonly ui: {
      readonly resourceUri: typeof DASHBOARD_RESOURCE_URI;
      readonly visibility: readonly ["model"];
    };
    readonly "ui/resourceUri": typeof DASHBOARD_RESOURCE_URI;
    readonly "openai/outputTemplate": typeof DASHBOARD_RESOURCE_URI;
    readonly "openai/widgetAccessible": true;
  };
}

interface AppToolDefinition {
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodObject;
  readonly outputSchema: z.ZodObject;
  readonly annotations: ToolAnnotations;
  readonly _meta: { readonly ui: { readonly visibility: readonly ["app"] } };
}

export const MODEL_VISIBLE_TOOL_DEFINITIONS = {
  audit_start: {
    title: "Начать проверку",
    description: "Ищет остатки удалённых приложений, не изменяя файлы.",
    inputSchema: AuditStartInputSchema,
    outputSchema: AuditStartOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: false },
  },
  audit_status: {
    title: "Состояние проверки",
    description: "Показывает ход проверки и сообщает о недоступных областях.",
    inputSchema: AuditStatusInputSchema,
    outputSchema: AuditStatusOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  audit_cancel: {
    title: "Остановить проверку",
    description: "Безопасно останавливает проверку, не изменяя файлы.",
    inputSchema: AuditCancelInputSchema,
    outputSchema: AuditCancelOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: false },
  },
  audit_results: {
    title: "Результаты проверки",
    description: "Возвращает обезличенные результаты завершённой проверки.",
    inputSchema: AuditResultsInputSchema,
    outputSchema: AuditResultsOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  dashboard_open: {
    title: "Открыть окно проверки",
    description: "Открывает безопасные результаты проверки Mac.",
    inputSchema: DashboardOpenInputSchema,
    outputSchema: DashboardOpenOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
    _meta: {
      ui: {
        resourceUri: DASHBOARD_RESOURCE_URI,
        visibility: ["model"],
      },
      "ui/resourceUri": DASHBOARD_RESOURCE_URI,
      "openai/outputTemplate": DASHBOARD_RESOURCE_URI,
      "openai/widgetAccessible": true,
    },
  },
  finding_inspect: {
    title: "Подробнее о находке",
    description: "Повторно проверяет сведения о находке и их актуальность.",
    inputSchema: FindingInspectInputSchema,
    outputSchema: FindingInspectOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  finding_reveal: {
    title: "Показать в Finder",
    description: "Просит Finder показать выбранную находку без изменения файла.",
    inputSchema: FindingRevealInputSchema,
    outputSchema: FindingRevealOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: false },
  },
  ...MODEL_VISIBLE_SCHEDULE_TOOL_DEFINITIONS,
} as const satisfies Record<string, ModelToolDefinition>;

export type ModelVisibleToolName = keyof typeof MODEL_VISIBLE_TOOL_DEFINITIONS;

const AppToolAnnotations = {
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const AppOnlyMeta = { ui: { visibility: ["app"] } } as const;

export const APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS = {
  exclusion_create: {
    title: "Оставить объект",
    description: "Сохраняет выбор пользователя, не раскрывая путь к объекту.",
    inputSchema: ExclusionCreateInputSchema,
    outputSchema: ExclusionCreateOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_list: {
    title: "Оставленные объекты",
    description: "Возвращает безопасный список объектов, которые пользователь решил оставить.",
    inputSchema: ExclusionListInputSchema,
    outputSchema: ExclusionListOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: true },
    _meta: AppOnlyMeta,
  },
  exclusion_remove: {
    title: "Снова проверять",
    description: "Возвращает один оставленный объект в следующую проверку.",
    inputSchema: ExclusionRemoveInputSchema,
    outputSchema: ExclusionRemoveOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_reset_prepare: {
    title: "Подготовить повторную проверку всех объектов",
    description: "Готовит отдельное подтверждение повторной проверки всех оставленных объектов.",
    inputSchema: ExclusionResetPrepareInputSchema,
    outputSchema: ExclusionResetPrepareOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_reset: {
    title: "Снова проверять все объекты",
    description: "Возвращает все оставленные объекты в следующую проверку после подтверждения.",
    inputSchema: ExclusionResetInputSchema,
    outputSchema: ExclusionResetOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
} as const satisfies Record<string, AppToolDefinition>;

export type AppVisibleExclusionToolName =
  keyof typeof APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS;

export const APP_VISIBLE_TOOL_DEFINITIONS = {
  ...APP_VISIBLE_QUARANTINE_TOOL_DEFINITIONS,
  ...APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS,
  ...APP_VISIBLE_SCHEDULE_TOOL_DEFINITIONS,
} as const satisfies Record<string, AppToolDefinition>;

export type AppVisibleToolName = keyof typeof APP_VISIBLE_TOOL_DEFINITIONS;

interface ExclusionStorePort {
  list(): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  create(exclusion: UserExclusion): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  remove(exclusionId: string): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  reset(expectedStateVersion: number): Promise<
    | Readonly<{
        status: "reset";
        state: { readonly stateVersion: number };
        removedCount: number;
      }>
    | Readonly<{ status: "stale"; stateVersion: number }>
  >;
  readForAudit(): Promise<
    | Readonly<{ status: "ready"; exclusions: readonly UserExclusion[] }>
    | Readonly<{
        status: "invalid";
        errorCode: "EXCLUSION_STATE_INVALID";
        tokenIssuance: "blocked";
      }>
  >;
}

interface FindingIdentityResolver {
  resolveIdentity(
    findingId: string,
    auditRevision: number,
  ): Promise<UserExclusionIdentity | null>;
}

interface ExclusionServiceOptions {
  readonly store: ExclusionStorePort;
  readonly findings: FindingIdentityResolver;
  readonly now?: () => Date;
  readonly createId?: (prefix: string) => string;
}

export class ExclusionToolError extends Error {
  readonly retryable = false;

  constructor(
    readonly errorCode:
      | "AUDIT_STALE"
      | "EXCLUDED_FINDING"
      | "EXCLUSION_STATE_INVALID"
      | "PREVIEW_EXPIRED"
      | "INTERNAL_ERROR",
    readonly severity: "blocking" | "fatal" = "blocking",
  ) {
    super(errorCode);
    this.name = "ExclusionToolError";
  }
}

function sameIdentity(
  exclusion: UserExclusion,
  identity: UserExclusionIdentity,
): boolean {
  return (
    exclusion.ruleId === identity.ruleId &&
    exclusion.artifactKind === identity.artifactKind &&
    exclusion.normalizedTargetIdentity === identity.normalizedTargetIdentity &&
    (exclusion.bundleId ?? null) === (identity.bundleId ?? null) &&
    (exclusion.packageId ?? null) === (identity.packageId ?? null) &&
    (exclusion.signingIdentity ?? null) === (identity.signingIdentity ?? null) &&
    exclusion.ownerTypeFingerprint === identity.ownerTypeFingerprint
  );
}

function listItem(exclusion: UserExclusion): ExclusionListItem {
  return ExclusionListItemSchema.parse({
    exclusionId: exclusion.exclusionId,
    ruleId: exclusion.ruleId,
    artifactKind: exclusion.artifactKind,
    createdAt: exclusion.createdAt,
    reasonCategory: exclusion.reasonCategory,
  });
}

export class ExclusionService {
  private readonly now: () => Date;
  private readonly createId: (prefix: string) => string;
  private readonly resetTokens = new Map<
    string,
    {
      readonly expiresAt: number;
      readonly stateVersion: number;
      used: boolean;
    }
  >();
  private readonly requestResults = new Map<string, unknown>();

  constructor(private readonly options: ExclusionServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? ((prefix) => `${prefix}-${randomUUID()}`);
  }

  private cached<TResult>(operation: string, requestId: string): TResult | undefined {
    return this.requestResults.get(`${operation}:${requestId}`) as TResult | undefined;
  }

  private remember<TResult>(
    operation: string,
    requestId: string,
    result: TResult,
  ): TResult {
    this.requestResults.set(`${operation}:${requestId}`, result);
    return result;
  }

  private async resolveIdentity(
    findingId: string,
    auditRevision: number,
  ): Promise<UserExclusionIdentity> {
    const identity = await this.options.findings.resolveIdentity(
      findingId,
      auditRevision,
    );
    if (identity === null) throw new ExclusionToolError("AUDIT_STALE");
    return identity;
  }

  async create(rawInput: ExclusionCreateInput) {
    const input = ExclusionCreateInputSchema.parse(rawInput);
    const cached = this.cached<z.infer<typeof ExclusionCreateOutputSchema>>(
      "create",
      input.requestId,
    );
    if (cached !== undefined) return cached;
    const identity = await this.resolveIdentity(input.findingId, input.auditRevision);
    const exclusion = UserExclusionSchema.parse({
      schemaVersion: 1,
      exclusionId: this.createId("exclusion"),
      ...identity,
      createdAt: this.now().toISOString(),
      reasonCategory: input.reasonCategory,
    });
    const state = await this.options.store.create(exclusion);
    return this.remember(
      "create",
      input.requestId,
      ExclusionCreateOutputSchema.parse({
        exclusion: listItem(exclusion),
        stateVersion: state.stateVersion,
      }),
    );
  }

  async list(rawInput: ExclusionListInput) {
    ExclusionListInputSchema.parse(rawInput);
    const state = await this.options.store.list();
    return ExclusionListOutputSchema.parse({
      exclusions: state.exclusions.map(listItem),
      stateVersion: state.stateVersion,
    });
  }

  async remove(rawInput: ExclusionRemoveInput) {
    const input = ExclusionRemoveInputSchema.parse(rawInput);
    const cached = this.cached<z.infer<typeof ExclusionRemoveOutputSchema>>(
      "remove",
      input.requestId,
    );
    if (cached !== undefined) return cached;
    const state = await this.options.store.remove(input.exclusionId);
    return this.remember(
      "remove",
      input.requestId,
      ExclusionRemoveOutputSchema.parse({
        removedExclusionId: input.exclusionId,
        stateVersion: state.stateVersion,
      }),
    );
  }

  async resetPrepare(rawInput: ExclusionResetPrepareInput) {
    const input = ExclusionResetPrepareInputSchema.parse(rawInput);
    const cached = this.cached<z.infer<typeof ExclusionResetPrepareOutputSchema>>(
      "reset-prepare",
      input.requestId,
    );
    if (cached !== undefined) return cached;
    const state = await this.options.store.list();
    const resetToken = this.createId("reset");
    const expiresAt = this.now().getTime() + 5 * 60 * 1000;
    this.resetTokens.set(resetToken, {
      expiresAt,
      stateVersion: state.stateVersion,
      used: false,
    });
    return this.remember(
      "reset-prepare",
      input.requestId,
      ExclusionResetPrepareOutputSchema.parse({
        resetToken,
        exclusionCount: state.exclusions.length,
        expiresAt: new Date(expiresAt).toISOString(),
        stateVersion: state.stateVersion,
      }),
    );
  }

  async reset(rawInput: ExclusionResetInput) {
    const input = ExclusionResetInputSchema.parse(rawInput);
    const cached = this.cached<z.infer<typeof ExclusionResetOutputSchema>>(
      "reset",
      input.requestId,
    );
    if (cached !== undefined) return cached;
    const token = this.resetTokens.get(input.resetToken);
    if (token === undefined || token.used || token.expiresAt < this.now().getTime()) {
      throw new ExclusionToolError("PREVIEW_EXPIRED");
    }
    token.used = true;
    const reset = await this.options.store.reset(token.stateVersion);
    if (reset.status === "stale") {
      throw new ExclusionToolError("PREVIEW_EXPIRED");
    }
    return this.remember(
      "reset",
      input.requestId,
      ExclusionResetOutputSchema.parse({
        removedCount: reset.removedCount,
        stateVersion: reset.state.stateVersion,
      }),
    );
  }

  async assertFindingCanReceiveDestructiveToken(
    findingId: string,
    auditRevision: number,
  ): Promise<void> {
    const identity = await this.resolveIdentity(findingId, auditRevision);
    const state = await this.options.store.readForAudit();
    if (state.status === "invalid") {
      throw new ExclusionToolError("EXCLUSION_STATE_INVALID", "fatal");
    }
    if (state.exclusions.some((exclusion) => sameIdentity(exclusion, identity))) {
      throw new ExclusionToolError("EXCLUDED_FINDING");
    }
  }
}

const UNSAFE_GUIDANCE_PATTERN =
  /(?:\bsudo\b|\brm\s+(?:-[A-Za-z]*r|--recursive)|\blaunchctl\b|\bchmod\s+777\b)/iu;

function walkStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

function assertNoUnsafeGuidance(value: unknown): void {
  walkStrings(value, (text) => {
    if (UNSAFE_GUIDANCE_PATTERN.test(text)) {
      throw new Error("UNSAFE_MANUAL_GUIDANCE");
    }
  });
}

function assertUnsupportedFindingsAreInspectOnly(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) assertUnsupportedFindingsAreInspectOnly(item);
    return;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.supportLevel === "unsupported_manual") {
    if (
      !Array.isArray(candidate.allowedActions) ||
      candidate.allowedActions.length !== 1 ||
      candidate.allowedActions[0] !== "inspect"
    ) {
      throw new Error("UNSUPPORTED_MANUAL_ACTION");
    }
  }
  for (const item of Object.values(candidate)) {
    assertUnsupportedFindingsAreInspectOnly(item);
  }
}

const PRIVATE_WIDGET_META_FIELDS = new Set([
  "applicationinventory",
  "appinventory",
  "configvalue",
  "environmentdump",
  "exclusionidentities",
  "exclusionidentity",
  "installedapplications",
  "personalinventory",
  "protecteddetails",
  "rawconfig",
  "rawconfigvalue",
  "rawenvironment",
]);

function assertNoPrivateWidgetMetaFields(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrivateWidgetMetaFields(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replaceAll(/[^A-Za-z]/gu, "").toLowerCase();
    if (PRIVATE_WIDGET_META_FIELDS.has(normalizedKey)) {
      throw new Error("PRIVATE_WIDGET_META_FIELD");
    }
    assertNoPrivateWidgetMetaFields(item);
  }
}

const WidgetMetaSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  walkStrings(value, (text) => {
    if (containsSecretLikeValue(text)) {
      context.addIssue({ code: "custom", message: "Secret-like значение запрещено" });
    }
  });
});

export function buildToolResult(
  toolName: ModelVisibleToolName,
  structuredContent: unknown,
  message: string,
  meta?: unknown,
): CallToolResult {
  const definition = MODEL_VISIBLE_TOOL_DEFINITIONS[toolName];
  const safeContent = ModelSafeTextSchema.parse(message);
  const output = definition.outputSchema.parse(structuredContent) as Record<
    string,
    unknown
  >;
  assertNoUnsafeGuidance(output);
  assertUnsupportedFindingsAreInspectOnly(output);
  const result: CallToolResult = {
    content: [{ type: "text", text: safeContent }],
    structuredContent: output,
  };
  if (meta !== undefined) {
    assertNoPrivateWidgetMetaFields(meta);
    result._meta = WidgetMetaSchema.parse(meta);
  }
  return result;
}

function skeletonUnavailableResult(): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: "Служба этого инструмента ещё не подключена.",
      },
    ],
    isError: true,
  };
}

function buildAppToolResult(
  toolName: AppVisibleToolName,
  structuredContent: unknown,
  message: string,
): CallToolResult {
  const definition = APP_VISIBLE_TOOL_DEFINITIONS[toolName] as AppToolDefinition;
  const output = definition.outputSchema.parse(structuredContent) as Record<
    string,
    unknown
  >;
  return {
    content: [{ type: "text", text: ModelSafeTextSchema.parse(message) }],
    structuredContent: output,
  };
}

function safeServiceError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: ModelSafeTextSchema.parse(message) }],
    isError: true,
  };
}

function exclusionErrorResult(error: unknown): CallToolResult {
  const message =
    error instanceof ExclusionToolError
      ? error.errorCode === "EXCLUDED_FINDING"
        ? "Пользователь решил оставить объект. Изменение файлов недоступно."
        : error.errorCode === "EXCLUSION_STATE_INVALID"
          ? "Состояние исключений повреждено. Изменяющие действия заблокированы."
          : error.errorCode === "PREVIEW_EXPIRED"
            ? "Подтверждение сброса недействительно. Подготовьте новое."
            : "Результаты устарели. Запустите проверку ещё раз."
      : "Изменение списка оставленных объектов безопасно остановлено.";
  return {
    content: [{ type: "text", text: ModelSafeTextSchema.parse(message) }],
    isError: true,
  };
}

async function callExclusionTool(
  service: ExclusionService,
  toolName: AppVisibleExclusionToolName,
  rawInput: unknown,
): Promise<CallToolResult> {
  try {
    switch (toolName) {
      case "exclusion_create":
        return buildAppToolResult(
          toolName,
          await service.create(rawInput as ExclusionCreateInput),
          "Объект оставлен и больше не будет предлагаться для очистки.",
        );
      case "exclusion_list":
        return buildAppToolResult(
          toolName,
          await service.list(rawInput as ExclusionListInput),
          "Список оставленных объектов обновлён.",
        );
      case "exclusion_remove":
        return buildAppToolResult(
          toolName,
          await service.remove(rawInput as ExclusionRemoveInput),
          "Объект снова будет проверяться.",
        );
      case "exclusion_reset_prepare":
        return buildAppToolResult(
          toolName,
          await service.resetPrepare(rawInput as ExclusionResetPrepareInput),
          "Подготовлено отдельное подтверждение повторной проверки всех объектов.",
        );
      case "exclusion_reset":
        return buildAppToolResult(
          toolName,
          await service.reset(rawInput as ExclusionResetInput),
          "Все оставленные объекты снова будут проверяться.",
        );
    }
  } catch (error) {
    return exclusionErrorResult(error);
  }
}

async function callQuarantineTool(
  service: QuarantineToolService,
  toolName: AppVisibleQuarantineToolName,
  rawInput: unknown,
): Promise<CallToolResult> {
  try {
    switch (toolName) {
      case "quarantine_prepare_move":
        return buildAppToolResult(
          toolName,
          await service.prepareMove(rawInput as never),
          "Подготовлено подтверждение перемещения одного объекта.",
        );
      case "quarantine_move":
        return buildAppToolResult(
          toolName,
          await service.move(rawInput as never),
          "Один объект перемещён в карантин.",
        );
      case "quarantine_list":
        return buildAppToolResult(
          toolName,
          await service.list(rawInput as never),
          "Состояние карантина обновлено.",
        );
      case "quarantine_prepare_restore":
        return buildAppToolResult(
          toolName,
          await service.prepareRestore(rawInput as never),
          "Подготовлено подтверждение восстановления одной записи.",
        );
      case "quarantine_restore":
        return buildAppToolResult(
          toolName,
          await service.restore(rawInput as never),
          "Одна запись восстановлена без перезаписи.",
        );
      case "quarantine_prepare_purge":
        return buildAppToolResult(
          toolName,
          await service.preparePurge(rawInput as never),
          "Подготовлено подтверждение окончательного удаления одной записи.",
        );
      case "quarantine_purge":
        return buildAppToolResult(
          toolName,
          await service.purge(rawInput as never),
          "Один объект удалён из карантина навсегда.",
        );
    }
  } catch {
    return safeServiceError("Операция карантина безопасно остановлена.");
  }
}

type ScheduleService = Pick<
  ScheduleIntentCoordinator,
  "request" | "state" | "get" | "complete"
>;

export interface AuditToolService {
  start(input: unknown): Promise<unknown>;
  status(input: unknown): Promise<unknown>;
  cancel(input: unknown): Promise<unknown>;
  results(input: unknown): Promise<unknown>;
  dashboard(input: unknown): Promise<{
    readonly output: unknown;
    readonly meta: Readonly<Record<string, unknown>>;
  }>;
  inspect(input: unknown): Promise<unknown>;
  reveal(input: unknown): Promise<unknown>;
}

async function callAuditModelTool(
  service: AuditToolService,
  toolName: Exclude<
    ModelVisibleToolName,
    "schedule_intent_get" | "schedule_intent_complete"
  >,
  rawInput: unknown,
): Promise<CallToolResult> {
  try {
    switch (toolName) {
      case "audit_start":
        return buildToolResult(
          toolName,
          await service.start(rawInput),
          "Проверка поставлена в очередь. Файлы не изменяются.",
        );
      case "audit_status":
        return buildToolResult(
          toolName,
          await service.status(rawInput),
          "Состояние проверки обновлено.",
        );
      case "audit_cancel":
        return buildToolResult(
          toolName,
          await service.cancel(rawInput),
          "Запрос на остановку проверки обработан.",
        );
      case "audit_results":
        return buildToolResult(
          toolName,
          await service.results(rawInput),
          "Безопасные результаты проверки получены.",
        );
      case "dashboard_open": {
        const dashboard = await service.dashboard(rawInput);
        return buildToolResult(
          toolName,
          dashboard.output,
          "Окно проверки готово к открытию.",
          {
            ...dashboard.meta,
            "openai/outputTemplate": DASHBOARD_RESOURCE_URI,
          },
        );
      }
      case "finding_inspect":
        return buildToolResult(
          toolName,
          await service.inspect(rawInput),
          "Сведения о находке безопасно перепроверены.",
        );
      case "finding_reveal":
        return buildToolResult(
          toolName,
          await service.reveal(rawInput),
          "Запрос Finder обработан без изменения файла.",
        );
    }
  } catch {
    return safeServiceError("Проверка безопасно остановлена.");
  }
}

async function callScheduleModelTool(
  service: ScheduleService,
  toolName: "schedule_intent_get" | "schedule_intent_complete",
  rawInput: unknown,
): Promise<CallToolResult> {
  try {
    if (toolName === "schedule_intent_get") {
      return buildToolResult(
        toolName,
        await service.get(rawInput as never),
        "Автоматическое расписание недоступно в v0.1.",
      );
    }
    return buildToolResult(
      toolName,
      await service.complete(rawInput as never),
      "Автоматическая проверка недоступна в этой версии.",
    );
  } catch {
    return safeServiceError("Запрос автоматической проверки недоступен или уже завершён.");
  }
}

async function callScheduleAppTool(
  service: ScheduleService,
  toolName: "schedule_request" | "schedule_state",
  rawInput: unknown,
): Promise<CallToolResult> {
  try {
    if (toolName === "schedule_request") {
      return buildAppToolResult(
        toolName,
        await service.request(rawInput as never),
        "Автоматическая проверка недоступна в этой версии. Запустите обычную проверку вручную.",
      );
    }
    return buildAppToolResult(
      toolName,
      await service.state(rawInput as never),
      "Автоматическая проверка отключена в этой версии.",
    );
  } catch {
    return safeServiceError("Запрос автоматической проверки безопасно остановлен.");
  }
}

export interface McpServerOptions {
  readonly auditService?: AuditToolService;
  readonly exclusionService?: ExclusionService;
  readonly quarantineService?: QuarantineToolService;
  readonly scheduleService?: ScheduleService;
  readonly scheduleOptions?: ScheduleIntentCoordinatorOptions;
  readonly dashboardHtml?: string;
}

export function createMcpServer(
  platformInput: PlatformInput,
  options: McpServerOptions = {},
): McpServer {
  assertSupportedPlatform(platformInput);

  const server = new McpServer({
    name: "codex-mac-cleaner",
    version: "0.1.0-beta.9",
  });
  const scheduleService =
    options.scheduleService ?? new ScheduleIntentCoordinator(options.scheduleOptions);
  registerDashboardResource(server, options.dashboardHtml);
  for (const [name, definition] of Object.entries(MODEL_VISIBLE_TOOL_DEFINITIONS)) {
    const toolName = name as ModelVisibleToolName;
    const toolDefinition = definition as ModelToolDefinition;
    server.registerTool(
      toolName,
      {
        title: toolDefinition.title,
        description: toolDefinition.description,
        inputSchema: toolDefinition.inputSchema,
        outputSchema: toolDefinition.outputSchema,
        annotations: toolDefinition.annotations,
        ...(toolDefinition._meta === undefined
          ? {}
          : { _meta: toolDefinition._meta }),
      },
      toolName === "schedule_intent_get" ||
        toolName === "schedule_intent_complete"
        ? (input: unknown) =>
            callScheduleModelTool(scheduleService, toolName, input)
        : options.auditService === undefined
          ? skeletonUnavailableResult
          : (input: unknown) =>
              callAuditModelTool(
                options.auditService!,
                toolName as Exclude<
                  ModelVisibleToolName,
                  "schedule_intent_get" | "schedule_intent_complete"
                >,
                input,
              ),
    );
  }
  for (const [name, definition] of Object.entries(APP_VISIBLE_TOOL_DEFINITIONS)) {
    const toolName = name as AppVisibleToolName;
    let handler: (input: unknown) => CallToolResult | Promise<CallToolResult> =
      skeletonUnavailableResult;
    if (toolName in APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS) {
      handler =
        options.exclusionService === undefined
          ? skeletonUnavailableResult
          : (input: unknown) =>
              callExclusionTool(
                options.exclusionService!,
                toolName as AppVisibleExclusionToolName,
                input,
              );
    } else if (toolName in APP_VISIBLE_QUARANTINE_TOOL_DEFINITIONS) {
      handler =
        options.quarantineService === undefined
          ? skeletonUnavailableResult
          : (input: unknown) =>
              callQuarantineTool(
                options.quarantineService!,
                toolName as AppVisibleQuarantineToolName,
                input,
              );
    } else {
      handler = (input: unknown) =>
        callScheduleAppTool(
          scheduleService,
          toolName as "schedule_request" | "schedule_state",
          input,
        );
    }
    server.registerTool(
      toolName,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        annotations: definition.annotations,
        _meta: definition._meta,
      },
      handler,
    );
  }
  return server;
}

function detectPlatformInput(): PlatformInput {
  let productRelease = release();
  if (platform() === "darwin") {
    try {
      productRelease = execFileSync("/usr/bin/sw_vers", ["-productVersion"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // assertSupportedPlatform ниже fail-closed отклонит нераспознанную версию.
    }
  }
  return { platform: platform(), arch: arch(), release: productRelease };
}

export async function startMcpServer(
  platformInput: PlatformInput = detectPlatformInput(),
): Promise<McpServer> {
  const server = createMcpServer(
    platformInput,
    await createDefaultRuntimeServices(),
  );
  await server.connect(new StdioServerTransport());
  return server;
}

export async function createDefaultRuntimeServices(
  options: RuntimeServiceOptions = {},
): Promise<McpServerOptions> {
  const core = await createRuntimeCore(options);
  const exclusionService = new ExclusionService({
    store: core.exclusionStore,
    findings: core.auditService,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.createId === undefined ? {} : { createId: options.createId }),
  });
  const quarantineService = await core.createQuarantineService(exclusionService);
  return {
    auditService: core.auditService,
    exclusionService,
    quarantineService,
  };
}

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
import { arch, platform, release } from "node:os";
import { z } from "zod";

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
    title: "Начать аудит",
    description: "Запускает read-only аудит остатков приложений.",
    inputSchema: AuditStartInputSchema,
    outputSchema: AuditStartOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: false },
  },
  audit_status: {
    title: "Статус аудита",
    description: "Возвращает прогресс и безопасные предупреждения покрытия.",
    inputSchema: AuditStatusInputSchema,
    outputSchema: AuditStatusOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  audit_cancel: {
    title: "Отменить аудит",
    description: "Кооперативно отменяет read-only аудит без файловых изменений.",
    inputSchema: AuditCancelInputSchema,
    outputSchema: AuditCancelOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: false },
  },
  audit_results: {
    title: "Результаты аудита",
    description: "Возвращает страницу обезличенных результатов завершённой ревизии.",
    inputSchema: AuditResultsInputSchema,
    outputSchema: AuditResultsOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  dashboard_open: {
    title: "Открыть Dashboard",
    description: "Возвращает безопасный snapshot для Audit Dashboard.",
    inputSchema: DashboardOpenInputSchema,
    outputSchema: DashboardOpenOutputSchema,
    annotations: { ...ModelToolAnnotations, readOnlyHint: true },
  },
  finding_inspect: {
    title: "Проверить находку",
    description: "Повторно проверяет безопасные evidence и stale-состояние находки.",
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
    title: "Исключить находку",
    description: "Сохраняет server-owned identity находки в локальном состоянии.",
    inputSchema: ExclusionCreateInputSchema,
    outputSchema: ExclusionCreateOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_list: {
    title: "Список исключений",
    description: "Возвращает безопасный список пользовательских исключений.",
    inputSchema: ExclusionListInputSchema,
    outputSchema: ExclusionListOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: true },
    _meta: AppOnlyMeta,
  },
  exclusion_remove: {
    title: "Снова проверять",
    description: "Удаляет одну запись исключения по server-generated ID.",
    inputSchema: ExclusionRemoveInputSchema,
    outputSchema: ExclusionRemoveOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_reset_prepare: {
    title: "Подготовить сброс исключений",
    description: "Создаёт одноразовый token для отдельного подтверждения.",
    inputSchema: ExclusionResetPrepareInputSchema,
    outputSchema: ExclusionResetPrepareOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  exclusion_reset: {
    title: "Сбросить исключения",
    description: "Удаляет все записи исключений после проверки одноразового token.",
    inputSchema: ExclusionResetInputSchema,
    outputSchema: ExclusionResetOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
} as const satisfies Record<string, AppToolDefinition>;

export type AppVisibleExclusionToolName =
  keyof typeof APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS;

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

const WidgetMetaSchema = z
  .object({
    widget: z
      .object({
        canonicalPath: z
          .string()
          .min(1)
          .max(4096)
          .regex(/^\//u)
          .refine(
            (value) => !containsSecretLikeValue(value),
            { message: "Secret-like значение запрещено" },
          ),
      })
      .strict(),
  })
  .strict();

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
  const result: CallToolResult = {
    content: [{ type: "text", text: safeContent }],
    structuredContent: output,
  };
  if (meta !== undefined) result._meta = WidgetMetaSchema.parse(meta);
  return result;
}

function skeletonUnavailableResult(): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: "Runtime-координатор этого инструмента ещё не подключён.",
      },
    ],
    isError: true,
  };
}

function buildAppToolResult(
  toolName: AppVisibleExclusionToolName,
  structuredContent: unknown,
  message: string,
): CallToolResult {
  const output = APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS[
    toolName
  ].outputSchema.parse(structuredContent) as Record<string, unknown>;
  return {
    content: [{ type: "text", text: ModelSafeTextSchema.parse(message) }],
    structuredContent: output,
  };
}

function exclusionErrorResult(error: unknown): CallToolResult {
  const message =
    error instanceof ExclusionToolError
      ? error.errorCode === "EXCLUDED_FINDING"
        ? "Находка исключена. Destructive token не создан."
        : error.errorCode === "EXCLUSION_STATE_INVALID"
          ? "Состояние исключений повреждено. Изменяющие действия заблокированы."
          : error.errorCode === "PREVIEW_EXPIRED"
            ? "Подтверждение сброса недействительно. Подготовьте новое."
            : "Ревизия аудита устарела. Повторите проверку."
      : "Операция с исключениями безопасно остановлена.";
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
          "Пользовательское исключение сохранено.",
        );
      case "exclusion_list":
        return buildAppToolResult(
          toolName,
          await service.list(rawInput as ExclusionListInput),
          "Список пользовательских исключений обновлён.",
        );
      case "exclusion_remove":
        return buildAppToolResult(
          toolName,
          await service.remove(rawInput as ExclusionRemoveInput),
          "Исключение удалено. Объект снова будет проверяться.",
        );
      case "exclusion_reset_prepare":
        return buildAppToolResult(
          toolName,
          await service.resetPrepare(rawInput as ExclusionResetPrepareInput),
          "Подготовлено отдельное подтверждение сброса исключений.",
        );
      case "exclusion_reset":
        return buildAppToolResult(
          toolName,
          await service.reset(rawInput as ExclusionResetInput),
          "Пользовательские исключения сброшены.",
        );
    }
  } catch (error) {
    return exclusionErrorResult(error);
  }
}

interface McpServerOptions {
  readonly exclusionService?: ExclusionService;
}

export function createMcpServer(
  platformInput: PlatformInput,
  options: McpServerOptions = {},
): McpServer {
  assertSupportedPlatform(platformInput);

  const server = new McpServer({ name: "codex-mac-cleaner", version: "0.1.0" });
  for (const [name, definition] of Object.entries(MODEL_VISIBLE_TOOL_DEFINITIONS)) {
    server.registerTool(
      name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        annotations: definition.annotations,
      },
      skeletonUnavailableResult,
    );
  }
  for (const [name, definition] of Object.entries(
    APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS,
  )) {
    const toolName = name as AppVisibleExclusionToolName;
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
      options.exclusionService === undefined
        ? skeletonUnavailableResult
        : (input: unknown) =>
            callExclusionTool(options.exclusionService!, toolName, input),
    );
  }
  return server;
}

export async function startMcpServer(
  platformInput: PlatformInput = {
    platform: platform(),
    arch: arch(),
    release: release(),
  },
): Promise<McpServer> {
  const server = createMcpServer(platformInput);
  await server.connect(new StdioServerTransport());
  return server;
}

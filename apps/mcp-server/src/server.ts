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
  FindingInspectInputSchema,
  FindingInspectOutputSchema,
  FindingRevealInputSchema,
  FindingRevealOutputSchema,
  ModelSafeTextSchema,
  containsSecretLikeValue,
} from "@codex-mac-cleaner/contracts";
import {
  assertSupportedPlatform,
  type PlatformInput,
} from "@codex-mac-cleaner/platform";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
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

export function createMcpServer(platformInput: PlatformInput): McpServer {
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

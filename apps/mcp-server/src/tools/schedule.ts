import {
  IsoDateTimeSchema,
  NullableIsoDateTimeSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "@codex-mac-cleaner/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const DayOfMonthSchema = z.number().int().min(1).max(28);
const LocalTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);
const ScheduleActionSchema = z.enum([
  "enable",
  "update",
  "pause",
  "resume",
  "delete",
]);
const ScheduleIntentStateSchema = z.enum([
  "awaiting_confirmation",
  "completed",
  "capability_unavailable",
  "failed",
]);
const ScheduleOutcomeSchema = z.enum([
  "completed",
  "capability_unavailable",
  "failed",
]);
const OpaqueAutomationIdSchema = z
  .string()
  .regex(/^automation:v1:[A-Za-z0-9_-]{16,128}$/u);

export const ScheduleRequestInputSchema = z
  .object({
    requestId: OpaqueIdSchema,
    action: ScheduleActionSchema,
    dayOfMonth: DayOfMonthSchema.optional(),
    localTime: LocalTimeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const needsFields = value.action === "enable" || value.action === "update";
    if (
      needsFields &&
      (value.dayOfMonth === undefined || value.localTime === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Для действия нужны dayOfMonth/localTime",
      });
    }
    if (
      !needsFields &&
      (value.dayOfMonth !== undefined || value.localTime !== undefined)
    ) {
      context.addIssue({ code: "custom", message: "Для действия day/time запрещены" });
    }
  });

export const ScheduleIntentGetInputSchema = z
  .object({ intentId: OpaqueIdSchema })
  .strict();

export const ScheduleIntentCompleteInputSchema = z
  .object({
    intentId: OpaqueIdSchema,
    requestId: OpaqueIdSchema,
    outcome: ScheduleOutcomeSchema,
    automationId: OpaqueAutomationIdSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === "completed" && value.automationId === null) {
      context.addIssue({ code: "custom", message: "Host outcome требует opaque automationId" });
    }
    if (value.outcome !== "completed" && value.automationId !== null) {
      context.addIssue({ code: "custom", message: "Неуспешный outcome не принимает automationId" });
    }
  });

export const ScheduleStateInputSchema = z.object({}).strict();

const ScheduleIntentViewShape = {
  intentId: OpaqueIdSchema,
  action: ScheduleActionSchema,
  state: ScheduleIntentStateSchema,
  createdAt: IsoDateTimeSchema,
  dayOfMonth: DayOfMonthSchema.nullable(),
  localTime: LocalTimeSchema.nullable(),
  requiresHostCapability: z.literal(true),
};

export const ScheduleRequestOutputSchema = z
  .object({ ...ScheduleIntentViewShape, stateVersion: SafeIntegerSchema })
  .strict();

export const ScheduleIntentGetOutputSchema = ScheduleRequestOutputSchema;

export const ScheduleStateOutputSchema = z
  .object({
    enabled: z.boolean(),
    dayOfMonth: DayOfMonthSchema.nullable(),
    localTime: LocalTimeSchema.nullable(),
    nextRunAt: NullableIsoDateTimeSchema,
    lastRunAt: NullableIsoDateTimeSchema,
    capabilityState: z.enum(["available", "unavailable", "unknown"]),
    pendingIntentId: OpaqueIdSchema.nullable(),
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const ScheduleIntentCompleteOutputSchema = z
  .object({
    intentId: OpaqueIdSchema,
    state: ScheduleIntentStateSchema,
    outcome: ScheduleOutcomeSchema,
    scheduleState: ScheduleStateOutputSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

const AppOnlyMeta = { ui: { visibility: ["app"] } } as const;
const BaseAnnotations = {
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

export const MODEL_VISIBLE_SCHEDULE_TOOL_DEFINITIONS = {
  schedule_intent_get: {
    title: "Получить intent расписания",
    description:
      "Возвращает безопасный pending intent для отдельного host capability flow.",
    inputSchema: ScheduleIntentGetInputSchema,
    outputSchema: ScheduleIntentGetOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: true },
  },
  schedule_intent_complete: {
    title: "Завершить intent расписания",
    description:
      "Записывает outcome уже выполненного host action и не вызывает automation.",
    inputSchema: ScheduleIntentCompleteInputSchema,
    outputSchema: ScheduleIntentCompleteOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: false },
  },
} as const;

export const APP_VISIBLE_SCHEDULE_TOOL_DEFINITIONS = {
  schedule_request: {
    title: "Запросить изменение расписания",
    description:
      "Создаёт закрытый intent без cron, RRULE, shell и вызова host automation.",
    inputSchema: ScheduleRequestInputSchema,
    outputSchema: ScheduleRequestOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  schedule_state: {
    title: "Состояние расписания",
    description: "Возвращает capability и безопасное состояние расписания.",
    inputSchema: ScheduleStateInputSchema,
    outputSchema: ScheduleStateOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: true },
    _meta: AppOnlyMeta,
  },
} as const;

type ScheduleRequestInput = z.infer<typeof ScheduleRequestInputSchema>;
type ScheduleIntentCompleteInput = z.infer<typeof ScheduleIntentCompleteInputSchema>;
type ScheduleIntentView = z.infer<typeof ScheduleRequestOutputSchema>;

interface StoredIntent extends ScheduleIntentView {
  readonly requestId: string;
}

export interface ScheduleIntentCoordinatorOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly onHostAutomationCall?: () => void;
}

export class ScheduleIntentCoordinator {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private stateVersion = 0;
  private intent: StoredIntent | null = null;
  private automationId: string | null = null;
  private enabled = false;
  private dayOfMonth: number | null = null;
  private localTime: string | null = null;
  private capabilityState: "available" | "unavailable" | "unknown" = "unknown";
  private readonly requestResults = new Map<string, unknown>();

  constructor(options: ScheduleIntentCoordinatorOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => `intent-${randomUUID()}`);
    // onHostAutomationCall намеренно не сохраняется: coordinator не имеет host port.
  }

  private view(intent: StoredIntent): z.infer<typeof ScheduleRequestOutputSchema> {
    return ScheduleRequestOutputSchema.parse({
      intentId: intent.intentId,
      action: intent.action,
      state: intent.state,
      createdAt: intent.createdAt,
      dayOfMonth: intent.dayOfMonth,
      localTime: intent.localTime,
      requiresHostCapability: true,
      stateVersion: this.stateVersion,
    });
  }

  async request(rawInput: ScheduleRequestInput) {
    const input = ScheduleRequestInputSchema.parse(rawInput);
    const cached = this.requestResults.get(`request:${input.requestId}`);
    if (cached !== undefined) return cached as z.infer<typeof ScheduleRequestOutputSchema>;
    if (this.intent?.state === "awaiting_confirmation") {
      throw new Error("SCHEDULE_INTENT_PENDING");
    }
    this.stateVersion += 1;
    this.intent = {
      intentId: this.createId(),
      requestId: input.requestId,
      action: input.action,
      state: "awaiting_confirmation",
      createdAt: this.now().toISOString(),
      dayOfMonth: input.dayOfMonth ?? null,
      localTime: input.localTime ?? null,
      requiresHostCapability: true,
      stateVersion: this.stateVersion,
    };
    const result = this.view(this.intent);
    this.requestResults.set(`request:${input.requestId}`, result);
    return result;
  }

  async get(rawInput: z.infer<typeof ScheduleIntentGetInputSchema>) {
    const input = ScheduleIntentGetInputSchema.parse(rawInput);
    if (this.intent === null || this.intent.intentId !== input.intentId) {
      throw new Error("SCHEDULE_INTENT_NOT_FOUND");
    }
    return ScheduleIntentGetOutputSchema.parse(this.view(this.intent));
  }

  async complete(rawInput: ScheduleIntentCompleteInput) {
    const input = ScheduleIntentCompleteInputSchema.parse(rawInput);
    const cached = this.requestResults.get(`complete:${input.requestId}`);
    if (cached !== undefined) {
      return cached as z.infer<typeof ScheduleIntentCompleteOutputSchema>;
    }
    if (
      this.intent === null ||
      this.intent.intentId !== input.intentId ||
      this.intent.state !== "awaiting_confirmation"
    ) {
      throw new Error("SCHEDULE_INTENT_NOT_PENDING");
    }

    this.stateVersion += 1;
    this.capabilityState =
      input.outcome === "completed"
        ? "available"
        : input.outcome === "capability_unavailable"
          ? "unavailable"
          : "unknown";
    if (input.outcome === "completed") {
      this.automationId = input.automationId;
      if (this.intent.action === "enable" || this.intent.action === "update") {
        this.dayOfMonth = this.intent.dayOfMonth;
        this.localTime = this.intent.localTime;
        this.enabled = true;
      } else if (this.intent.action === "resume") {
        this.enabled = true;
      } else if (this.intent.action === "pause") {
        this.enabled = false;
      } else {
        this.enabled = false;
        this.automationId = null;
        this.dayOfMonth = null;
        this.localTime = null;
      }
    }
    this.intent = {
      ...this.intent,
      state: input.outcome,
      stateVersion: this.stateVersion,
    };
    const scheduleState = await this.state({});
    const result = ScheduleIntentCompleteOutputSchema.parse({
      intentId: this.intent.intentId,
      state: this.intent.state,
      outcome: input.outcome,
      scheduleState,
      stateVersion: this.stateVersion,
    });
    this.requestResults.set(`complete:${input.requestId}`, result);
    return result;
  }

  async state(rawInput: z.infer<typeof ScheduleStateInputSchema>) {
    ScheduleStateInputSchema.parse(rawInput);
    return ScheduleStateOutputSchema.parse({
      enabled: this.enabled,
      dayOfMonth: this.dayOfMonth,
      localTime: this.localTime,
      nextRunAt: null,
      lastRunAt: null,
      capabilityState: this.capabilityState,
      pendingIntentId:
        this.intent?.state === "awaiting_confirmation" ? this.intent.intentId : null,
      stateVersion: this.stateVersion,
    });
  }
}

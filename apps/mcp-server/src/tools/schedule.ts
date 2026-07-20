import {
  IsoDateTimeSchema,
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
  "capability_unavailable",
  "failed",
]);
const ScheduleOutcomeSchema = z.enum([
  "capability_unavailable",
  "failed",
]);

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
    automationId: z.null(),
  })
  .strict();

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
    enabled: z.literal(false),
    dayOfMonth: z.null(),
    localTime: z.null(),
    nextRunAt: z.null(),
    lastRunAt: z.null(),
    capabilityState: z.literal("unavailable"),
    pendingIntentId: z.null(),
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
      "Возвращает только fail-closed unavailable intent v0.1.",
    inputSchema: ScheduleIntentGetInputSchema,
    outputSchema: ScheduleIntentGetOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: true },
  },
  schedule_intent_complete: {
    title: "Завершить intent расписания",
    description:
      "Инертный endpoint v0.1: успешный host outcome и automation ID запрещены.",
    inputSchema: ScheduleIntentCompleteInputSchema,
    outputSchema: ScheduleIntentCompleteOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: false },
  },
} as const;

export const APP_VISIBLE_SCHEDULE_TOOL_DEFINITIONS = {
  schedule_request: {
    title: "Запросить изменение расписания",
    description:
      "Возвращает unavailable intent без host action, cron, RRULE или shell.",
    inputSchema: ScheduleRequestInputSchema,
    outputSchema: ScheduleRequestOutputSchema,
    annotations: { ...BaseAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  schedule_state: {
    title: "Состояние расписания",
    description: "Возвращает disabled/manual-run состояние v0.1.",
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
      state: "capability_unavailable",
      createdAt: this.now().toISOString(),
      dayOfMonth: null,
      localTime: null,
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
      enabled: false,
      dayOfMonth: null,
      localTime: null,
      nextRunAt: null,
      lastRunAt: null,
      capabilityState: "unavailable",
      pendingIntentId: null,
      stateVersion: this.stateVersion,
    });
  }
}

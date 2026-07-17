import { z } from "zod";

import {
  IsoDateTimeSchema,
  NullableIsoDateTimeSchema,
  OpaqueIdSchema,
} from "./common.js";

const ScheduleIntentBaseShape = {
  intentId: OpaqueIdSchema,
  requestId: OpaqueIdSchema,
  createdAt: IsoDateTimeSchema,
  state: z.enum([
    "requested",
    "awaiting_confirmation",
    "completed",
    "capability_unavailable",
    "failed",
  ]),
};

const DayOfMonthSchema = z.number().int().min(1).max(28);
const LocalTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);

export const ScheduleIntentSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...ScheduleIntentBaseShape,
      action: z.literal("enable"),
      dayOfMonth: DayOfMonthSchema,
      localTime: LocalTimeSchema,
    })
    .strict(),
  z
    .object({
      ...ScheduleIntentBaseShape,
      action: z.literal("update"),
      dayOfMonth: DayOfMonthSchema,
      localTime: LocalTimeSchema,
    })
    .strict(),
  z.object({ ...ScheduleIntentBaseShape, action: z.literal("pause") }).strict(),
  z.object({ ...ScheduleIntentBaseShape, action: z.literal("resume") }).strict(),
  z.object({ ...ScheduleIntentBaseShape, action: z.literal("delete") }).strict(),
]);

const OpaqueAutomationIdSchema = z
  .string()
  .regex(/^automation:v1:[A-Za-z0-9_-]{16,128}$/u);

export const ScheduleStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    enabled: z.boolean(),
    automationId: OpaqueAutomationIdSchema.nullable(),
    dayOfMonth: DayOfMonthSchema.nullable(),
    localTime: LocalTimeSchema.nullable(),
    nextRunAt: NullableIsoDateTimeSchema,
    lastRunAt: NullableIsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    capabilityState: z.enum(["available", "unavailable", "unknown"]),
  })
  .strict()
  .superRefine((state, context) => {
    const configured = [state.automationId, state.dayOfMonth, state.localTime].every(
      (value) => value !== null,
    );
    const empty = [state.automationId, state.dayOfMonth, state.localTime].every(
      (value) => value === null,
    );
    if (!configured && !empty) {
      context.addIssue({ code: "custom", message: "Состояние расписания неполно" });
    }
    if (state.enabled && (!configured || state.capabilityState !== "available")) {
      context.addIssue({
        code: "custom",
        message: "Активное расписание требует capability и полной конфигурации",
        path: ["enabled"],
      });
    }
  });

export type ScheduleIntent = z.infer<typeof ScheduleIntentSchema>;
export type ScheduleState = z.infer<typeof ScheduleStateSchema>;

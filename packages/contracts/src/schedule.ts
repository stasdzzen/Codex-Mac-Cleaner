import { z } from "zod";

import {
  IsoDateTimeSchema,
  OpaqueIdSchema,
} from "./common.js";

const ScheduleIntentBaseShape = {
  intentId: OpaqueIdSchema,
  requestId: OpaqueIdSchema,
  createdAt: IsoDateTimeSchema,
  state: z.enum([
    "requested",
    "awaiting_confirmation",
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

export const ScheduleStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    enabled: z.literal(false),
    automationId: z.null(),
    dayOfMonth: z.null(),
    localTime: z.null(),
    nextRunAt: z.null(),
    lastRunAt: z.null(),
    updatedAt: IsoDateTimeSchema,
    capabilityState: z.enum(["unavailable", "unknown"]),
  })
  .strict();

export type ScheduleIntent = z.infer<typeof ScheduleIntentSchema>;
export type ScheduleState = z.infer<typeof ScheduleStateSchema>;

import { z } from "zod";

import { AuditProgressPhaseSchema, AuditRunStateSchema } from "./audit.js";
import {
  IsoDateTimeSchema,
  ModelSafeTextSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "./common.js";
import { DiskObservationSchema } from "./disk-observation.js";
import { FindingModelViewSchema } from "./finding.js";
import { ToolErrorCodeSchema } from "./errors.js";
import { StorageSummarySchema } from "./storage-summary.js";

export const AuditStartOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    state: z.literal("queued"),
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const AuditStatusOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    progress: z
      .object({
        phase: AuditProgressPhaseSchema,
        completedSteps: SafeIntegerSchema,
        totalSteps: SafeIntegerSchema,
        processedCandidates: SafeIntegerSchema,
        totalCandidates: SafeIntegerSchema,
      })
      .strict()
      .refine((value) => value.completedSteps <= value.totalSteps, {
        message: "Прогресс не может превышать общее число шагов",
      }),
    coverageWarningCodes: z.array(ToolErrorCodeSchema),
  })
  .strict();

export const AuditCancelOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    cancelRequestedAt: IsoDateTimeSchema.nullable(),
  })
  .strict();

export const AuditResultsOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1),
    stateVersion: SafeIntegerSchema,
    storageSummary: StorageSummarySchema,
    diskObservation: DiskObservationSchema,
    excludedCount: SafeIntegerSchema,
    findings: z.array(FindingModelViewSchema),
    nextCursor: OpaqueIdSchema.nullable(),
  })
  .strict();

export const DashboardOpenOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1).nullable(),
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    resourceUri: z.literal("ui://codex-mac-cleaner/dashboard-v2.html"),
    storageSummary: StorageSummarySchema,
    diskObservation: DiskObservationSchema,
    excludedCount: SafeIntegerSchema,
    findings: z.array(FindingModelViewSchema),
  })
  .strict();

export const FindingInspectOutputSchema = z
  .object({
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    stateVersion: SafeIntegerSchema,
    finding: FindingModelViewSchema,
    evidenceSummaries: z.array(ModelSafeTextSchema),
    stale: z.boolean(),
  })
  .strict();

export const FindingRevealOutputSchema = z
  .object({
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    stateVersion: SafeIntegerSchema,
    outcome: z.enum(["revealed", "not_available", "stale"]),
  })
  .strict();

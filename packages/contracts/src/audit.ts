import { z } from "zod";

import {
  IsoDateTimeSchema,
  NullableIsoDateTimeSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "./common.js";
import {
  FindingCategorySchema,
  FindingSchema,
  SupportLevelSchema,
} from "./finding.js";
import { ToolErrorCodeSchema } from "./errors.js";

export const AuditRunStateSchema = z.enum([
  "queued",
  "running",
  "cancelling",
  "cancelled",
  "completed",
  "completed_with_warnings",
  "failed",
]);

export const AuditProgressPhaseSchema = z.enum([
  "queued",
  "discovering_candidates",
  "collecting_global_evidence",
  "correlating_candidates",
  "finalizing",
  "completed",
  "cancelled",
  "failed",
]);

export const AuditSourceSchema = z.enum([
  "application_inventory",
  "user_library_artifacts",
  "process_activity",
  "open_files",
  "startup_items",
  "package_receipts",
  "protected_containers",
  "filesystem_metadata",
  "disk_observation",
]);

export const CapabilityReportSchema = z
  .object({
    supportedSources: z.array(AuditSourceSchema),
    unavailableSources: z.array(
      z
        .object({
          source: AuditSourceSchema,
          errorCode: ToolErrorCodeSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const AuditCoverageSchema = z
  .object({
    checkedSourceCount: SafeIntegerSchema,
    skippedSourceCount: SafeIntegerSchema,
  })
  .strict();

export const AuditWarningSchema = z
  .object({
    errorCode: ToolErrorCodeSchema,
    source: AuditSourceSchema,
  })
  .strict();

const TERMINAL_STATES = new Set<z.infer<typeof AuditRunStateSchema>>([
  "cancelled",
  "completed",
  "completed_with_warnings",
  "failed",
]);
const ACTIONABLE_STATES = new Set<z.infer<typeof AuditRunStateSchema>>([
  "completed",
  "completed_with_warnings",
]);

export const AuditRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    auditId: OpaqueIdSchema,
    requestId: OpaqueIdSchema,
    profile: z.literal("application_remnants"),
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    startedAt: NullableIsoDateTimeSchema,
    finishedAt: NullableIsoDateTimeSchema,
    cancelRequestedAt: NullableIsoDateTimeSchema,
    capabilities: CapabilityReportSchema,
    coverage: AuditCoverageSchema,
    warnings: z.array(AuditWarningSchema),
    revision: SafeIntegerSchema.min(1).nullable(),
  })
  .strict()
  .superRefine((audit, context) => {
    const terminal = TERMINAL_STATES.has(audit.state);
    if (terminal !== (audit.finishedAt !== null)) {
      context.addIssue({
        code: "custom",
        message: "finishedAt должен соответствовать terminal state",
        path: ["finishedAt"],
      });
    }
    if (ACTIONABLE_STATES.has(audit.state) !== (audit.revision !== null)) {
      context.addIssue({
        code: "custom",
        message: "Actionable revision допустима только для завершённого аудита",
        path: ["revision"],
      });
    }
    if (audit.state === "cancelled" && audit.cancelRequestedAt === null) {
      context.addIssue({
        code: "custom",
        message: "Отменённый аудит должен фиксировать запрос отмены",
        path: ["cancelRequestedAt"],
      });
    }
  });

export const AuditReportSchema = z
  .object({
    audit: AuditRunSchema,
    findings: z.array(FindingSchema),
  })
  .strict()
  .superRefine((report, context) => {
    if (
      !ACTIONABLE_STATES.has(report.audit.state) &&
      report.findings.some((finding) => finding.model.allowedActions.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Незавершённый или неуспешный аудит не может содержать allowedActions",
        path: ["findings"],
      });
    }
  });

export const AuditStartInputSchema = z
  .object({
    requestId: OpaqueIdSchema,
    profile: z.literal("application_remnants"),
  })
  .strict();

export const AuditStatusInputSchema = z.object({ auditId: OpaqueIdSchema }).strict();

export const AuditCancelInputSchema = z
  .object({ auditId: OpaqueIdSchema, requestId: OpaqueIdSchema })
  .strict();

export const AuditResultsFilterSchema = z
  .object({
    categories: z.array(FindingCategorySchema).optional(),
    supportLevels: z.array(SupportLevelSchema).optional(),
    labels: z
      .array(
        z.enum([
          "active_required",
          "idle_reproducible",
          "orphaned",
          "duplicate",
          "unknown",
        ]),
      )
      .optional(),
    risks: z.array(z.enum(["low", "medium", "high"])).optional(),
  })
  .strict();

export const AuditResultsInputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1),
    cursor: OpaqueIdSchema.nullable(),
    filters: AuditResultsFilterSchema,
  })
  .strict();

export const DashboardOpenInputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1).nullable(),
  })
  .strict();

export const DashboardPageInputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1),
    cursor: OpaqueIdSchema,
    filters: AuditResultsFilterSchema,
  })
  .strict();

export const FindingInspectInputSchema = z
  .object({ findingId: OpaqueIdSchema, auditRevision: SafeIntegerSchema.min(1) })
  .strict();

export const FindingRevealInputSchema = FindingInspectInputSchema;

export type AuditRun = z.infer<typeof AuditRunSchema>;
export type AuditProgressPhase = z.infer<typeof AuditProgressPhaseSchema>;

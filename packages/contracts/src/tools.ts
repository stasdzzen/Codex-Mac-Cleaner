import { z } from "zod";

import { AuditProgressPhaseSchema, AuditRunStateSchema } from "./audit.js";
import {
  IsoDateTimeSchema,
  ModelSafeTextSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "./common.js";
import { DiskObservationSchema } from "./disk-observation.js";
import { SafeCorrelationViewSchema } from "./correlation.js";
import {
  FindingFactsSchema,
  FindingModelViewSchema,
  FindingWidgetEvidenceSchema,
  ReclaimEstimateSchema,
  SupportLevelSchema,
} from "./finding.js";
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
    revision: SafeIntegerSchema.min(1).nullable(),
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
  .strict()
  .superRefine((value, context) => {
    const completed =
      value.state === "completed" || value.state === "completed_with_warnings";
    if (completed && value.revision === null) {
      context.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Завершённый аудит обязан содержать точную ревизию",
      });
    }
    if (!completed && value.revision !== null) {
      context.addIssue({
        code: "custom",
        path: ["revision"],
        message: "Незавершённый аудит не может публиковать ревизию",
      });
    }
  });

export const AuditCancelOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    cancelRequestedAt: IsoDateTimeSchema.nullable(),
  })
  .strict();

export const FindingSummarySchema = z
  .object({
    totalCount: SafeIntegerSchema,
    matchingCount: SafeIntegerSchema,
    supportLevelCounts: z
      .object({
        candidate: SafeIntegerSchema,
        analysisOnly: SafeIntegerSchema,
        unsupportedManual: SafeIntegerSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((summary, context) => {
    const counted =
      summary.supportLevelCounts.candidate +
      summary.supportLevelCounts.analysisOnly +
      summary.supportLevelCounts.unsupportedManual;
    if (counted !== summary.matchingCount) {
      context.addIssue({
        code: "custom",
        path: ["supportLevelCounts"],
        message: "Сумма уровней поддержки должна совпадать с matchingCount",
      });
    }
    if (summary.matchingCount > summary.totalCount) {
      context.addIssue({
        code: "custom",
        path: ["matchingCount"],
        message: "matchingCount не может превышать totalCount",
      });
    }
  });

export const DashboardFindingSchema = z
  .object({
    findingId: FindingModelViewSchema.shape.findingId,
    displayName: FindingModelViewSchema.shape.displayName,
    componentDisplayName: ModelSafeTextSchema.max(160),
    category: FindingModelViewSchema.shape.category,
    supportLevel: SupportLevelSchema,
    logicalSize: FindingModelViewSchema.shape.logicalSize,
    physicalSize: FindingModelViewSchema.shape.physicalSize,
    label: FindingModelViewSchema.shape.label,
    confidence: FindingModelViewSchema.shape.confidence,
    risk: FindingModelViewSchema.shape.risk,
    allowedActions: FindingModelViewSchema.shape.allowedActions,
    correlationRevisionId:
      SafeCorrelationViewSchema.shape.correlationRevisionId.nullable(),
    ownerBindingState: SafeCorrelationViewSchema.shape.ownerBindingState,
    ownerBindingSourceClass:
      SafeCorrelationViewSchema.shape.ownerBindingSourceClass,
    requirementProfileId: SafeCorrelationViewSchema.shape.requirementProfileId,
    requirementApplicability:
      SafeCorrelationViewSchema.shape.requirementApplicability.nullable(),
    receiptLifecycle:
      SafeCorrelationViewSchema.shape.receiptLifecycle.nullable(),
    facts: SafeCorrelationViewSchema.shape.facts.nullable(),
    coverageSummary: SafeCorrelationViewSchema.shape.coverageSummary,
    staleDuringAudit: SafeCorrelationViewSchema.shape.staleDuringAudit,
    blockingReasonCodes: z.array(ModelSafeTextSchema),
    findingFacts: FindingFactsSchema,
    reclaimEstimate: ReclaimEstimateSchema,
    evidence: z.array(FindingWidgetEvidenceSchema.omit({ details: true })),
    blockingReasons: FindingModelViewSchema.shape.blockingReasons,
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
    findingSummary: FindingSummarySchema,
    findings: z.array(FindingModelViewSchema).max(100),
    nextCursor: OpaqueIdSchema.nullable(),
  })
  .strict();

export const DashboardOpenOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1).nullable(),
    state: AuditRunStateSchema,
    stateVersion: SafeIntegerSchema,
    resourceUri: z.literal("ui://codex-mac-cleaner/dashboard-v4.html"),
    storageSummary: StorageSummarySchema,
    diskObservation: DiskObservationSchema,
    excludedCount: SafeIntegerSchema,
    findingSummary: FindingSummarySchema,
    findings: z.array(FindingModelViewSchema).max(100),
    nextCursor: OpaqueIdSchema.nullable(),
  })
  .strict();

export const DashboardPageOutputSchema = z
  .object({
    auditId: OpaqueIdSchema,
    revision: SafeIntegerSchema.min(1),
    stateVersion: SafeIntegerSchema,
    findingSummary: FindingSummarySchema,
    findings: z.array(DashboardFindingSchema).max(100),
    nextCursor: OpaqueIdSchema.nullable(),
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

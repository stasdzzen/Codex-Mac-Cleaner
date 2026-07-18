import { z } from "zod";

import {
  IsoDateTimeSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "./common.js";
import { AllowedActionSchema } from "./finding.js";

export const Sha256DigestSchema = z
  .string()
  .regex(/^sha256:v1:[a-f0-9]{64}$/u);

export const KeyedDigestSchema = z
  .string()
  .regex(/^hmac-sha256:v1:[a-f0-9]{64}$/u);

export const CorrelationResolutionStateSchema = z.enum([
  "resolved",
  "ambiguous",
  "missing",
  "mismatch",
]);

export const CorrelationClaimKindSchema = z.enum([
  "filesystem",
  "bundle",
  "package",
  "signing",
  "owner",
  "executable",
  "process",
  "open_file",
  "startup_target",
  "receipt_payload",
  "official_uninstaller",
  "dependency",
]);

const ClaimDigestSchema = z
  .object({
    kind: CorrelationClaimKindSchema,
    digest: KeyedDigestSchema,
  })
  .strict();

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const CorrelationSubjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    subjectId: KeyedDigestSchema,
    subjectKind: z.enum([
      "filesystem_object",
      "app_bundle",
      "executable",
      "package",
      "receipt",
      "process",
      "open_file",
      "startup_item",
      "dependency",
    ]),
    claimDigests: z
      .array(ClaimDigestSchema)
      .min(1)
      .refine((claims) => uniqueValues(claims.map(({ kind }) => kind)), {
        message: "Claim kinds не должны повторяться",
      }),
    provenanceIds: z
      .array(OpaqueIdSchema)
      .min(1)
      .refine(uniqueValues, { message: "Provenance IDs не должны повторяться" }),
    snapshotId: OpaqueIdSchema,
    identityFingerprint: Sha256DigestSchema,
    resolutionState: CorrelationResolutionStateSchema,
  })
  .strict();

export const CorrelationEdgeSchema = z
  .object({
    schemaVersion: z.literal(1),
    edgeId: OpaqueIdSchema,
    fromSubjectId: KeyedDigestSchema,
    toSubjectId: KeyedDigestSchema,
    relation: z.enum([
      "belongs_to",
      "installed_as",
      "executes",
      "opens",
      "launches",
      "has_receipt",
      "has_uninstaller",
      "depends_on",
      "maps_payload",
    ]),
    ruleId: OpaqueIdSchema,
    ruleVersion: SafeIntegerSchema.min(1),
    claimKinds: z
      .array(CorrelationClaimKindSchema)
      .min(1)
      .refine(uniqueValues, { message: "Claim kinds не должны повторяться" }),
    strength: z.enum(["authoritative", "corroborated", "hint"]),
    resolutionState: CorrelationResolutionStateSchema,
    provenanceIds: z
      .array(OpaqueIdSchema)
      .min(1)
      .refine(uniqueValues, { message: "Provenance IDs не должны повторяться" }),
    snapshotId: OpaqueIdSchema,
    edgeFingerprint: Sha256DigestSchema,
  })
  .strict()
  .superRefine((edge, context) => {
    if (edge.strength === "hint" && edge.resolutionState === "resolved") {
      context.addIssue({
        code: "custom",
        path: ["resolutionState"],
        message: "Hint не может образовать resolved authority edge",
      });
    }
  });

export const QueryScopeSchema = z.enum([
  "installed_apps",
  "processes",
  "open_files",
  "startup_targets",
  "target_executables",
  "receipts",
  "official_uninstallers",
  "dependencies",
]);

export const CoverageGapCodeSchema = z.enum([
  "capability_missing",
  "permission_denied",
  "partial_inventory",
  "truncated",
  "parse_loss",
  "timeout",
  "cancelled",
  "ambiguous",
  "missing",
  "mismatch",
  "snapshot_stale",
]);

export const SourceProvenanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    provenanceId: OpaqueIdSchema,
    sourceAdapter: OpaqueIdSchema,
    sourceSchemaVersion: SafeIntegerSchema.min(1),
    queryId: OpaqueIdSchema,
    queryScope: QueryScopeSchema,
    snapshotId: OpaqueIdSchema,
    phase: z.enum(["A", "query", "B"]),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.nullable(),
    queryFingerprint: Sha256DigestSchema,
    capabilityState: z.enum(["available", "unavailable"]),
    permissionState: z.enum(["granted", "denied", "not_required"]),
    completionState: z.enum([
      "complete",
      "partial",
      "timed_out",
      "cancelled",
      "failed",
    ]),
    parseState: z.enum(["complete", "loss"]),
    truncated: z.boolean(),
    warningCodes: z
      .array(CoverageGapCodeSchema)
      .refine(uniqueValues, { message: "Warning codes не должны повторяться" }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.completionState === "complete" && value.completedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Complete query требует completedAt",
      });
    }
  });

export const CoverageCertificateSchema = z
  .object({
    schemaVersion: z.literal(1),
    certificateId: OpaqueIdSchema,
    sourceAdapter: OpaqueIdSchema,
    queryScope: QueryScopeSchema,
    subjectId: KeyedDigestSchema,
    snapshotId: OpaqueIdSchema,
    queryFingerprint: Sha256DigestSchema,
    coverageFingerprint: Sha256DigestSchema,
    capabilityState: z.literal("available"),
    permissionState: z.literal("granted"),
    completionState: z.literal("complete"),
    parseState: z.literal("complete"),
    partial: z.literal(false),
    ambiguous: z.literal(false),
    issuedAt: IsoDateTimeSchema,
  })
  .strict();

export const CorrelationFactStateSchema = z.enum([
  "present",
  "absent",
  "unknown",
]);

export const CorrelationFactReasonCodeSchema = z.enum([
  "positive_relation",
  "complete_empty",
  ...CoverageGapCodeSchema.options,
]);

export const CorrelationFactSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("present"),
      reasonCode: z.literal("positive_relation"),
    })
    .strict(),
  z
    .object({
      state: z.literal("absent"),
      reasonCode: z.literal("complete_empty"),
      certificateId: OpaqueIdSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("unknown"),
      reasonCode: CoverageGapCodeSchema,
    })
    .strict(),
]);

export const CorrelationRevisionSchema = z
  .object({
    schemaVersion: z.literal(1),
    derivationVersion: SafeIntegerSchema.min(1),
    correlationRevisionId: OpaqueIdSchema,
    auditId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    snapshotId: OpaqueIdSchema,
    snapshotAFingerprint: Sha256DigestSchema,
    snapshotBFingerprint: Sha256DigestSchema,
    subjectSetDigest: Sha256DigestSchema,
    edgeSetDigest: Sha256DigestSchema,
    coverageReportDigest: Sha256DigestSchema,
    ruleSetVersion: SafeIntegerSchema.min(1),
    policyVersion: SafeIntegerSchema.min(1),
    exclusionStateVersion: SafeIntegerSchema,
    staleDuringAudit: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.staleDuringAudit &&
      value.snapshotAFingerprint !== value.snapshotBFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["staleDuringAudit"],
        message: "Различающиеся Snapshot A/B требуют staleDuringAudit",
      });
    }
  });

export const CorrelationFactSetSchema = z
  .object({
    installedApp: CorrelationFactSchema,
    activity: CorrelationFactSchema,
    openFile: CorrelationFactSchema,
    startupTarget: CorrelationFactSchema,
    targetExecutable: CorrelationFactSchema,
    receipt: CorrelationFactSchema,
    officialUninstaller: CorrelationFactSchema,
    dependency: CorrelationFactSchema,
  })
  .strict();

export const SafeCorrelationViewSchema = z
  .object({
    schemaVersion: z.literal(1),
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    correlationRevisionId: OpaqueIdSchema,
    facts: CorrelationFactSetSchema,
    coverageSummary: z
      .object({
        completeSourceCount: SafeIntegerSchema,
        gapCount: SafeIntegerSchema,
        gapCodes: z
          .array(CoverageGapCodeSchema)
          .refine(uniqueValues, { message: "Gap codes не должны повторяться" }),
      })
      .strict()
      .superRefine((summary, context) => {
        if (summary.gapCount !== summary.gapCodes.length) {
          context.addIssue({
            code: "custom",
            path: ["gapCount"],
            message: "gapCount должен совпадать с количеством gapCodes",
          });
        }
      }),
    staleDuringAudit: z.boolean(),
    blockingReasonCodes: z.array(
      z.enum([
        "coverage_incomplete",
        "positive_counter_evidence",
        "correlation_ambiguous",
        "correlation_missing",
        "correlation_mismatch",
        "snapshot_stale",
        "official_uninstaller_required",
      ]),
    ),
    allowedActions: z
      .array(AllowedActionSchema)
      .refine(uniqueValues, { message: "Actions не должны повторяться" }),
  })
  .strict()
  .superRefine((view, context) => {
    const hasMutationAction = view.allowedActions.some((action) =>
      action.startsWith("prepare_"),
    );
    const hasUnsafeFact = Object.entries(view.facts).some(
      ([factName, fact]) =>
        fact.state === "unknown" ||
        (fact.state === "present" && factName !== "targetExecutable"),
    );
    if (
      hasMutationAction &&
      (view.staleDuringAudit ||
        view.blockingReasonCodes.length > 0 ||
        hasUnsafeFact)
    ) {
      context.addIssue({
        code: "custom",
        path: ["allowedActions"],
        message: "Blocking view не может содержать mutation actions",
      });
    }
  });

export type CorrelationSubject = z.infer<typeof CorrelationSubjectSchema>;
export type CorrelationEdge = z.infer<typeof CorrelationEdgeSchema>;
export type CorrelationClaimKind = z.infer<typeof CorrelationClaimKindSchema>;
export type QueryScope = z.infer<typeof QueryScopeSchema>;
export type CoverageGapCode = z.infer<typeof CoverageGapCodeSchema>;
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;
export type CoverageCertificate = z.infer<typeof CoverageCertificateSchema>;
export type CorrelationFact = z.infer<typeof CorrelationFactSchema>;
export type CorrelationFactSet = z.infer<typeof CorrelationFactSetSchema>;
export type CorrelationRevision = z.infer<typeof CorrelationRevisionSchema>;
export type SafeCorrelationView = z.infer<typeof SafeCorrelationViewSchema>;

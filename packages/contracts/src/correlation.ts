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

export const CorrelationSubjectRoleSchema = z.enum([
  "library_artifact",
  "owner_application",
  "evidence_subject",
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
  "historical_binding",
  "container_metadata",
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
    schemaVersion: z.literal(2),
    subjectId: KeyedDigestSchema,
    subjectRole: CorrelationSubjectRoleSchema,
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
  .strict()
  .superRefine((subject, context) => {
    if (
      subject.subjectRole === "library_artifact" &&
      subject.subjectKind !== "filesystem_object"
    ) {
      context.addIssue({
        code: "custom",
        path: ["subjectKind"],
        message: "Library artifact должен оставаться filesystem object",
      });
    }
    if (
      subject.subjectRole === "owner_application" &&
      !new Set(["app_bundle", "package"]).has(subject.subjectKind)
    ) {
      context.addIssue({
        code: "custom",
        path: ["subjectKind"],
        message: "Owner application должен быть app bundle либо package",
      });
    }
  });

export const CorrelationEdgeSchema = z
  .object({
    schemaVersion: z.literal(2),
    edgeId: OpaqueIdSchema,
    fromSubjectId: KeyedDigestSchema,
    toSubjectId: KeyedDigestSchema,
    relation: z.enum([
      "remnant_of",
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
    if (edge.relation === "remnant_of" && edge.strength !== "authoritative") {
      context.addIssue({
        code: "custom",
        path: ["strength"],
        message: "remnant_of требует authoritative strength",
      });
    }
  });

export const OwnerBindingSourceKindSchema = z.enum([
  "exact_receipt_payload",
  "os_container_metadata",
  "signed_process_open_file_history",
]);

export const OwnerBindingSchema = z
  .object({
    schemaVersion: z.literal(2),
    bindingId: OpaqueIdSchema,
    artifactSubjectId: KeyedDigestSchema,
    ownerSubjectId: KeyedDigestSchema,
    ruleId: OpaqueIdSchema,
    ruleVersion: SafeIntegerSchema.min(1),
    sourceKind: OwnerBindingSourceKindSchema,
    claimDigests: z.array(KeyedDigestSchema).min(2).refine(uniqueValues),
    provenanceIds: z.array(OpaqueIdSchema).min(1).refine(uniqueValues),
    createdAt: IsoDateTimeSchema,
    lastValidatedAt: IsoDateTimeSchema,
    bindingFingerprint: Sha256DigestSchema,
    resolutionState: CorrelationResolutionStateSchema,
  })
  .strict();

export const QueryScopeSchema = z.enum([
  "owner_bindings",
  "installed_apps",
  "owner_executables",
  "processes",
  "open_files",
  "startup_targets",
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
  "unsupported_profile",
]);

export const SourceProvenanceSchema = z
  .object({
    schemaVersion: z.literal(2),
    provenanceId: OpaqueIdSchema,
    sourceAdapter: OpaqueIdSchema,
    sourceSchemaVersion: SafeIntegerSchema.min(2),
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
    warningCodes: z.array(CoverageGapCodeSchema).refine(uniqueValues),
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
    schemaVersion: z.literal(2),
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

export const CorrelationFactStateSchema = z.enum(["present", "absent", "unknown"]);

export const CorrelationFactReasonCodeSchema = z.enum([
  "positive_relation",
  "snapshot_stable",
  "complete_empty",
  "not_applicable",
  ...CoverageGapCodeSchema.options,
]);

export const CorrelationFactSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("present"),
      reasonCode: z.enum(["positive_relation", "snapshot_stable"]),
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
      reasonCode: z.enum(["not_applicable", ...CoverageGapCodeSchema.options]),
    })
    .strict(),
]);

export const ReceiptLifecycleFactSchema = z.discriminatedUnion("lifecycle", [
  z.object({ lifecycle: z.literal("live"), reasonCode: z.literal("exact_payload_live") }).strict(),
  z
    .object({
      lifecycle: z.literal("stale"),
      reasonCode: z.literal("exact_payload_owner_absent"),
      certificateId: OpaqueIdSchema,
    })
    .strict(),
  z
    .object({
      lifecycle: z.literal("absent"),
      reasonCode: z.literal("complete_empty"),
      certificateId: OpaqueIdSchema,
    })
    .strict(),
  z
    .object({
      lifecycle: z.literal("unknown"),
      reasonCode: CoverageGapCodeSchema,
    })
    .strict(),
]);

export const CorrelationRequirementIdSchema = z.enum([
  "artifact_existence",
  "owner_application",
  "owner_executable",
  "activity",
  "open_file",
  "startup_target",
  "receipt",
  "official_uninstaller",
  "dependency",
]);

export const RequirementApplicabilitySchema = z.enum([
  "required",
  "not_applicable",
  "unsupported",
]);

export const RequirementApplicabilityMapSchema = z
  .object({
    artifact_existence: RequirementApplicabilitySchema,
    owner_application: RequirementApplicabilitySchema,
    owner_executable: RequirementApplicabilitySchema,
    activity: RequirementApplicabilitySchema,
    open_file: RequirementApplicabilitySchema,
    startup_target: RequirementApplicabilitySchema,
    receipt: RequirementApplicabilitySchema,
    official_uninstaller: RequirementApplicabilitySchema,
    dependency: RequirementApplicabilitySchema,
  })
  .strict();

const RequirementSchema = z
  .object({
    requirementId: CorrelationRequirementIdSchema,
    applicability: RequirementApplicabilitySchema,
    reasonCode: z.enum([
      "profile_required",
      "private_non_executable_artifact",
      "inspection_only_category",
    ]),
  })
  .strict();

export const CorrelationRequirementProfileSchema = z
  .object({
    schemaVersion: z.literal(2),
    profileId: z.enum(["private_regenerable_remnant_v1", "inspection_only_v1"]),
    profileVersion: SafeIntegerSchema.min(1),
    requirements: z.array(RequirementSchema),
    profileFingerprint: Sha256DigestSchema,
  })
  .strict()
  .superRefine((profile, context) => {
    const ids = profile.requirements.map(({ requirementId }) => requirementId);
    if (
      ids.length !== CorrelationRequirementIdSchema.options.length ||
      !uniqueValues(ids) ||
      CorrelationRequirementIdSchema.options.some((id) => !ids.includes(id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["requirements"],
        message: "Profile должен определить каждый requirement ровно один раз",
      });
      return;
    }
    const byId = new Map(profile.requirements.map((item) => [item.requirementId, item]));
    if (profile.profileId === "private_regenerable_remnant_v1") {
      for (const requirementId of CorrelationRequirementIdSchema.options) {
        const expected = requirementId === "dependency" ? "not_applicable" : "required";
        if (byId.get(requirementId)?.applicability !== expected) {
          context.addIssue({
            code: "custom",
            path: ["requirements"],
            message: "Actionable profile имеет фиксированную applicability",
          });
          break;
        }
      }
    } else if (profile.requirements.some(({ applicability }) => applicability !== "unsupported")) {
      context.addIssue({
        code: "custom",
        path: ["requirements"],
        message: "Inspection-only profile не может создавать prerequisites",
      });
    }
  });

export const CorrelationRevisionSchema = z
  .object({
    schemaVersion: z.literal(2),
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
    ownerBindingFingerprint: Sha256DigestSchema,
    requirementProfileId: z.enum([
      "private_regenerable_remnant_v1",
      "inspection_only_v1",
    ]),
    requirementProfileVersion: SafeIntegerSchema.min(1),
    requirementProfileFingerprint: Sha256DigestSchema,
    ruleSetVersion: SafeIntegerSchema.min(2),
    policyVersion: SafeIntegerSchema.min(2),
    exclusionStateVersion: SafeIntegerSchema,
    staleDuringAudit: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.staleDuringAudit && value.snapshotAFingerprint !== value.snapshotBFingerprint) {
      context.addIssue({
        code: "custom",
        path: ["staleDuringAudit"],
        message: "Различающиеся Snapshot A/B требуют staleDuringAudit",
      });
    }
  });

export const CorrelationFactSetSchema = z
  .object({
    artifactExistence: CorrelationFactSchema,
    ownerApplication: CorrelationFactSchema,
    ownerExecutable: CorrelationFactSchema,
    activity: CorrelationFactSchema,
    openFile: CorrelationFactSchema,
    startupTarget: CorrelationFactSchema,
    officialUninstaller: CorrelationFactSchema,
    dependency: CorrelationFactSchema,
  })
  .strict();

export const SafeCorrelationViewSchema = z
  .object({
    schemaVersion: z.literal(2),
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    correlationRevisionId: OpaqueIdSchema,
    ownerBindingState: z.enum(["resolved", "ambiguous", "missing", "mismatch", "stale"]),
    ownerBindingSourceClass: z.enum(["receipt_payload", "os_metadata", "signed_history", "none"]),
    requirementProfileId: z.enum(["private_regenerable_remnant_v1", "inspection_only_v1"]),
    facts: CorrelationFactSetSchema,
    receiptLifecycle: ReceiptLifecycleFactSchema,
    requirementApplicability: RequirementApplicabilityMapSchema,
    coverageSummary: z
      .object({
        completeSourceCount: SafeIntegerSchema,
        gapCount: SafeIntegerSchema,
        gapCodes: z.array(CoverageGapCodeSchema).refine(uniqueValues),
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
        "owner_binding_required",
        "unsupported_profile",
        "unsupported_requirement",
        "official_uninstaller_required",
      ]),
    ).refine(uniqueValues),
    allowedActions: z.array(AllowedActionSchema).refine(uniqueValues),
  })
  .strict()
  .superRefine((view, context) => {
    const hasMutationAction = view.allowedActions.some((action) => action.startsWith("prepare_"));
    if (!hasMutationAction) return;
    const facts = view.facts;
    const requiredNegative = [
      facts.ownerApplication,
      facts.ownerExecutable,
      facts.activity,
      facts.openFile,
      facts.startupTarget,
      facts.officialUninstaller,
    ];
    const actionable =
      view.ownerBindingState === "resolved" &&
      view.requirementProfileId === "private_regenerable_remnant_v1" &&
      facts.artifactExistence.state === "present" &&
      requiredNegative.every(({ state }) => state === "absent") &&
      facts.dependency.state === "unknown" &&
      facts.dependency.reasonCode === "not_applicable" &&
      view.requirementApplicability.dependency === "not_applicable" &&
      (view.receiptLifecycle.lifecycle === "absent" ||
        view.receiptLifecycle.lifecycle === "stale") &&
      !view.staleDuringAudit &&
      view.blockingReasonCodes.length === 0;
    if (!actionable) {
      context.addIssue({
        code: "custom",
        path: ["allowedActions"],
        message: "Только полный actionable Library profile допускает mutation",
      });
    }
  });

export type CorrelationSubject = z.infer<typeof CorrelationSubjectSchema>;
export type CorrelationSubjectRole = z.infer<typeof CorrelationSubjectRoleSchema>;
export type CorrelationEdge = z.infer<typeof CorrelationEdgeSchema>;
export type OwnerBinding = z.infer<typeof OwnerBindingSchema>;
export type OwnerBindingSourceKind = z.infer<typeof OwnerBindingSourceKindSchema>;
export type CorrelationClaimKind = z.infer<typeof CorrelationClaimKindSchema>;
export type QueryScope = z.infer<typeof QueryScopeSchema>;
export type CoverageGapCode = z.infer<typeof CoverageGapCodeSchema>;
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;
export type CoverageCertificate = z.infer<typeof CoverageCertificateSchema>;
export type CorrelationFact = z.infer<typeof CorrelationFactSchema>;
export type ReceiptLifecycleFact = z.infer<typeof ReceiptLifecycleFactSchema>;
export type CorrelationRequirementId = z.infer<typeof CorrelationRequirementIdSchema>;
export type RequirementApplicability = z.infer<typeof RequirementApplicabilitySchema>;
export type RequirementApplicabilityMap = z.infer<typeof RequirementApplicabilityMapSchema>;
export type CorrelationRequirementProfile = z.infer<typeof CorrelationRequirementProfileSchema>;
export type CorrelationFactSet = z.infer<typeof CorrelationFactSetSchema>;
export type CorrelationRevision = z.infer<typeof CorrelationRevisionSchema>;
export type SafeCorrelationView = z.infer<typeof SafeCorrelationViewSchema>;

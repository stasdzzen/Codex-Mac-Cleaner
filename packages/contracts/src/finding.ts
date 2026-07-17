import { z } from "zod";

import {
  IsoDateTimeSchema,
  ModelSafeTextSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
  hasOnlyValues,
} from "./common.js";
import { ModelSafeMetadataSchema, SensitivityFlagSchema } from "./safe-metadata.js";

export const ArtifactKindSchema = z.enum([
  "file",
  "directory",
  "bundle",
  "plist",
  "launch_item",
  "receipt",
  "unknown",
]);

export const FindingCategorySchema = z.enum([
  "cache",
  "log",
  "webkit",
  "http_storage",
  "saved_state",
  "application_support",
  "container",
  "group_container",
  "preference",
  "database",
  "sync_data",
  "vpn_data",
  "personal_file",
  "autostart",
  "unknown",
]);

export const SupportLevelSchema = z.enum([
  "candidate",
  "analysis_only",
  "unsupported_manual",
]);

export const AllowedActionSchema = z.enum([
  "inspect",
  "reveal",
  "exclude",
  "prepare_move",
  "prepare_restore",
  "prepare_purge",
]);

const NON_MUTATING_ANALYSIS_ACTIONS = new Set<z.infer<typeof AllowedActionSchema>>([
  "inspect",
  "exclude",
]);
const MUTATION_ACTIONS = new Set<z.infer<typeof AllowedActionSchema>>([
  "prepare_move",
  "prepare_restore",
  "prepare_purge",
]);

export const ThreeStateSchema = z.enum(["present", "absent", "unknown"]);

export const FindingFactsSchema = z
  .object({
    lastObservedAt: IsoDateTimeSchema,
    temporalKind: z.enum(["current", "stale", "unknown"]),
    mainBundleState: ThreeStateSchema,
    activityState: ThreeStateSchema,
    openFileState: ThreeStateSchema,
    startupKinds: z.array(
      z.enum([
        "login_item",
        "background_item",
        "launch_agent",
        "launch_daemon",
        "unknown",
      ]),
    ),
    targetExecutableState: ThreeStateSchema,
    receiptState: ThreeStateSchema,
    dependencyState: ThreeStateSchema,
    sensitivityFlags: z.array(SensitivityFlagSchema),
    recommendedRemovalMethod: z.enum([
      "quarantine",
      "official_uninstaller",
      "close_and_recheck",
      "advanced_mode",
      "inspect_only",
    ]),
    blockingReasons: z.array(ModelSafeTextSchema),
  })
  .strict();

export const ReclaimEstimateSchema = z
  .object({
    estimatedPhysicalBytes: SafeIntegerSchema,
    confidence: z.enum(["high", "medium", "low"]),
    basis: z.enum([
      "observed_physical_size",
      "allocated_blocks",
      "metadata_only",
      "unknown",
    ]),
    limitations: z.array(
      z.enum([
        "snapshot_estimate",
        "apfs_shared_blocks",
        "stale_observation",
        "metadata_only",
        "unknown",
      ]),
    ),
    observedAt: IsoDateTimeSchema,
  })
  .strict();

export const FindingModelViewSchema = z
  .object({
    findingId: OpaqueIdSchema,
    displayName: ModelSafeTextSchema.max(160),
    category: FindingCategorySchema,
    supportLevel: SupportLevelSchema,
    logicalSize: SafeIntegerSchema,
    physicalSize: SafeIntegerSchema,
    label: z.enum(["active_required", "idle_reproducible", "orphaned", "duplicate", "unknown"]),
    confidence: z.enum(["high", "medium", "low"]),
    risk: z.enum(["low", "medium", "high"]),
    allowedActions: z
      .array(AllowedActionSchema)
      .refine((actions) => new Set(actions).size === actions.length, {
        message: "Действия не должны повторяться",
      }),
    safeMetadata: ModelSafeMetadataSchema,
    blockingReasons: z.array(ModelSafeTextSchema),
  })
  .strict()
  .superRefine((finding, context) => {
    if (
      finding.supportLevel !== "candidate" &&
      !hasOnlyValues(finding.allowedActions, NON_MUTATING_ANALYSIS_ACTIONS)
    ) {
      context.addIssue({
        code: "custom",
        message: "Этот supportLevel не разрешает filesystem mutation actions",
        path: ["allowedActions"],
      });
    }
    if (
      finding.safeMetadata.sensitivityFlags.length > 0 &&
      finding.allowedActions.some((action) => MUTATION_ACTIONS.has(action))
    ) {
      context.addIssue({
        code: "custom",
        message: "Sensitive metadata блокирует filesystem mutation actions",
        path: ["allowedActions"],
      });
    }
  });

export const FindingWidgetEvidenceSchema = z
  .object({
    evidenceId: OpaqueIdSchema,
    ruleInputType: z.enum([
      "owner",
      "activity",
      "receipt",
      "dependency",
      "temporal",
      "data_kind",
      "capability",
    ]),
    sourceAdapter: z.enum([
      "application_inventory",
      "user_library_artifacts",
      "process_activity",
      "open_files",
      "startup_items",
      "package_receipts",
      "protected_containers",
      "filesystem_metadata",
    ]),
    outcome: z.enum(["confirmed", "contradicted", "unknown"]),
    observedAt: IsoDateTimeSchema,
    summary: ModelSafeTextSchema,
    details: z.array(
      z
        .object({
          key: OpaqueIdSchema,
          value: ModelSafeTextSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const FindingWidgetViewSchema = z
  .object({
    canonicalPath: z.string().min(1).max(4096),
    componentDisplayName: z.string().trim().min(1).max(160),
    findingFacts: FindingFactsSchema,
    reclaimEstimate: ReclaimEstimateSchema,
    evidence: z.array(FindingWidgetEvidenceSchema),
  })
  .strict();

export const FindingSchema = z
  .object({
    model: FindingModelViewSchema,
    widget: FindingWidgetViewSchema,
  })
  .strict();

export type Finding = z.infer<typeof FindingSchema>;
export type FindingModelView = z.infer<typeof FindingModelViewSchema>;

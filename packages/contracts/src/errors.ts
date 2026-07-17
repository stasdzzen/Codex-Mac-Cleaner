import { z } from "zod";

import { ModelSafeTextSchema, OpaqueIdSchema } from "./common.js";

export const ToolErrorCodeSchema = z.enum([
  "CAPABILITY_UNAVAILABLE",
  "PERMISSION_DENIED",
  "AUDIT_STALE",
  "SOURCE_CHANGED",
  "ACTIVE_PROCESS",
  "OPEN_FILE",
  "PATH_OUTSIDE_ALLOWLIST",
  "PROTECTED_PATH",
  "PROTECTED_SCOPE",
  "SENSITIVE_DATA",
  "EXCLUDED_FINDING",
  "EXCLUSION_IDENTITY_MISMATCH",
  "EXCLUSION_STATE_INVALID",
  "OFFICIAL_UNINSTALLER_REQUIRED",
  "UNSUPPORTED_MANUAL",
  "SYMLINK_BOUNDARY",
  "CROSS_VOLUME",
  "MOUNT_POINT_DETECTED",
  "RESTORE_PATH_OCCUPIED",
  "RESTORE_PARENT_CHANGED",
  "PREVIEW_EXPIRED",
  "OPERATION_CONFLICT",
  "MANIFEST_INCONSISTENT",
  "AUTOMATION_CAPABILITY_UNAVAILABLE",
  "SCHEDULE_INTENT_STALE",
  "SCHEDULE_CONFLICT",
  "INTERNAL_ERROR",
]);

export const ToolErrorDetailSchema = z
  .object({
    code: OpaqueIdSchema,
    message: ModelSafeTextSchema,
  })
  .strict();

export const ToolErrorSchema = z
  .object({
    errorCode: ToolErrorCodeSchema,
    severity: z.enum(["warning", "blocking", "fatal"]),
    scope: z.enum(["audit", "finding", "storage", "schedule", "server"]),
    message: ModelSafeTextSchema,
    recommendedAction: ModelSafeTextSchema,
    retryable: z.boolean(),
    correlationId: OpaqueIdSchema,
    details: z.array(ToolErrorDetailSchema),
  })
  .strict();

export type ToolError = z.infer<typeof ToolErrorSchema>;

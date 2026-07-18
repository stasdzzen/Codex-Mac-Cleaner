import { OpaqueIdSchema, SafeIntegerSchema } from "@codex-mac-cleaner/contracts";
import { z } from "zod";

export const PrepareMoveRequestSchema = z
  .object({
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    requestId: OpaqueIdSchema,
  })
  .strict();

export type PrepareMoveRequest = z.infer<typeof PrepareMoveRequestSchema>;

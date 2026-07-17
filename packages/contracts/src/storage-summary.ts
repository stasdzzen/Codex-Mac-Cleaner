import { z } from "zod";

import { SafeIntegerSchema } from "./common.js";

export const StorageSummarySchema = z
  .object({
    candidateLogicalBytes: SafeIntegerSchema,
    candidatePhysicalBytes: SafeIntegerSchema,
    quarantinePhysicalBytes: SafeIntegerSchema,
    purgedPhysicalBytes: SafeIntegerSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export type StorageSummary = z.infer<typeof StorageSummarySchema>;

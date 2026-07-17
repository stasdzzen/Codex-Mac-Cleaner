import { z } from "zod";

import {
  IsoDateTimeSchema,
  ModelSafeTextSchema,
  SafeIntegerSchema,
} from "./common.js";

export const SensitivityFlagSchema = z.enum([
  "credentials",
  "tokens",
  "subscription_url",
  "personal_data",
  "database",
  "local_project",
]);

const SafeMetadataBaseShape = {
  format: z.enum(["json", "yaml", "plist", "unknown"]),
  parseStatus: z.enum(["not_attempted", "parsed", "malformed", "unsupported"]),
  byteLength: SafeIntegerSchema,
  modifiedAt: IsoDateTimeSchema,
  sensitivityFlags: z.array(SensitivityFlagSchema),
};

export const SafeMetadataSchema = z
  .object({
    ...SafeMetadataBaseShape,
    declaredOwnerDisplayName: ModelSafeTextSchema.max(160).nullable(),
  })
  .strict();

export const ModelSafeMetadataSchema = z.object(SafeMetadataBaseShape).strict();

export type SafeMetadata = z.infer<typeof SafeMetadataSchema>;
export type ModelSafeMetadata = z.infer<typeof ModelSafeMetadataSchema>;

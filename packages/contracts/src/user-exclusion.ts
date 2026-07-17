import { z } from "zod";

import { IsoDateTimeSchema, OpaqueIdSchema } from "./common.js";
import { ArtifactKindSchema } from "./finding.js";

const SHA256_IDENTITY_PATTERN = /^[a-f0-9]{64}$/u;

const VersionedOpaqueIdentitySchema = (prefix: string) =>
  z.string().refine(
    (value) => {
      const expectedPrefix = `${prefix}:v1:`;
      return (
        value.startsWith(expectedPrefix) &&
        SHA256_IDENTITY_PATTERN.test(value.slice(expectedPrefix.length))
      );
    },
    { message: "Требуется server-owned opaque identity" },
  );

export const UserExclusionSchema = z
  .object({
    schemaVersion: z.literal(1),
    exclusionId: OpaqueIdSchema,
    ruleId: OpaqueIdSchema,
    artifactKind: ArtifactKindSchema,
    normalizedTargetIdentity: VersionedOpaqueIdentitySchema("target"),
    bundleId: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/u)
      .nullable()
      .optional(),
    packageId: OpaqueIdSchema.nullable().optional(),
    signingIdentity: VersionedOpaqueIdentitySchema("signing").nullable().optional(),
    ownerTypeFingerprint: VersionedOpaqueIdentitySchema("owner-type"),
    createdAt: IsoDateTimeSchema,
    reasonCategory: z.enum(["user_choice", "false_positive", "keep_data", "other"]),
  })
  .strict();

export type UserExclusion = z.infer<typeof UserExclusionSchema>;

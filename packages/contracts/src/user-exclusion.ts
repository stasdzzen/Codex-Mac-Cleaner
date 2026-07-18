import { z } from "zod";

import {
  IsoDateTimeSchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
} from "./common.js";
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

const UserExclusionIdentityShape = {
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
};

export const UserExclusionIdentitySchema = z
  .object(UserExclusionIdentityShape)
  .strict();

export const ExclusionReasonCategorySchema = z.enum([
  "user_choice",
  "false_positive",
  "keep_data",
  "other",
]);

export const UserExclusionSchema = z
  .object({
    schemaVersion: z.literal(1),
    exclusionId: OpaqueIdSchema,
    ...UserExclusionIdentityShape,
    createdAt: IsoDateTimeSchema,
    reasonCategory: ExclusionReasonCategorySchema,
  })
  .strict();

export const UserExclusionStateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    exclusions: z.array(UserExclusionSchema),
  })
  .strict();

export const UserExclusionStateSchema = z
  .object({
    schemaVersion: z.literal(2),
    stateVersion: SafeIntegerSchema,
    updatedAt: IsoDateTimeSchema,
    exclusions: z.array(UserExclusionSchema),
  })
  .strict();

export const ExclusionListItemSchema = UserExclusionSchema.pick({
  exclusionId: true,
  ruleId: true,
  artifactKind: true,
  createdAt: true,
  reasonCategory: true,
}).strict();

export const ExclusionCreateInputSchema = z
  .object({
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    requestId: OpaqueIdSchema,
    reasonCategory: ExclusionReasonCategorySchema,
  })
  .strict();

export const ExclusionListInputSchema = z.object({}).strict();

export const ExclusionRemoveInputSchema = z
  .object({ exclusionId: OpaqueIdSchema, requestId: OpaqueIdSchema })
  .strict();

export const ExclusionResetPrepareInputSchema = z
  .object({ requestId: OpaqueIdSchema })
  .strict();

export const ExclusionResetInputSchema = z
  .object({ resetToken: OpaqueIdSchema, requestId: OpaqueIdSchema })
  .strict();

export const ExclusionCreateOutputSchema = z
  .object({ exclusion: ExclusionListItemSchema, stateVersion: SafeIntegerSchema })
  .strict();

export const ExclusionListOutputSchema = z
  .object({
    exclusions: z.array(ExclusionListItemSchema),
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const ExclusionRemoveOutputSchema = z
  .object({
    removedExclusionId: OpaqueIdSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const ExclusionResetPrepareOutputSchema = z
  .object({
    resetToken: OpaqueIdSchema,
    exclusionCount: SafeIntegerSchema,
    expiresAt: IsoDateTimeSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const ExclusionResetOutputSchema = z
  .object({ removedCount: SafeIntegerSchema, stateVersion: SafeIntegerSchema })
  .strict();

export type UserExclusion = z.infer<typeof UserExclusionSchema>;
export type UserExclusionIdentity = z.infer<typeof UserExclusionIdentitySchema>;
export type UserExclusionState = z.infer<typeof UserExclusionStateSchema>;
export type ExclusionStateReadResult =
  | Readonly<{ status: "ready"; exclusions: readonly UserExclusion[] }>
  | Readonly<{
      status: "invalid";
      errorCode: "EXCLUSION_STATE_INVALID";
      tokenIssuance: "blocked";
    }>;
export type ExclusionListItem = z.infer<typeof ExclusionListItemSchema>;
export type ExclusionCreateInput = z.infer<typeof ExclusionCreateInputSchema>;
export type ExclusionListInput = z.infer<typeof ExclusionListInputSchema>;
export type ExclusionRemoveInput = z.infer<typeof ExclusionRemoveInputSchema>;
export type ExclusionResetPrepareInput = z.infer<
  typeof ExclusionResetPrepareInputSchema
>;
export type ExclusionResetInput = z.infer<typeof ExclusionResetInputSchema>;

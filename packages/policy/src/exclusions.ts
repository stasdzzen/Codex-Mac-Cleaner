import {
  UserExclusionSchema,
  type UserExclusion,
} from "@codex-mac-cleaner/contracts";

import type {
  ExclusionMatch,
  UserExclusionCandidateIdentity,
} from "./types.js";

function optionalIdentity(value: string | null | undefined): string | null {
  return value ?? null;
}

export function matchUserExclusion(
  rawExclusion: unknown,
  candidate: UserExclusionCandidateIdentity,
): ExclusionMatch {
  const parsed = UserExclusionSchema.safeParse(rawExclusion);
  if (!parsed.success) {
    return { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" };
  }
  const exclusion: UserExclusion = parsed.data;
  const matches =
    exclusion.ruleId === candidate.ruleId &&
    exclusion.artifactKind === candidate.artifactKind &&
    exclusion.normalizedTargetIdentity === candidate.normalizedTargetIdentity &&
    optionalIdentity(exclusion.bundleId) === optionalIdentity(candidate.bundleId) &&
    optionalIdentity(exclusion.packageId) === optionalIdentity(candidate.packageId) &&
    optionalIdentity(exclusion.signingIdentity) ===
      optionalIdentity(candidate.signingIdentity) &&
    exclusion.ownerTypeFingerprint === candidate.ownerTypeFingerprint;

  return matches
    ? { status: "matched", exclusionId: exclusion.exclusionId }
    : {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      };
}

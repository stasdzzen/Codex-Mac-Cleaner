import {
  KeyedUserExclusionIdentitySchema,
  KeyedUserExclusionSchema,
  UserExclusionSchema,
  type KeyedUserExclusion,
  type KeyedUserExclusionIdentity,
  type UserExclusion,
} from "@codex-mac-cleaner/contracts";

import type {
  ExclusionMatch,
  UserExclusionCandidateIdentity,
} from "./types.js";

function optionalIdentity(value: string | null | undefined): string | null {
  return value ?? null;
}

function identitiesEqual(
  exclusion: UserExclusion,
  candidate: UserExclusionCandidateIdentity,
): boolean {
  return (
    exclusion.ruleId === candidate.ruleId &&
    exclusion.artifactKind === candidate.artifactKind &&
    exclusion.normalizedTargetIdentity === candidate.normalizedTargetIdentity &&
    optionalIdentity(exclusion.bundleId) === optionalIdentity(candidate.bundleId) &&
    optionalIdentity(exclusion.packageId) === optionalIdentity(candidate.packageId) &&
    optionalIdentity(exclusion.signingIdentity) ===
      optionalIdentity(candidate.signingIdentity) &&
    exclusion.ownerTypeFingerprint === candidate.ownerTypeFingerprint
  );
}

function sameServerTarget(
  exclusion: UserExclusion,
  candidate: UserExclusionCandidateIdentity,
): boolean {
  return (
    exclusion.ruleId === candidate.ruleId &&
    exclusion.normalizedTargetIdentity === candidate.normalizedTargetIdentity
  );
}

export function matchUserExclusions(
  rawExclusions: readonly unknown[],
  candidate: UserExclusionCandidateIdentity,
): ExclusionMatch {
  const parsed: UserExclusion[] = [];
  for (const rawExclusion of rawExclusions) {
    const result = UserExclusionSchema.safeParse(rawExclusion);
    if (!result.success) {
      return { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" };
    }
    parsed.push(result.data);
  }

  const matched = parsed.find((exclusion) => identitiesEqual(exclusion, candidate));
  if (matched !== undefined) {
    return { status: "matched", exclusionId: matched.exclusionId };
  }
  return parsed.some((exclusion) => sameServerTarget(exclusion, candidate))
    ? {
        status: "identity_mismatch",
        errorCode: "EXCLUSION_IDENTITY_MISMATCH",
      }
    : { status: "none" };
}

export function matchUserExclusion(
  rawExclusion: unknown,
  candidate: UserExclusionCandidateIdentity,
): ExclusionMatch {
  return matchUserExclusions([rawExclusion], candidate);
}

function keyedIdentitiesEqual(
  exclusion: KeyedUserExclusion,
  candidate: KeyedUserExclusionIdentity,
): boolean {
  return (
    exclusion.ruleId === candidate.ruleId &&
    exclusion.artifactKind === candidate.artifactKind &&
    exclusion.keyId === candidate.keyId &&
    exclusion.derivationVersion === candidate.derivationVersion &&
    exclusion.subjectDigest === candidate.subjectDigest &&
    exclusion.claimDigests.length === candidate.claimDigests.length &&
    exclusion.claimDigests.every(
      (claim, index) =>
        claim.kind === candidate.claimDigests[index]?.kind &&
        claim.digest === candidate.claimDigests[index]?.digest,
    )
  );
}

function sameKeyedServerTarget(
  exclusion: KeyedUserExclusion,
  candidate: KeyedUserExclusionIdentity,
): boolean {
  return (
    exclusion.ruleId === candidate.ruleId &&
    exclusion.artifactKind === candidate.artifactKind &&
    exclusion.subjectDigest === candidate.subjectDigest
  );
}

export function matchKeyedUserExclusions(
  rawExclusions: readonly unknown[],
  rawCandidate: unknown,
): ExclusionMatch {
  const candidate = KeyedUserExclusionIdentitySchema.safeParse(rawCandidate);
  if (!candidate.success) {
    return { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" };
  }
  const exclusions: KeyedUserExclusion[] = [];
  for (const rawExclusion of rawExclusions) {
    const parsed = KeyedUserExclusionSchema.safeParse(rawExclusion);
    if (!parsed.success) {
      return { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" };
    }
    exclusions.push(parsed.data);
  }
  const matched = exclusions.find((entry) =>
    keyedIdentitiesEqual(entry, candidate.data),
  );
  if (matched !== undefined) {
    return { status: "matched", exclusionId: matched.exclusionId };
  }
  return exclusions.some((entry) => sameKeyedServerTarget(entry, candidate.data))
    ? { status: "identity_mismatch", errorCode: "EXCLUSION_IDENTITY_MISMATCH" }
    : { status: "none" };
}

export type KeyedExclusionStateForPolicy =
  | Readonly<{ status: "ready"; exclusions: readonly unknown[] }>
  | Readonly<{
      status: "invalid";
      errorCode: string;
      tokenIssuance: "blocked";
    }>;

export async function assertKeyedDestructiveTokenAllowed(
  identity: KeyedUserExclusionIdentity,
  loadExclusionState: () => Promise<KeyedExclusionStateForPolicy>,
): Promise<void> {
  const state = await loadExclusionState();
  if (state.status === "invalid") {
    throw new ExclusionPolicyError("EXCLUSION_STATE_INVALID", "fatal");
  }
  const match = matchKeyedUserExclusions(state.exclusions, identity);
  if (match.status === "invalid") {
    throw new ExclusionPolicyError("EXCLUSION_STATE_INVALID", "fatal");
  }
  if (match.status === "matched") {
    throw new ExclusionPolicyError("EXCLUDED_FINDING", "blocking");
  }
}

export type ExclusionStateForPolicy =
  | Readonly<{ status: "ready"; exclusions: readonly unknown[] }>
  | Readonly<{
      status: "invalid";
      errorCode: "EXCLUSION_STATE_INVALID";
      tokenIssuance: "blocked";
    }>;

export class ExclusionPolicyError extends Error {
  readonly retryable = false;

  constructor(
    readonly errorCode: "EXCLUDED_FINDING" | "EXCLUSION_STATE_INVALID",
    readonly severity: "blocking" | "fatal",
  ) {
    super(errorCode);
    this.name = "ExclusionPolicyError";
  }
}

interface PrefilterExcludedFindingsOptions<TCandidate, TFinding> {
  readonly candidates: readonly TCandidate[];
  readonly exclusionState: ExclusionStateForPolicy;
  readonly discoverIdentity: (
    candidate: TCandidate,
  ) => Promise<UserExclusionCandidateIdentity>;
  readonly analyze: (candidate: TCandidate) => Promise<TFinding>;
}

export async function prefilterExcludedFindings<TCandidate, TFinding>(
  options: PrefilterExcludedFindingsOptions<TCandidate, TFinding>,
): Promise<{
  readonly findings: readonly TFinding[];
  readonly excludedCount: number;
  readonly tokenIssuance: "allowed" | "blocked";
}> {
  const invalidState =
    options.exclusionState.status === "invalid" ||
    options.exclusionState.exclusions.some(
      (exclusion) => !UserExclusionSchema.safeParse(exclusion).success,
    );
  if (invalidState) {
    return {
      findings: await Promise.all(options.candidates.map(options.analyze)),
      excludedCount: 0,
      tokenIssuance: "blocked",
    };
  }

  const findings: TFinding[] = [];
  let excludedCount = 0;
  for (const candidate of options.candidates) {
    const identity = await options.discoverIdentity(candidate);
    const match = matchUserExclusions(options.exclusionState.exclusions, identity);
    if (match.status === "matched") {
      excludedCount += 1;
      continue;
    }
    findings.push(await options.analyze(candidate));
  }
  return { findings, excludedCount, tokenIssuance: "allowed" };
}

export async function assertDestructiveTokenAllowed(
  identity: UserExclusionCandidateIdentity,
  loadExclusionState: () => Promise<ExclusionStateForPolicy>,
): Promise<void> {
  const state = await loadExclusionState();
  if (state.status === "invalid") {
    throw new ExclusionPolicyError("EXCLUSION_STATE_INVALID", "fatal");
  }
  const match = matchUserExclusions(state.exclusions, identity);
  if (match.status === "invalid") {
    throw new ExclusionPolicyError("EXCLUSION_STATE_INVALID", "fatal");
  }
  if (match.status === "matched") {
    throw new ExclusionPolicyError("EXCLUDED_FINDING", "blocking");
  }
}

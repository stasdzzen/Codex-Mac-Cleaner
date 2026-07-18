import { createHash } from "node:crypto";

import {
  consumeEphemeralCorrelationInput,
  validateRawCorrelationPayload,
  type EphemeralCorrelationInput,
  type RawCorrelationPayload,
  type RawIdentityClaim,
  type RawIdentitySubject,
  type RawQueryState,
  type RawSourceQuery,
} from "@codex-mac-cleaner/adapters";
import {
  CorrelationEdgeSchema,
  CorrelationRequirementProfileSchema,
  CorrelationRevisionSchema,
  CorrelationSubjectSchema,
  CoverageCertificateSchema,
  OwnerBindingSchema,
  SafeCorrelationViewSchema,
  SourceProvenanceSchema,
  type CorrelationClaimKind,
  type CorrelationEdge,
  type CorrelationFact,
  type CorrelationRequirementId,
  type CorrelationRequirementProfile,
  type CorrelationRevision,
  type CorrelationSubject,
  type CoverageCertificate,
  type CoverageGapCode,
  type OwnerBinding,
  type OwnerBindingSourceKind,
  type QueryScope,
  type ReceiptLifecycleFact,
  type RequirementApplicabilityMap,
  type SafeCorrelationView,
  type SourceProvenance,
} from "@codex-mac-cleaner/contracts";

export interface KeyedDigestDeriver {
  readonly keyId: string;
  readonly derivationVersion: number;
  derive(domain: string, kind: string, value: string): `hmac-sha256:v1:${string}`;
}

type ResolutionState = "resolved" | "ambiguous" | "missing" | "mismatch";
export type CorrelationFactName = keyof SafeCorrelationView["facts"];
export type CorrelationResolutionByFact = Readonly<Record<CorrelationFactName, ResolutionState>>;

export interface ResolveCorrelationInput {
  readonly auditId: string;
  readonly auditRevision: number;
  readonly findingId: string;
  readonly exclusionStateVersion: number;
  readonly ruleSetVersion: number;
  readonly policyVersion: number;
  readonly now: string;
  readonly deriver: KeyedDigestDeriver;
  readonly rawInput: EphemeralCorrelationInput;
}

export interface CorrelationResolverResult {
  readonly candidateSubjectId: string;
  readonly subjects: readonly CorrelationSubject[];
  readonly edges: readonly CorrelationEdge[];
  readonly ownerBindings: readonly OwnerBinding[];
  readonly provenance: readonly SourceProvenance[];
  readonly certificates: readonly CoverageCertificate[];
  readonly resolutionStates: CorrelationResolutionByFact;
  /** Compatibility alias: это state authoritative owner binding, не OS uid/gid. */
  readonly ownerResolutionState: ResolutionState;
  readonly revision: CorrelationRevision;
  readonly safeView: SafeCorrelationView;
}

interface BindingResolution {
  readonly state: ResolutionState;
  readonly subject?: RawIdentitySubject;
  readonly sourceKind?: OwnerBindingSourceKind;
  readonly claimKinds: readonly CorrelationClaimKind[];
  readonly bindingFingerprint: string;
}

function sha256(value: string): `sha256:v1:${string}` {
  return `sha256:v1:${createHash("sha256").update(value).digest("hex")}`;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function claim<TKind extends RawIdentityClaim["kind"]>(
  subject: RawIdentitySubject,
  kind: TKind,
): Extract<RawIdentityClaim, { readonly kind: TKind }> | undefined {
  return subject.claims.find(
    (entry): entry is Extract<RawIdentityClaim, { readonly kind: TKind }> => entry.kind === kind,
  );
}

function claimKind(value: RawIdentityClaim): CorrelationClaimKind | null {
  return value.kind === "hint" ? null : value.kind;
}

function canonicalClaim(value: RawIdentityClaim): string | null {
  if (value.kind === "hint") return null;
  if (value.kind === "filesystem") {
    return stable({
      kind: value.kind,
      device: value.device,
      inode: value.inode,
      fileType: value.fileType,
      uid: value.uid,
      gid: value.gid,
      fingerprint: value.fingerprint,
    });
  }
  return stable(value);
}

function queryClaimDigest(
  deriver: KeyedDigestDeriver,
  value: RawIdentityClaim,
): `hmac-sha256:v1:${string}` | null {
  const kind = claimKind(value);
  const canonical = canonicalClaim(value);
  return kind === null || canonical === null
    ? null
    : deriver.derive("cmc:correlation:query-claim:v2", kind, canonical);
}

function keyedStrongClaims(
  subject: RawIdentitySubject,
  deriver: KeyedDigestDeriver,
): readonly `hmac-sha256:v1:${string}`[] {
  return subject.claims
    .map((value) => queryClaimDigest(deriver, value))
    .filter((value): value is `hmac-sha256:v1:${string}` => value !== null)
    .sort();
}

function queryGap(query: RawSourceQuery): CoverageGapCode | null {
  if (query.state !== "complete") return query.state;
  return query.coverageKind === "supplemental" ? "partial_inventory" : null;
}

function provenanceFor(
  query: RawSourceQuery,
  expectedSnapshotId: string,
  deriver: KeyedDigestDeriver,
): SourceProvenance {
  const gap = query.snapshotId === expectedSnapshotId ? queryGap(query) : "snapshot_stale";
  return SourceProvenanceSchema.parse({
    schemaVersion: 2,
    provenanceId: `provenance-${query.queryScope.replaceAll("_", "-")}`,
    sourceAdapter: query.sourceAdapter,
    sourceSchemaVersion: query.sourceSchemaVersion,
    queryId: query.queryId,
    queryScope: query.queryScope,
    snapshotId: query.snapshotId,
    phase: "query",
    startedAt: query.startedAt,
    completedAt: query.completedAt,
    queryFingerprint: sha256(stable({
      scope: query.queryScope,
      coverageKind: query.coverageKind,
      state: query.state,
      subjects: query.subjects.map((subject) => keyedStrongClaims(subject, deriver)),
    })),
    capabilityState: query.state === "capability_missing" ? "unavailable" : "available",
    permissionState: query.state === "permission_denied"
      ? "denied"
      : query.state === "capability_missing" ? "not_required" : "granted",
    completionState: query.state === "complete"
      ? "complete"
      : query.state === "timeout" ? "timed_out"
        : query.state === "cancelled" ? "cancelled"
          : query.state === "partial_inventory" || query.state === "truncated" ? "partial" : "failed",
    parseState: query.state === "parse_loss" ? "loss" : "complete",
    truncated: query.state === "truncated",
    warningCodes: gap === null ? [] : [gap],
  });
}

function subjectFor(
  raw: RawIdentitySubject,
  provenanceIds: readonly string[],
  snapshotId: string,
  resolutionState: ResolutionState,
  deriver: KeyedDigestDeriver,
): CorrelationSubject | null {
  const claims = raw.claims
    .map((value) => {
      const kind = claimKind(value);
      const canonical = canonicalClaim(value);
      return kind === null || canonical === null ? null : {
        kind,
        digest: deriver.derive("cmc:correlation:claim:v2", kind, canonical),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.kind.localeCompare(right.kind));
  if (claims.length === 0) return null;
  const subjectId = deriver.derive(
    "cmc:correlation:subject:v2",
    `${raw.subjectRole}:${raw.subjectKind}`,
    stable(claims),
  );
  return CorrelationSubjectSchema.parse({
    schemaVersion: 2,
    subjectId,
    subjectRole: raw.subjectRole,
    subjectKind: raw.subjectKind,
    claimDigests: claims,
    provenanceIds: [...new Set(provenanceIds)].sort(),
    snapshotId,
    identityFingerprint: sha256(stable(claims)),
    resolutionState,
  });
}

function resolveBinding(
  payload: RawCorrelationPayload,
  query: RawSourceQuery,
  deriver: KeyedDigestDeriver,
): BindingResolution {
  const filesystem = claim(payload.candidate, "filesystem");
  const owner = claim(payload.candidate, "owner");
  const structuralMismatch = filesystem !== undefined && owner !== undefined &&
    (filesystem.uid !== owner.uid || filesystem.gid !== owner.gid);
  if (filesystem === undefined || owner === undefined) {
    return { state: "missing", claimKinds: [], bindingFingerprint: "binding-missing" };
  }
  if (structuralMismatch) {
    return { state: "mismatch", claimKinds: ["filesystem", "owner"], bindingFingerprint: "binding-mismatch" };
  }
  const outcomes = query.subjects.map((subject) => {
    const receipt = claim(subject, "receipt_payload");
    const packageClaim = claim(subject, "package");
    const container = claim(subject, "container_metadata");
    const bundle = claim(subject, "bundle");
    const history = claim(subject, "historical_binding");
    if (subject.bindingSourceKind === "exact_receipt_payload" && receipt && packageClaim) {
      return receipt.targetFilesystemFingerprint === filesystem.fingerprint &&
        receipt.packageIdentifier === packageClaim.packageIdentifier
        ? { subject, match: true, kinds: ["filesystem", "package", "receipt_payload"] as const }
        : { subject, match: false, conflict: true };
    }
    if (subject.bindingSourceKind === "os_container_metadata" && container && bundle) {
      return container.individualContainer &&
        container.targetFilesystemFingerprint === filesystem.fingerprint &&
        container.bundleIdentifier === bundle.bundleIdentifier
        ? { subject, match: true, kinds: ["filesystem", "bundle", "container_metadata"] as const }
        : { subject, match: false, conflict: true };
    }
    if (subject.bindingSourceKind === "signed_process_open_file_history" && history) {
      const expected = {
        keyId: deriver.keyId,
        derivationVersion: deriver.derivationVersion,
        artifactDigest: deriver.derive("cmc:owner-history:v1", "artifact", filesystem.fingerprint),
        ownerTypeDigest: deriver.derive("cmc:owner-history:v1", "owner-type", payload.snapshotA.ownerTypeFingerprint),
        rootDigest: deriver.derive("cmc:owner-history:v1", "root", payload.snapshotA.parentFingerprint),
      };
      const matches = history.keyId === expected.keyId &&
        history.derivationVersion === expected.derivationVersion &&
        history.artifactDigest === expected.artifactDigest &&
        history.ownerTypeDigest === expected.ownerTypeDigest &&
        history.rootDigest === expected.rootDigest;
      return matches
        ? { subject, match: true, kinds: ["filesystem", "historical_binding"] as const }
        : { subject, match: false, conflict: true };
    }
    return { subject, match: false, conflict: true };
  });
  const matches = outcomes.filter((outcome) => outcome.match);
  if (queryGap(query) !== null) {
    return { state: "missing", claimKinds: [], bindingFingerprint: "binding-incomplete" };
  }
  if (matches.length > 1) {
    return { state: "ambiguous", claimKinds: [], bindingFingerprint: "binding-ambiguous" };
  }
  if (matches.length === 1) {
    const match = matches[0]!;
    return {
      state: "resolved",
      subject: match.subject,
      sourceKind: match.subject.bindingSourceKind!,
      claimKinds: [...match.kinds!],
      bindingFingerprint: claim(match.subject, "historical_binding")?.bindingFingerprint ??
        sha256(stable(keyedStrongClaims(match.subject, deriver))),
    };
  }
  return {
    state: outcomes.some((outcome) => outcome.conflict) ? "mismatch" : "missing",
    claimKinds: [],
    bindingFingerprint: outcomes.length > 0 ? "binding-mismatch" : "binding-missing",
  };
}

function historyClaim(binding: BindingResolution) {
  return binding.subject === undefined ? undefined : claim(binding.subject, "historical_binding");
}

function ownerMatch(
  binding: BindingResolution,
  target: RawIdentitySubject,
  deriver: KeyedDigestDeriver,
): "match" | "conflict" | "unrelated" | "missing" {
  const history = historyClaim(binding);
  if (history !== undefined) {
    const bundle = claim(target, "bundle");
    const signing = claim(target, "signing");
    const executable = claim(target, "executable");
    if (!bundle || !signing || !executable) return "missing";
    const values = [bundle, signing, executable].map((value) => queryClaimDigest(deriver, value));
    const expected = [history.ownerBundleDigest, history.ownerSigningDigest, history.ownerExecutableDigest];
    const checks = values.map((value, index) => value === expected[index]);
    if (checks.every(Boolean)) return "match";
    return checks.some(Boolean) ? "conflict" : "unrelated";
  }
  const bindingPackage = binding.subject === undefined ? undefined : claim(binding.subject, "package");
  const targetPackage = claim(target, "package");
  if (bindingPackage !== undefined) {
    if (targetPackage === undefined) return "unrelated";
    return bindingPackage.packageIdentifier === targetPackage.packageIdentifier ? "match" : "unrelated";
  }
  const bindingBundle = binding.subject === undefined ? undefined : claim(binding.subject, "bundle");
  const targetBundle = claim(target, "bundle");
  if (bindingBundle !== undefined) {
    if (!targetBundle || !claim(target, "signing") || !claim(target, "executable")) return "missing";
    return bindingBundle.bundleIdentifier === targetBundle.bundleIdentifier ? "match" : "unrelated";
  }
  return "missing";
}

function factFromQuery(
  query: RawSourceQuery,
  snapshotId: string,
  matcher: (subject: RawIdentitySubject) => "match" | "conflict" | "unrelated" | "missing",
): Readonly<{ fact: CorrelationFact; resolution: ResolutionState; match?: RawIdentitySubject }> {
  if (query.snapshotId !== snapshotId) {
    return { fact: { state: "unknown", reasonCode: "snapshot_stale" }, resolution: "mismatch" };
  }
  const outcomes = query.subjects.map((subject) => ({ subject, outcome: matcher(subject) }));
  const matches = outcomes.filter(({ outcome }) => outcome === "match");
  if (matches.length > 1) {
    return { fact: { state: "unknown", reasonCode: "ambiguous" }, resolution: "ambiguous" };
  }
  if (matches.length === 1) {
    return {
      fact: { state: "present", reasonCode: "positive_relation" },
      resolution: "resolved",
      match: matches[0]!.subject,
    };
  }
  if (outcomes.some(({ outcome }) => outcome === "conflict")) {
    return { fact: { state: "unknown", reasonCode: "mismatch" }, resolution: "mismatch" };
  }
  if (outcomes.some(({ outcome }) => outcome === "missing")) {
    return { fact: { state: "unknown", reasonCode: "missing" }, resolution: "missing" };
  }
  const gap = queryGap(query);
  if (gap !== null) return { fact: { state: "unknown", reasonCode: gap }, resolution: "resolved" };
  return { fact: { state: "unknown", reasonCode: "missing" }, resolution: "resolved" };
}

function profileFor(payload: RawCorrelationPayload, binding: BindingResolution): CorrelationRequirementProfile {
  const actionable = (payload.artifactCategory === "cache" || payload.artifactCategory === "log") &&
    payload.artifactPrivateNonExecutable && binding.state === "resolved";
  const profileId = actionable ? "private_regenerable_remnant_v1" : "inspection_only_v1";
  const requirements = ([
    "artifact_existence",
    "owner_application",
    "owner_executable",
    "activity",
    "open_file",
    "startup_target",
    "receipt",
    "official_uninstaller",
    "dependency",
  ] as const satisfies readonly CorrelationRequirementId[]).map((requirementId) => ({
    requirementId,
    applicability: actionable ? (requirementId === "dependency" ? "not_applicable" : "required") : "unsupported",
    reasonCode: actionable
      ? requirementId === "dependency" ? "private_non_executable_artifact" : "profile_required"
      : "inspection_only_category",
  }));
  return CorrelationRequirementProfileSchema.parse({
    schemaVersion: 2,
    profileId,
    profileVersion: 1,
    requirements,
    profileFingerprint: sha256(stable({ profileId, requirements })),
  });
}

function certificateFor(
  query: RawSourceQuery,
  provenance: SourceProvenance,
  subjectId: string,
  now: string,
): CoverageCertificate {
  return CoverageCertificateSchema.parse({
    schemaVersion: 2,
    certificateId: `certificate-${query.queryScope.replaceAll("_", "-")}`,
    sourceAdapter: query.sourceAdapter,
    queryScope: query.queryScope,
    subjectId,
    snapshotId: query.snapshotId,
    queryFingerprint: provenance.queryFingerprint,
    coverageFingerprint: sha256(stable({
      subjectId,
      scope: query.queryScope,
      coverageKind: query.coverageKind,
      queryFingerprint: provenance.queryFingerprint,
    })),
    capabilityState: "available",
    permissionState: "granted",
    completionState: "complete",
    parseState: "complete",
    partial: false,
    ambiguous: false,
    issuedAt: now,
  });
}

function sourceClass(source?: OwnerBindingSourceKind): SafeCorrelationView["ownerBindingSourceClass"] {
  return source === "exact_receipt_payload" ? "receipt_payload"
    : source === "os_container_metadata" ? "os_metadata"
      : source === "signed_process_open_file_history" ? "signed_history" : "none";
}

function buildResult(input: ResolveCorrelationInput, payload: RawCorrelationPayload): CorrelationResolverResult {
  validateRawCorrelationPayload(payload);
  const queries = new Map(payload.queries.map((query) => [query.queryScope, query] as const));
  const provenance = payload.queries.map((query) => provenanceFor(query, payload.snapshotId, input.deriver));
  const provenanceByScope = new Map(provenance.map((entry) => [entry.queryScope, entry] as const));
  const stale = stable(payload.snapshotA) !== stable(payload.snapshotB) ||
    payload.queries.some((query) => query.snapshotId !== payload.snapshotId);
  const bindingQuery = queries.get("owner_bindings")!;
  const binding = resolveBinding(payload, bindingQuery, input.deriver);
  const profile = profileFor(payload, binding);
  const applicability = Object.fromEntries(
    profile.requirements.map(({ requirementId, applicability: state }) => [requirementId, state]),
  ) as RequirementApplicabilityMap;
  const candidate = subjectFor(
    payload.candidate,
    provenance.map(({ provenanceId }) => provenanceId),
    payload.snapshotId,
    "resolved",
    input.deriver,
  );
  if (candidate === null) throw new TypeError("Library artifact не содержит strong typed claims");
  const subjects: CorrelationSubject[] = [candidate];
  const edges: CorrelationEdge[] = [];
  const ownerBindings: OwnerBinding[] = [];
  let ownerSubject: CorrelationSubject | undefined;
  if (binding.state === "resolved" && binding.subject !== undefined && binding.sourceKind !== undefined) {
    const bindingProvenance = provenanceByScope.get("owner_bindings")!;
    ownerSubject = subjectFor(binding.subject, [bindingProvenance.provenanceId], payload.snapshotId, "resolved", input.deriver) ?? undefined;
    if (ownerSubject !== undefined) {
      subjects.push(ownerSubject);
      const edgeFingerprint = sha256(stable({
        artifact: candidate.subjectId,
        owner: ownerSubject.subjectId,
        sourceKind: binding.sourceKind,
        bindingFingerprint: binding.bindingFingerprint,
      }));
      edges.push(CorrelationEdgeSchema.parse({
        schemaVersion: 2,
        edgeId: `edge-${edgeFingerprint.slice(-24)}`,
        fromSubjectId: candidate.subjectId,
        toSubjectId: ownerSubject.subjectId,
        relation: "remnant_of",
        ruleId: "CORRELATION_REMNANT_OWNER_V2",
        ruleVersion: 2,
        claimKinds: [...binding.claimKinds],
        strength: "authoritative",
        resolutionState: "resolved",
        provenanceIds: [bindingProvenance.provenanceId],
        snapshotId: payload.snapshotId,
        edgeFingerprint,
      }));
      const bindingClaims = [
        input.deriver.derive("cmc:owner-binding:v2", "artifact", candidate.subjectId),
        input.deriver.derive("cmc:owner-binding:v2", "owner", ownerSubject.subjectId),
      ] as const;
      ownerBindings.push(OwnerBindingSchema.parse({
        schemaVersion: 2,
        bindingId: `binding-${edgeFingerprint.slice(-24)}`,
        artifactSubjectId: candidate.subjectId,
        ownerSubjectId: ownerSubject.subjectId,
        ruleId: "CORRELATION_REMNANT_OWNER_V2",
        ruleVersion: 2,
        sourceKind: binding.sourceKind,
        claimDigests: bindingClaims,
        provenanceIds: [bindingProvenance.provenanceId],
        createdAt: input.now,
        lastValidatedAt: input.now,
        bindingFingerprint: edgeFingerprint,
        resolutionState: "resolved",
      }));
    }
  }

  const filesystem = claim(payload.candidate, "filesystem");
  const owner = claim(payload.candidate, "owner");
  const artifactStable = !stale && filesystem !== undefined && owner !== undefined &&
    filesystem.uid === owner.uid && filesystem.gid === owner.gid;
  const artifactExistence: CorrelationFact = artifactStable
    ? { state: "present", reasonCode: "snapshot_stable" }
    : { state: "unknown", reasonCode: stale ? "snapshot_stale" : filesystem === undefined || owner === undefined ? "missing" : "mismatch" };

  const installed = factFromQuery(
    queries.get("installed_apps")!,
    payload.snapshotId,
    (subject) => ownerMatch(binding, subject, input.deriver),
  );
  const history = historyClaim(binding);
  const executableMatcher = (subject: RawIdentitySubject) => {
    const executable = claim(subject, "executable");
    if (!executable) return "missing" as const;
    if (history === undefined) return "match" as const;
    return queryClaimDigest(input.deriver, executable) === history.ownerExecutableDigest ? "match" as const : "unrelated" as const;
  };
  const processMatcher = (subject: RawIdentitySubject) => {
    const process = claim(subject, "process");
    if (!process) return "missing" as const;
    if (history === undefined) return "match" as const;
    const executable: RawIdentityClaim = { kind: "executable", executableFingerprint: process.executableFingerprint };
    return queryClaimDigest(input.deriver, executable) === history.ownerExecutableDigest ? "match" as const : "unrelated" as const;
  };
  const openMatcher = (subject: RawIdentitySubject) => {
    const open = claim(subject, "open_file");
    if (!open || !filesystem) return "missing" as const;
    return open.targetFilesystemFingerprint === filesystem.fingerprint ? "match" as const : "unrelated" as const;
  };
  const startupMatcher = (subject: RawIdentitySubject) => {
    const startup = claim(subject, "startup_target");
    if (!startup) return "missing" as const;
    if (history === undefined) return "match" as const;
    const executable: RawIdentityClaim = { kind: "executable", executableFingerprint: startup.executableFingerprint };
    return queryClaimDigest(input.deriver, executable) === history.ownerExecutableDigest ? "match" as const : "unrelated" as const;
  };
  const ownerExecutable = factFromQuery(queries.get("owner_executables")!, payload.snapshotId, executableMatcher);
  const activity = factFromQuery(queries.get("processes")!, payload.snapshotId, processMatcher);
  const openFile = factFromQuery(queries.get("open_files")!, payload.snapshotId, openMatcher);
  const startupTarget = factFromQuery(queries.get("startup_targets")!, payload.snapshotId, startupMatcher);
  const officialUninstaller = factFromQuery(
    queries.get("official_uninstallers")!,
    payload.snapshotId,
    (subject) => claim(subject, "official_uninstaller") ? "match" : "missing",
  );
  const dependency = factFromQuery(
    queries.get("dependencies")!,
    payload.snapshotId,
    (subject) => claim(subject, "dependency") ? "match" : "missing",
  );
  const receipts = factFromQuery(
    queries.get("receipts")!,
    payload.snapshotId,
    (subject) => {
      const receipt = claim(subject, "receipt_payload");
      if (!receipt || !filesystem) return "missing";
      return receipt.targetFilesystemFingerprint === filesystem.fingerprint ? "match" : "unrelated";
    },
  );

  const factResults = {
    ownerApplication: installed,
    ownerExecutable,
    activity,
    openFile,
    startupTarget,
    officialUninstaller,
    dependency,
  } as const;
  const certificates: CoverageCertificate[] = [];
  type CertifiableFactName = Exclude<CorrelationFactName, "artifactExistence" | "dependency">;
  const certificateScopes: readonly [CertifiableFactName, QueryScope][] = [
    ["ownerApplication", "installed_apps"],
    ["ownerExecutable", "owner_executables"],
    ["activity", "processes"],
    ["openFile", "open_files"],
    ["startupTarget", "startup_targets"],
    ["officialUninstaller", "official_uninstallers"],
  ];
  const facts = { artifactExistence } as Record<CorrelationFactName, CorrelationFact>;
  const resolutionStates = { artifactExistence: artifactStable ? "resolved" : "mismatch" } as Record<CorrelationFactName, ResolutionState>;
  for (const [factName, scope] of certificateScopes) {
    const result = factResults[factName];
    resolutionStates[factName] = result.resolution;
    if (result.fact.state === "unknown" && result.fact.reasonCode === "missing" &&
      queryGap(queries.get(scope)!) === null && result.resolution === "resolved") {
      const certificate = certificateFor(queries.get(scope)!, provenanceByScope.get(scope)!, candidate.subjectId, input.now);
      certificates.push(certificate);
      facts[factName] = { state: "absent", reasonCode: "complete_empty", certificateId: certificate.certificateId };
    } else {
      facts[factName] = result.fact;
    }
  }
  resolutionStates.dependency = dependency.resolution;
  if (dependency.fact.state === "present") {
    facts.dependency = dependency.fact;
  } else if (applicability.dependency === "not_applicable" && queryGap(queries.get("dependencies")!) === null) {
    facts.dependency = { state: "unknown", reasonCode: "not_applicable" };
  } else if (dependency.fact.state === "unknown" && dependency.fact.reasonCode === "missing" &&
    queryGap(queries.get("dependencies")!) === null) {
    const certificate = certificateFor(queries.get("dependencies")!, provenanceByScope.get("dependencies")!, candidate.subjectId, input.now);
    certificates.push(certificate);
    facts.dependency = { state: "absent", reasonCode: "complete_empty", certificateId: certificate.certificateId };
  } else {
    facts.dependency = dependency.fact;
  }

  const receiptQuery = queries.get("receipts")!;
  let receiptLifecycle: ReceiptLifecycleFact;
  if (receipts.fact.state === "present") {
    const exactBinding = binding.sourceKind === "exact_receipt_payload";
    if (exactBinding && installed.fact.state !== "present" && ownerExecutable.fact.state !== "present" &&
      installed.fact.reasonCode === "missing" && ownerExecutable.fact.reasonCode === "missing" &&
      queryGap(receiptQuery) === null) {
      const certificate = certificateFor(receiptQuery, provenanceByScope.get("receipts")!, candidate.subjectId, input.now);
      certificates.push(certificate);
      receiptLifecycle = { lifecycle: "stale", reasonCode: "exact_payload_owner_absent", certificateId: certificate.certificateId };
    } else {
      receiptLifecycle = { lifecycle: "live", reasonCode: "exact_payload_live" };
    }
  } else if (receipts.fact.state === "unknown" && receipts.fact.reasonCode === "missing" && queryGap(receiptQuery) === null) {
    const certificate = certificateFor(receiptQuery, provenanceByScope.get("receipts")!, candidate.subjectId, input.now);
    certificates.push(certificate);
    receiptLifecycle = { lifecycle: "absent", reasonCode: "complete_empty", certificateId: certificate.certificateId };
  } else {
    const reasonCode = receipts.fact.state === "unknown" ? receipts.fact.reasonCode : "mismatch";
    receiptLifecycle = {
      lifecycle: "unknown",
      reasonCode: reasonCode === "not_applicable" ? "unsupported_profile" : reasonCode,
    };
  }

  if (stale) {
    certificates.splice(0);
    for (const factName of Object.keys(facts) as CorrelationFactName[]) {
      if (facts[factName].state !== "present" || factName === "artifactExistence") {
        facts[factName] = { state: "unknown", reasonCode: "snapshot_stale" };
      }
    }
    receiptLifecycle = { lifecycle: "unknown", reasonCode: "snapshot_stale" };
  }

  const uniqueSubjects = [...new Map(subjects.map((subject) => [subject.subjectId, subject] as const)).values()]
    .sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  const snapshotAFingerprint = sha256(stable(payload.snapshotA));
  const snapshotBFingerprint = sha256(stable(payload.snapshotB));
  const edgeSetDigest = sha256(stable(edges));
  const coverageReportDigest = sha256(stable({ provenance, certificates, applicability }));
  const ownerBindingFingerprint = sha256(stable({
    state: binding.state,
    sourceKind: binding.sourceKind ?? "none",
    bindingFingerprint: binding.bindingFingerprint,
  }));
  const revisionMaterial = stable({
    auditId: input.auditId,
    auditRevision: input.auditRevision,
    snapshotAFingerprint,
    snapshotBFingerprint,
    subjects: uniqueSubjects,
    edges,
    coverageReportDigest,
    ownerBindingFingerprint,
    profile,
    inputVersions: [input.ruleSetVersion, input.policyVersion, input.exclusionStateVersion],
  });
  const revision = deepFreeze(CorrelationRevisionSchema.parse({
    schemaVersion: 2,
    derivationVersion: input.deriver.derivationVersion,
    correlationRevisionId: `correlation-revision-${sha256(revisionMaterial).slice(-24)}`,
    auditId: input.auditId,
    auditRevision: input.auditRevision,
    snapshotId: payload.snapshotId,
    snapshotAFingerprint,
    snapshotBFingerprint,
    subjectSetDigest: sha256(stable(uniqueSubjects)),
    edgeSetDigest,
    coverageReportDigest,
    ownerBindingFingerprint,
    requirementProfileId: profile.profileId,
    requirementProfileVersion: profile.profileVersion,
    requirementProfileFingerprint: profile.profileFingerprint,
    ruleSetVersion: input.ruleSetVersion,
    policyVersion: input.policyVersion,
    exclusionStateVersion: input.exclusionStateVersion,
    staleDuringAudit: stale,
    createdAt: input.now,
  }));

  const gapCodes = new Set<CoverageGapCode>();
  for (const query of payload.queries) {
    const gap = query.snapshotId === payload.snapshotId ? queryGap(query) : "snapshot_stale";
    if (gap !== null) gapCodes.add(gap);
  }
  if (binding.state !== "resolved") gapCodes.add(binding.state);
  for (const fact of Object.values(facts)) {
    if (fact.state === "unknown" && fact.reasonCode !== "not_applicable") gapCodes.add(fact.reasonCode);
  }
  if (receiptLifecycle.lifecycle === "unknown") gapCodes.add(receiptLifecycle.reasonCode);
  if (profile.profileId === "inspection_only_v1") gapCodes.add("unsupported_profile");
  if (stale) gapCodes.add("snapshot_stale");

  const blockingReasonCodes: SafeCorrelationView["blockingReasonCodes"][number][] = [];
  const positive = [
    facts.ownerApplication,
    facts.ownerExecutable,
    facts.activity,
    facts.openFile,
    facts.startupTarget,
    facts.officialUninstaller,
    facts.dependency,
  ].some(({ state }) => state === "present") || receiptLifecycle.lifecycle === "live";
  if (positive) blockingReasonCodes.push("positive_counter_evidence");
  if (binding.state !== "resolved") {
    blockingReasonCodes.push("owner_binding_required");
    if (binding.state === "ambiguous") blockingReasonCodes.push("correlation_ambiguous");
    if (binding.state === "missing") blockingReasonCodes.push("correlation_missing");
    if (binding.state === "mismatch") blockingReasonCodes.push("correlation_mismatch");
  }
  if (profile.profileId === "inspection_only_v1") blockingReasonCodes.push("unsupported_profile");
  if ([...gapCodes].some((gap) => gap !== "unsupported_profile")) blockingReasonCodes.push("coverage_incomplete");
  if (stale) blockingReasonCodes.push("snapshot_stale");
  if (facts.officialUninstaller.state === "present") blockingReasonCodes.push("official_uninstaller_required");

  const canMutate = binding.state === "resolved" && profile.profileId === "private_regenerable_remnant_v1" &&
    artifactExistence.state === "present" &&
    [facts.ownerApplication, facts.ownerExecutable, facts.activity, facts.openFile, facts.startupTarget, facts.officialUninstaller]
      .every(({ state }) => state === "absent") &&
    facts.dependency.state === "unknown" && facts.dependency.reasonCode === "not_applicable" &&
    (receiptLifecycle.lifecycle === "absent" || receiptLifecycle.lifecycle === "stale") &&
    blockingReasonCodes.length === 0 && !stale;
  const canonicalGapCodes = [...gapCodes].sort();
  const safeView = deepFreeze(SafeCorrelationViewSchema.parse({
    schemaVersion: 2,
    findingId: input.findingId,
    auditRevision: input.auditRevision,
    correlationRevisionId: revision.correlationRevisionId,
    ownerBindingState: stale ? "stale" : binding.state,
    ownerBindingSourceClass: sourceClass(binding.sourceKind),
    requirementProfileId: profile.profileId,
    facts,
    receiptLifecycle,
    requirementApplicability: applicability,
    coverageSummary: {
      completeSourceCount: payload.queries.filter((query) => queryGap(query) === null).length,
      gapCount: canonicalGapCodes.length,
      gapCodes: canonicalGapCodes,
    },
    staleDuringAudit: stale,
    blockingReasonCodes: [...new Set(blockingReasonCodes)],
    allowedActions: canMutate
      ? ["inspect", "reveal", "exclude", "prepare_move"]
      : ["inspect"],
  }));

  return deepFreeze({
    candidateSubjectId: candidate.subjectId,
    subjects: uniqueSubjects,
    edges,
    ownerBindings,
    provenance,
    certificates: certificates.sort((left, right) => left.certificateId.localeCompare(right.certificateId)),
    resolutionStates,
    ownerResolutionState: binding.state,
    revision,
    safeView,
  });
}

export interface BuildCorrelationEvidenceOptions {
  readonly supportLevel: "candidate" | "analysis_only" | "unsupported_manual";
  readonly sensitivityFlags: readonly (
    | "credentials"
    | "tokens"
    | "subscription_url"
    | "personal_data"
    | "database"
    | "local_project"
  )[];
  readonly dataKind: "known" | "unsafe" | "unknown";
}

function factOutcome(fact: CorrelationFact): "confirmed" | "contradicted" | "unknown" {
  return fact.state === "present" ? "confirmed" : fact.state === "absent" ? "contradicted" : "unknown";
}

export function buildCorrelationEvidenceSet(
  result: CorrelationResolverResult,
  options: BuildCorrelationEvidenceOptions,
): import("./types.js").EvidenceSet {
  const safe = result.safeView;
  const receiptOutcome = safe.receiptLifecycle.lifecycle === "live"
    ? "confirmed"
    : safe.receiptLifecycle.lifecycle === "absent" || safe.receiptLifecycle.lifecycle === "stale"
      ? "contradicted" : "unknown";
  const entries: readonly [import("./types.js").RuleInputType, "confirmed" | "contradicted" | "unknown"][] = [
    ["owner_binding", safe.ownerBindingState === "resolved" ? "confirmed" : safe.ownerBindingState === "mismatch" ? "contradicted" : "unknown"],
    ["artifact_existence", factOutcome(safe.facts.artifactExistence)],
    ["owner_application", factOutcome(safe.facts.ownerApplication)],
    ["owner_executable", factOutcome(safe.facts.ownerExecutable)],
    ["activity", factOutcome(safe.facts.activity)],
    ["open_file_state", factOutcome(safe.facts.openFile)],
    ["startup_target", factOutcome(safe.facts.startupTarget)],
    ["receipt_lifecycle", receiptOutcome],
    ["official_uninstaller", factOutcome(safe.facts.officialUninstaller)],
    ["dependency", safe.requirementApplicability.dependency === "not_applicable" && safe.facts.dependency.reasonCode === "not_applicable"
      ? "contradicted" : factOutcome(safe.facts.dependency)],
    ["temporal", result.revision.staleDuringAudit ? "contradicted" : "confirmed"],
    ["data_kind", options.dataKind === "known" ? "confirmed" : options.dataKind === "unsafe" ? "contradicted" : "unknown"],
    ["capability", safe.blockingReasonCodes.includes("coverage_incomplete") ? "unknown" : "confirmed"],
    ["requirement_profile", safe.requirementProfileId === "private_regenerable_remnant_v1" ? "confirmed" : "unknown"],
  ];
  const items = entries.map(([ruleInputType, outcome]) => {
    const fingerprint = sha256(stable({ ruleInputType, outcome, revision: result.revision.correlationRevisionId }));
    return {
      evidenceId: `evidence-${fingerprint.slice(-24)}`,
      ruleInputType,
      sourceAdapter: "correlation_revision_v2",
      outcome,
      observedAt: result.revision.createdAt,
      summary: "Server-owned факт корреляции",
      fingerprint: `evidence:v2:${fingerprint.slice("sha256:v1:".length)}`,
    };
  });
  return deepFreeze({
    schemaVersion: 2,
    targetIdentity: result.candidateSubjectId,
    snapshotFingerprint: result.revision.snapshotBFingerprint,
    supportLevel: options.supportLevel,
    sensitivityFlags: [...options.sensitivityFlags].sort(),
    recommendedRemovalMethod: safe.facts.officialUninstaller.state === "present"
      ? "official_uninstaller"
      : safe.requirementProfileId === "private_regenerable_remnant_v1" ? "quarantine" : "inspect_only",
    stale: result.revision.staleDuringAudit,
    authority: {
      mode: "correlation_revision_v2",
      correlationRevisionId: result.revision.correlationRevisionId,
      auditRevision: result.revision.auditRevision,
      snapshotBFingerprint: result.revision.snapshotBFingerprint,
      edgeSetDigest: result.revision.edgeSetDigest,
      coverageReportDigest: result.revision.coverageReportDigest,
      ownerBindingFingerprint: result.revision.ownerBindingFingerprint,
      requirementProfileId: result.revision.requirementProfileId,
      requirementProfileFingerprint: result.revision.requirementProfileFingerprint,
      ruleSetVersion: result.revision.ruleSetVersion,
      policyVersion: result.revision.policyVersion,
      derivationVersion: result.revision.derivationVersion,
      exclusionStateVersion: result.revision.exclusionStateVersion,
    },
    items,
  });
}

export function resolveCorrelation(input: ResolveCorrelationInput): CorrelationResolverResult {
  return consumeEphemeralCorrelationInput(input.rawInput, (payload) => buildResult(input, payload));
}

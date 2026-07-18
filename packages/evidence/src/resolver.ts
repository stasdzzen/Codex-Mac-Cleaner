import { createHash } from "node:crypto";

import {
  consumeEphemeralCorrelationInput,
  type EphemeralCorrelationInput,
  type RawCorrelationPayload,
  type RawIdentityClaim,
  type RawIdentitySubject,
  type RawQueryState,
  type RawSourceQuery,
} from "@codex-mac-cleaner/adapters";
import {
  CorrelationEdgeSchema,
  CorrelationRevisionSchema,
  CorrelationSubjectSchema,
  CoverageCertificateSchema,
  SafeCorrelationViewSchema,
  SourceProvenanceSchema,
  type CorrelationClaimKind,
  type CorrelationEdge,
  type CorrelationFact,
  type CorrelationRevision,
  type CorrelationSubject,
  type CoverageCertificate,
  type CoverageGapCode,
  type QueryScope,
  type SafeCorrelationView,
  type SourceProvenance,
} from "@codex-mac-cleaner/contracts";

export interface KeyedDigestDeriver {
  readonly keyId: string;
  readonly derivationVersion: number;
  derive(domain: string, kind: string, value: string): `hmac-sha256:v1:${string}`;
}

export type CorrelationFactName = keyof SafeCorrelationView["facts"];

export type CorrelationResolutionByFact = Readonly<
  Record<
    CorrelationFactName,
    "resolved" | "ambiguous" | "missing" | "mismatch"
  >
>;

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
  readonly provenance: readonly SourceProvenance[];
  readonly certificates: readonly CoverageCertificate[];
  readonly resolutionStates: CorrelationResolutionByFact;
  readonly ownerResolutionState: "resolved" | "missing" | "mismatch";
  readonly revision: CorrelationRevision;
  readonly safeView: SafeCorrelationView;
}

interface RuleResult {
  readonly state: "resolved" | "ambiguous" | "missing" | "mismatch";
  readonly matches: readonly RawIdentitySubject[];
  readonly claimKinds: readonly CorrelationClaimKind[];
}

const FACT_SCOPE: Readonly<Record<CorrelationFactName, QueryScope>> = {
  installedApp: "installed_apps",
  activity: "processes",
  openFile: "open_files",
  startupTarget: "startup_targets",
  targetExecutable: "target_executables",
  receipt: "receipts",
  officialUninstaller: "official_uninstallers",
  dependency: "dependencies",
};

const RULES: Readonly<
  Record<
    CorrelationFactName,
    Readonly<{
      ruleId: string;
      relation: CorrelationEdge["relation"];
      strength: CorrelationEdge["strength"];
    }>
  >
> = {
  installedApp: {
    ruleId: "CORRELATION_INSTALLED_APP_V1",
    relation: "installed_as",
    strength: "corroborated",
  },
  activity: {
    ruleId: "CORRELATION_PROCESS_EXECUTABLE_V1",
    relation: "executes",
    strength: "authoritative",
  },
  openFile: {
    ruleId: "CORRELATION_OPEN_FILE_TARGET_V1",
    relation: "opens",
    strength: "authoritative",
  },
  startupTarget: {
    ruleId: "CORRELATION_STARTUP_TARGET_V1",
    relation: "launches",
    strength: "authoritative",
  },
  targetExecutable: {
    ruleId: "CORRELATION_TARGET_EXECUTABLE_V1",
    relation: "belongs_to",
    strength: "authoritative",
  },
  receipt: {
    ruleId: "CORRELATION_RECEIPT_PAYLOAD_V1",
    relation: "has_receipt",
    strength: "authoritative",
  },
  officialUninstaller: {
    ruleId: "CORRELATION_OFFICIAL_UNINSTALLER_V1",
    relation: "has_uninstaller",
    strength: "corroborated",
  },
  dependency: {
    ruleId: "CORRELATION_DEPENDENCY_V1",
    relation: "depends_on",
    strength: "authoritative",
  },
};

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
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function claim<TKind extends RawIdentityClaim["kind"]>(
  subject: RawIdentitySubject,
  kind: TKind,
): Extract<RawIdentityClaim, { readonly kind: TKind }> | undefined {
  return subject.claims.find(
    (entry): entry is Extract<RawIdentityClaim, { readonly kind: TKind }> =>
      entry.kind === kind,
  );
}

function canonicalClaim(value: RawIdentityClaim): string | null {
  switch (value.kind) {
    case "hint":
      return null;
    case "filesystem":
      return stable({
        kind: value.kind,
        device: value.device,
        inode: value.inode,
        fileType: value.fileType,
        uid: value.uid,
        gid: value.gid,
        fingerprint: value.fingerprint,
      });
    default:
      return stable(value);
  }
}

function claimKind(value: RawIdentityClaim): CorrelationClaimKind | null {
  return value.kind === "hint" ? null : value.kind;
}

function keyedStrongClaims(
  subject: RawIdentitySubject,
  deriver: KeyedDigestDeriver,
): readonly `hmac-sha256:v1:${string}`[] {
  return subject.claims
    .map((value) => {
      const kind = claimKind(value);
      const canonical = canonicalClaim(value);
      return kind === null || canonical === null
        ? null
        : deriver.derive("cmc:correlation:query-claim:v1", kind, canonical);
    })
    .filter(
      (value): value is `hmac-sha256:v1:${string}` => value !== null,
    )
    .sort();
}

function resolutionFor(
  fact: CorrelationFactName,
  candidate: RawIdentitySubject,
  targets: readonly RawIdentitySubject[],
): RuleResult {
  type Comparison = "match" | "conflict" | "missing" | "unrelated";
  let requiredKinds: readonly CorrelationClaimKind[];
  let candidateMissing = false;
  const compare = (target: RawIdentitySubject): Comparison => {
    switch (fact) {
      case "installedApp": {
        requiredKinds = ["bundle", "signing", "executable"];
        const candidateBundle = claim(candidate, "bundle");
        const candidateSigning = claim(candidate, "signing");
        const candidateExecutable = claim(candidate, "executable");
        const targetBundle = claim(target, "bundle");
        const targetSigning = claim(target, "signing");
        const targetExecutable = claim(target, "executable");
        candidateMissing = !candidateBundle || !candidateSigning || !candidateExecutable;
        if (!targetBundle || !targetSigning || !targetExecutable) return "missing";
        const checks = [
          targetBundle.bundleIdentifier === candidateBundle?.bundleIdentifier,
          targetSigning.designatedRequirement === candidateSigning?.designatedRequirement &&
            targetSigning.teamIdentifier === candidateSigning?.teamIdentifier,
          targetExecutable.executableFingerprint ===
            candidateExecutable?.executableFingerprint,
        ];
        if (checks.every(Boolean)) return "match";
        return checks.some(Boolean) ? "conflict" : "unrelated";
      }
      case "activity": {
        requiredKinds = ["process", "executable"];
        const candidateExecutable = claim(candidate, "executable");
        const process = claim(target, "process");
        candidateMissing = !candidateExecutable;
        if (!process) return "missing";
        return process.executableFingerprint === candidateExecutable?.executableFingerprint
          ? "match"
          : "conflict";
      }
      case "openFile": {
        requiredKinds = ["open_file", "filesystem"];
        const filesystem = claim(candidate, "filesystem");
        const openFile = claim(target, "open_file");
        candidateMissing = !filesystem;
        if (!openFile) return "missing";
        return openFile.targetFilesystemFingerprint === filesystem?.fingerprint
          ? "match"
          : "conflict";
      }
      case "startupTarget": {
        requiredKinds = ["startup_target", "executable"];
        const candidateExecutable = claim(candidate, "executable");
        const startup = claim(target, "startup_target");
        candidateMissing = !candidateExecutable;
        if (!startup) return "missing";
        return startup.executableFingerprint === candidateExecutable?.executableFingerprint
          ? "match"
          : "conflict";
      }
      case "targetExecutable": {
        requiredKinds = ["executable"];
        const candidateExecutable = claim(candidate, "executable");
        const executable = claim(target, "executable");
        candidateMissing = !candidateExecutable;
        if (!executable) return "missing";
        return executable.executableFingerprint ===
          candidateExecutable?.executableFingerprint
          ? "match"
          : "conflict";
      }
      case "receipt": {
        requiredKinds = ["receipt_payload", "package", "filesystem"];
        const candidatePackage = claim(candidate, "package");
        const filesystem = claim(candidate, "filesystem");
        const receipt = claim(target, "receipt_payload");
        candidateMissing = !candidatePackage || !filesystem;
        if (!receipt) return "missing";
        const packageMatches =
          receipt.packageIdentifier === candidatePackage?.packageIdentifier;
        const targetMatches =
          receipt.targetFilesystemFingerprint === filesystem?.fingerprint;
        if (packageMatches && targetMatches) return "match";
        return packageMatches || targetMatches ? "conflict" : "unrelated";
      }
      case "officialUninstaller": {
        requiredKinds = ["official_uninstaller", "bundle", "signing", "executable"];
        const candidateBundle = claim(candidate, "bundle");
        const candidateSigning = claim(candidate, "signing");
        const candidateExecutable = claim(candidate, "executable");
        const uninstaller = claim(target, "official_uninstaller");
        candidateMissing = !candidateBundle || !candidateSigning || !candidateExecutable;
        if (!uninstaller) return "missing";
        const checks = [
          uninstaller.bundleIdentifier === candidateBundle?.bundleIdentifier,
          uninstaller.designatedRequirement === candidateSigning?.designatedRequirement,
          uninstaller.executableFingerprint === candidateExecutable?.executableFingerprint,
        ];
        if (checks.every(Boolean)) return "match";
        return checks.some(Boolean) ? "conflict" : "unrelated";
      }
      case "dependency": {
        requiredKinds = ["dependency", "executable"];
        const candidateExecutable = claim(candidate, "executable");
        const dependency = claim(target, "dependency");
        candidateMissing = !candidateExecutable;
        if (!dependency) return "missing";
        return dependency.dependeeExecutableFingerprint ===
          candidateExecutable?.executableFingerprint
          ? "match"
          : "conflict";
      }
    }
  };

  requiredKinds = [];
  if (targets.length === 0) {
    compare({ localId: "empty", subjectKind: "filesystem_object", claims: [] });
    return {
      state: candidateMissing ? "missing" : "resolved",
      matches: [],
      claimKinds: requiredKinds,
    };
  }
  const comparisons = targets.map((target) => ({ target, outcome: compare(target) }));
  if (candidateMissing) {
    return { state: "missing", matches: [], claimKinds: requiredKinds };
  }
  const matches = comparisons
    .filter(({ outcome }) => outcome === "match")
    .map(({ target }) => target);
  if (matches.length > 1) {
    return { state: "ambiguous", matches, claimKinds: requiredKinds };
  }
  if (matches.length === 1) {
    return { state: "resolved", matches, claimKinds: requiredKinds };
  }
  if (comparisons.some(({ outcome }) => outcome === "missing")) {
    return { state: "missing", matches: [], claimKinds: requiredKinds };
  }
  if (comparisons.some(({ outcome }) => outcome === "conflict")) {
    return { state: "mismatch", matches: [], claimKinds: requiredKinds };
  }
  return { state: "resolved", matches: [], claimKinds: requiredKinds };
}

function queryGap(state: RawQueryState): CoverageGapCode | null {
  return state === "complete" ? null : state;
}

function provenanceFor(
  query: RawSourceQuery,
  expectedSnapshotId: string,
  deriver: KeyedDigestDeriver,
): SourceProvenance {
  const gap = query.snapshotId === expectedSnapshotId
    ? queryGap(query.state)
    : "snapshot_stale";
  const capabilityState = query.state === "capability_missing"
    ? "unavailable"
    : "available";
  const permissionState = query.state === "permission_denied"
    ? "denied"
    : query.state === "capability_missing"
      ? "not_required"
      : "granted";
  const completionState = query.state === "complete"
    ? "complete"
    : query.state === "timeout"
      ? "timed_out"
      : query.state === "cancelled"
        ? "cancelled"
        : query.state === "partial_inventory" || query.state === "truncated"
          ? "partial"
          : "failed";
  const parseState = query.state === "parse_loss" ? "loss" : "complete";
  return SourceProvenanceSchema.parse({
    schemaVersion: 1,
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
      queryScope: query.queryScope,
      state: query.state,
      subjects: query.subjects.map((subject) =>
        keyedStrongClaims(subject, deriver),
      ),
    })),
    capabilityState,
    permissionState,
    completionState,
    parseState,
    truncated: query.state === "truncated",
    warningCodes: gap === null ? [] : [gap],
  });
}

function subjectFor(
  raw: RawIdentitySubject,
  provenanceIds: readonly string[],
  snapshotId: string,
  resolutionState: CorrelationSubject["resolutionState"],
  deriver: KeyedDigestDeriver,
): CorrelationSubject | null {
  const claims = raw.claims
    .map((value) => {
      const kind = claimKind(value);
      const canonical = canonicalClaim(value);
      return kind === null || canonical === null
        ? null
        : {
            kind,
            digest: deriver.derive("cmc:correlation:claim:v1", kind, canonical),
          };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => left.kind.localeCompare(right.kind));
  const uniqueClaims = claims.filter(
    (value, index) => index === 0 || claims[index - 1]?.kind !== value.kind,
  );
  if (uniqueClaims.length === 0) return null;
  const subjectId = deriver.derive(
    "cmc:correlation:subject:v1",
    raw.subjectKind,
    stable(uniqueClaims),
  );
  return CorrelationSubjectSchema.parse({
    schemaVersion: 1,
    subjectId,
    subjectKind: raw.subjectKind,
    claimDigests: uniqueClaims,
    provenanceIds: [...new Set(provenanceIds)].sort(),
    snapshotId,
    identityFingerprint: sha256(stable(uniqueClaims)),
    resolutionState,
  });
}

function buildResult(
  input: ResolveCorrelationInput,
  payload: RawCorrelationPayload,
): CorrelationResolverResult {
  const provenance = payload.queries.map((query) =>
    provenanceFor(query, payload.snapshotId, input.deriver),
  );
  const provenanceByScope = new Map(
    provenance.map((entry) => [entry.queryScope, entry] as const),
  );
  const queryByScope = new Map(
    payload.queries.map((entry) => [entry.queryScope, entry] as const),
  );
  const facts = {} as Record<CorrelationFactName, CorrelationFact>;
  const resolutionStates = {} as Record<
    CorrelationFactName,
    RuleResult["state"]
  >;
  const certificates: CoverageCertificate[] = [];
  const subjects: CorrelationSubject[] = [];
  const edges: CorrelationEdge[] = [];
  const stale =
    stable(payload.snapshotA) !== stable(payload.snapshotB) ||
    payload.queries.some((query) => query.snapshotId !== payload.snapshotId);
  const candidateFilesystem = claim(payload.candidate, "filesystem");
  const candidateOwner = claim(payload.candidate, "owner");
  const ownerResolutionState = !candidateFilesystem || !candidateOwner
    ? "missing"
    : candidateFilesystem.uid === candidateOwner.uid &&
        candidateFilesystem.gid === candidateOwner.gid
      ? "resolved"
      : "mismatch";
  const candidateProvenanceIds = provenance.map(({ provenanceId }) => provenanceId);
  const candidateSubject = subjectFor(
    payload.candidate,
    candidateProvenanceIds,
    payload.snapshotId,
    "resolved",
    input.deriver,
  );
  if (candidateSubject === null) {
    throw new TypeError("Candidate не содержит strong typed claims");
  }
  subjects.push(candidateSubject);

  for (const factName of Object.keys(FACT_SCOPE) as CorrelationFactName[]) {
    const scope = FACT_SCOPE[factName];
    const query = queryByScope.get(scope);
    const sourceProvenance = provenanceByScope.get(scope);
    if (!query || !sourceProvenance) {
      throw new TypeError("Отсутствует обязательный typed source query");
    }
    if (query.snapshotId !== payload.snapshotId) {
      resolutionStates[factName] = "mismatch";
      facts[factName] = { state: "unknown", reasonCode: "snapshot_stale" };
      continue;
    }
    const resolution = resolutionFor(factName, payload.candidate, query.subjects);
    resolutionStates[factName] = resolution.state;
    for (const rawTarget of query.subjects) {
      const target = subjectFor(
        rawTarget,
        [sourceProvenance.provenanceId],
        payload.snapshotId,
        resolution.state,
        input.deriver,
      );
      if (target !== null) subjects.push(target);
    }

    if (resolution.matches.length > 0 && resolution.state === "resolved") {
      const target = subjectFor(
        resolution.matches[0]!,
        [sourceProvenance.provenanceId],
        payload.snapshotId,
        "resolved",
        input.deriver,
      );
      if (target === null) throw new TypeError("Resolved target не содержит claims");
      const rule = RULES[factName];
      edges.push(CorrelationEdgeSchema.parse({
        schemaVersion: 1,
        edgeId: `edge-${sha256(`${factName}:${target.subjectId}`).slice(-24)}`,
        fromSubjectId: candidateSubject.subjectId,
        toSubjectId: target.subjectId,
        relation: rule.relation,
        ruleId: rule.ruleId,
        ruleVersion: 1,
        claimKinds: [...new Set(resolution.claimKinds)],
        strength: rule.strength,
        resolutionState: "resolved",
        provenanceIds: [sourceProvenance.provenanceId],
        snapshotId: payload.snapshotId,
        edgeFingerprint: sha256(stable({
          factName,
          from: candidateSubject.subjectId,
          to: target.subjectId,
          query: sourceProvenance.queryFingerprint,
        })),
      }));
      facts[factName] = { state: "present", reasonCode: "positive_relation" };
      continue;
    }

    if (resolution.state !== "resolved") {
      facts[factName] = { state: "unknown", reasonCode: resolution.state };
      continue;
    }
    const gap = queryGap(query.state);
    if (gap !== null) {
      facts[factName] = { state: "unknown", reasonCode: gap };
      continue;
    }
    const certificate = CoverageCertificateSchema.parse({
      schemaVersion: 1,
      certificateId: `certificate-${scope.replaceAll("_", "-")}`,
      sourceAdapter: query.sourceAdapter,
      queryScope: query.queryScope,
      subjectId: candidateSubject.subjectId,
      snapshotId: payload.snapshotId,
      queryFingerprint: sourceProvenance.queryFingerprint,
      coverageFingerprint: sha256(stable({
        subjectId: candidateSubject.subjectId,
        scope,
        queryFingerprint: sourceProvenance.queryFingerprint,
      })),
      capabilityState: "available",
      permissionState: "granted",
      completionState: "complete",
      parseState: "complete",
      partial: false,
      ambiguous: false,
      issuedAt: input.now,
    });
    certificates.push(certificate);
    facts[factName] = {
      state: "absent",
      reasonCode: "complete_empty",
      certificateId: certificate.certificateId,
    };
  }

  if (stale) {
    for (const factName of Object.keys(facts) as CorrelationFactName[]) {
      if (facts[factName]?.state === "absent") {
        facts[factName] = { state: "unknown", reasonCode: "snapshot_stale" };
      }
    }
    certificates.splice(0, certificates.length);
  }

  const uniqueSubjects = [...new Map(
    subjects.map((subject) => [subject.subjectId, subject] as const),
  ).values()].sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  certificates.sort((left, right) => left.certificateId.localeCompare(right.certificateId));
  const snapshotAFingerprint = sha256(stable(payload.snapshotA));
  const snapshotBFingerprint = sha256(stable(payload.snapshotB));
  const subjectSetDigest = sha256(stable(uniqueSubjects));
  const edgeSetDigest = sha256(stable(edges));
  const coverageReportDigest = sha256(stable({ provenance, certificates }));
  const revisionMaterial = stable({
    auditId: input.auditId,
    auditRevision: input.auditRevision,
    snapshotId: payload.snapshotId,
    snapshotAFingerprint,
    snapshotBFingerprint,
    subjectSetDigest,
    edgeSetDigest,
    coverageReportDigest,
    derivationVersion: input.deriver.derivationVersion,
    ruleSetVersion: input.ruleSetVersion,
    policyVersion: input.policyVersion,
    exclusionStateVersion: input.exclusionStateVersion,
    ownerResolutionState,
    stale,
  });
  const revision = deepFreeze(CorrelationRevisionSchema.parse({
    schemaVersion: 1,
    derivationVersion: input.deriver.derivationVersion,
    correlationRevisionId: `correlation-revision-${sha256(revisionMaterial).slice(-24)}`,
    auditId: input.auditId,
    auditRevision: input.auditRevision,
    snapshotId: payload.snapshotId,
    snapshotAFingerprint,
    snapshotBFingerprint,
    subjectSetDigest,
    edgeSetDigest,
    coverageReportDigest,
    ruleSetVersion: input.ruleSetVersion,
    policyVersion: input.policyVersion,
    exclusionStateVersion: input.exclusionStateVersion,
    staleDuringAudit: stale,
    createdAt: input.now,
  }));

  const gapCodes = new Set<CoverageGapCode>();
  for (const query of payload.queries) {
    const gap = query.snapshotId === payload.snapshotId
      ? queryGap(query.state)
      : "snapshot_stale";
    if (gap !== null) gapCodes.add(gap);
  }
  for (const state of Object.values(resolutionStates)) {
    if (state !== "resolved") gapCodes.add(state);
  }
  if (stale) gapCodes.add("snapshot_stale");
  const blockingReasonCodes: SafeCorrelationView["blockingReasonCodes"][number][] = [];
  const counterFacts: readonly CorrelationFactName[] = [
    "installedApp",
    "activity",
    "openFile",
    "startupTarget",
    "receipt",
    "officialUninstaller",
    "dependency",
  ];
  if (counterFacts.some((factName) => facts[factName]?.state === "present")) {
    blockingReasonCodes.push("positive_counter_evidence");
  }
  if (Object.values(facts).some(({ state }) => state === "unknown")) {
    blockingReasonCodes.push("coverage_incomplete");
  }
  if (Object.values(resolutionStates).includes("ambiguous")) {
    blockingReasonCodes.push("correlation_ambiguous");
  }
  if (Object.values(resolutionStates).includes("missing")) {
    blockingReasonCodes.push("correlation_missing");
  }
  if (Object.values(resolutionStates).includes("mismatch")) {
    blockingReasonCodes.push("correlation_mismatch");
  }
  if (stale) blockingReasonCodes.push("snapshot_stale");
  if (facts.officialUninstaller?.state === "present") {
    blockingReasonCodes.push("official_uninstaller_required");
  }
  const completeSourceCount = payload.queries.filter(
    (query) => query.state === "complete" &&
      resolutionStates[
        (Object.keys(FACT_SCOPE) as CorrelationFactName[]).find(
          (factName) => FACT_SCOPE[factName] === query.queryScope,
        )!
      ] === "resolved",
  ).length;
  const canonicalGapCodes = [...gapCodes].sort();
  const safeView = deepFreeze(SafeCorrelationViewSchema.parse({
    schemaVersion: 1,
    findingId: input.findingId,
    auditRevision: input.auditRevision,
    correlationRevisionId: revision.correlationRevisionId,
    facts,
    coverageSummary: {
      completeSourceCount,
      gapCount: canonicalGapCodes.length,
      gapCodes: canonicalGapCodes,
    },
    staleDuringAudit: stale,
    blockingReasonCodes: [...new Set(blockingReasonCodes)],
    allowedActions: ["inspect"],
  }));

  return deepFreeze({
    candidateSubjectId: candidateSubject.subjectId,
    subjects: uniqueSubjects,
    edges,
    provenance,
    certificates,
    resolutionStates,
    ownerResolutionState,
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
  return fact.state === "present"
    ? "confirmed"
    : fact.state === "absent"
      ? "contradicted"
      : "unknown";
}

export function buildCorrelationEvidenceSet(
  result: CorrelationResolverResult,
  options: BuildCorrelationEvidenceOptions,
): import("./types.js").EvidenceSet {
  const observedAt = result.revision.createdAt;
  const entries: readonly [import("./types.js").RuleInputType, "confirmed" | "contradicted" | "unknown"][] = [
    [
      "owner_identity",
      result.ownerResolutionState === "resolved"
        ? "confirmed"
        : result.ownerResolutionState === "mismatch"
          ? "contradicted"
          : "unknown",
    ],
    ["installed_state", factOutcome(result.safeView.facts.installedApp)],
    ["activity", factOutcome(result.safeView.facts.activity)],
    ["open_file_state", factOutcome(result.safeView.facts.openFile)],
    ["startup_target", factOutcome(result.safeView.facts.startupTarget)],
    ["target_existence", factOutcome(result.safeView.facts.targetExecutable)],
    ["receipt", factOutcome(result.safeView.facts.receipt)],
    ["official_uninstaller", factOutcome(result.safeView.facts.officialUninstaller)],
    ["dependency", factOutcome(result.safeView.facts.dependency)],
    ["temporal", result.revision.staleDuringAudit ? "contradicted" : "confirmed"],
    [
      "data_kind",
      options.dataKind === "known"
        ? "confirmed"
        : options.dataKind === "unsafe"
          ? "contradicted"
          : "unknown",
    ],
    [
      "capability",
      Object.values(result.safeView.facts).some(({ state }) => state === "unknown")
        ? "unknown"
        : "confirmed",
    ],
  ];
  const items = entries.map(([ruleInputType, outcome]) => {
    const fingerprint = sha256(stable({
      ruleInputType,
      outcome,
      revision: result.revision.correlationRevisionId,
    }));
    return {
      evidenceId: `evidence-${fingerprint.slice(-24)}`,
      ruleInputType,
      sourceAdapter: "correlation_revision",
      outcome,
      observedAt,
      summary: "Server-owned факт корреляции",
      fingerprint: `evidence:v2:${fingerprint.slice("sha256:v1:".length)}`,
    };
  });
  return deepFreeze({
    schemaVersion: 1,
    targetIdentity: result.candidateSubjectId,
    snapshotFingerprint: result.revision.snapshotBFingerprint,
    supportLevel: options.supportLevel,
    sensitivityFlags: [...options.sensitivityFlags].sort(),
    recommendedRemovalMethod:
      result.safeView.facts.officialUninstaller.state === "present"
        ? "official_uninstaller"
        : "quarantine",
    stale: result.revision.staleDuringAudit,
    authority: {
      mode: "correlation_revision",
      correlationRevisionId: result.revision.correlationRevisionId,
      auditRevision: result.revision.auditRevision,
      snapshotBFingerprint: result.revision.snapshotBFingerprint,
      edgeSetDigest: result.revision.edgeSetDigest,
      coverageReportDigest: result.revision.coverageReportDigest,
      ruleSetVersion: result.revision.ruleSetVersion,
      policyVersion: result.revision.policyVersion,
      derivationVersion: result.revision.derivationVersion,
      exclusionStateVersion: result.revision.exclusionStateVersion,
    },
    items,
  });
}

export function resolveCorrelation(
  input: ResolveCorrelationInput,
): CorrelationResolverResult {
  return consumeEphemeralCorrelationInput(input.rawInput, (payload) =>
    buildResult(input, payload),
  );
}

import { createHash } from "node:crypto";
import { join } from "node:path";

import type {
  CorrelationSubjectRole,
  OwnerBindingSourceKind,
  QueryScope,
} from "@codex-mac-cleaner/contracts";

export type RawIdentityClaim =
  | Readonly<{
      kind: "filesystem";
      canonicalPath: string;
      device: string;
      inode: string;
      fileType: "file" | "directory" | "bundle";
      uid: number;
      gid: number;
      fingerprint: string;
    }>
  | Readonly<{ kind: "bundle"; bundleIdentifier: string; metadataFingerprint: string }>
  | Readonly<{ kind: "package"; packageIdentifier: string }>
  | Readonly<{
      kind: "signing";
      designatedRequirement: string;
      teamIdentifier: string;
      executableFingerprint: string;
    }>
  | Readonly<{ kind: "owner"; uid: number; gid: number }>
  | Readonly<{ kind: "executable"; executableFingerprint: string }>
  | Readonly<{
      kind: "process";
      executableFingerprint: string;
      pidGeneration: string;
    }>
  | Readonly<{
      kind: "open_file";
      targetFilesystemFingerprint: string;
      processGeneration: string;
    }>
  | Readonly<{ kind: "startup_target"; executableFingerprint: string }>
  | Readonly<{
      kind: "receipt_payload";
      packageIdentifier: string;
      targetFilesystemFingerprint: string;
    }>
  | Readonly<{
      kind: "official_uninstaller";
      bundleIdentifier: string;
      designatedRequirement: string;
      executableFingerprint: string;
    }>
  | Readonly<{
      kind: "dependency";
      dependeeExecutableFingerprint: string;
      relationFingerprint: string;
    }>
  | Readonly<{
      kind: "container_metadata";
      bundleIdentifier: string;
      targetFilesystemFingerprint: string;
      individualContainer: boolean;
    }>
  | Readonly<{
      kind: "historical_binding";
      keyId: string;
      derivationVersion: number;
      artifactDigest: `hmac-sha256:v1:${string}`;
      ownerTypeDigest: `hmac-sha256:v1:${string}`;
      rootDigest: `hmac-sha256:v1:${string}`;
      ownerBundleDigest: `hmac-sha256:v1:${string}`;
      ownerSigningDigest: `hmac-sha256:v1:${string}`;
      ownerExecutableDigest: `hmac-sha256:v1:${string}`;
      bindingFingerprint: string;
    }>
  | Readonly<{
      kind: "hint";
      hintKind: "path" | "basename" | "display_name" | "user_attestation";
      value: string;
    }>;

export interface RawIdentitySubject {
  readonly localId: string;
  readonly subjectRole: CorrelationSubjectRole;
  readonly subjectKind:
    | "filesystem_object"
    | "app_bundle"
    | "executable"
    | "package"
    | "receipt"
    | "process"
    | "open_file"
    | "startup_item"
    | "dependency";
  readonly bindingSourceKind?: OwnerBindingSourceKind;
  readonly claims: readonly RawIdentityClaim[];
}

export type RawQueryState =
  | "complete"
  | "capability_missing"
  | "permission_denied"
  | "partial_inventory"
  | "truncated"
  | "parse_loss"
  | "timeout"
  | "cancelled";

export interface RawSourceQuery {
  readonly queryId: string;
  readonly sourceAdapter: string;
  readonly sourceSchemaVersion: 2;
  readonly queryScope: QueryScope;
  readonly coverageKind: "canonical" | "candidate_specific" | "supplemental";
  readonly snapshotId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly state: RawQueryState;
  readonly subjects: readonly RawIdentitySubject[];
}

export interface RawCorrelationSnapshot {
  readonly candidateFingerprint: string;
  readonly parentFingerprint: string;
  readonly ownerTypeFingerprint: string;
  readonly ownerExecutableFingerprint: string;
  readonly processFingerprint: string;
  readonly openFileFingerprint: string;
  readonly receiptFingerprint: string;
  readonly dependencyFingerprint: string;
  readonly ownerBindingFingerprint: string;
  readonly requirementProfileFingerprint: string;
}

export type CorrelationArtifactCategory =
  | "cache"
  | "log"
  | "application_support"
  | "container"
  | "group_container"
  | "preference"
  | "webkit"
  | "http_storage"
  | "saved_state"
  | "database"
  | "sync_data"
  | "vpn_data"
  | "personal_file"
  | "autostart"
  | "unknown";

export interface RawCorrelationPayload {
  readonly schemaVersion: 2;
  readonly snapshotId: string;
  readonly artifactCategory: CorrelationArtifactCategory;
  readonly artifactPrivateNonExecutable: boolean;
  readonly candidate: RawIdentitySubject;
  readonly queries: readonly RawSourceQuery[];
  readonly snapshotA: RawCorrelationSnapshot;
  readonly snapshotB: RawCorrelationSnapshot;
}

export type SyntheticInstalledVariant =
  | "none"
  | "path_only"
  | "basename_only"
  | "display_name_only"
  | "bundle_only"
  | "package_only"
  | "signer_only"
  | "owner_only"
  | "duplicate"
  | "shared_signer"
  | "mismatch"
  | "resolved";

export type SyntheticPositiveFact =
  | "activity"
  | "openFile"
  | "startupTarget"
  | "receipt"
  | "officialUninstaller"
  | "dependency";

export interface SyntheticKeyedDeriver {
  readonly keyId: string;
  readonly derivationVersion: number;
  derive(domain: string, kind: string, value: string): `hmac-sha256:v1:${string}`;
}

export interface SyntheticCorrelationOptions {
  readonly seed: string;
  readonly tempRoot: string;
  readonly deriver?: SyntheticKeyedDeriver;
  readonly artifactCategory?: CorrelationArtifactCategory;
  readonly artifactPrivateNonExecutable?: boolean;
  readonly bindingSource?: OwnerBindingSourceKind | "missing" | "mismatch";
  readonly installedVariant?: SyntheticInstalledVariant;
  readonly positiveFacts?: readonly SyntheticPositiveFact[];
  readonly queryStates?: Partial<Record<QueryScope, RawQueryState>>;
  readonly mutateSnapshotB?: boolean;
  readonly ownerMissing?: boolean;
  readonly ownerMismatch?: boolean;
  readonly querySnapshotMismatch?: QueryScope;
  readonly ownerExecutablePresent?: boolean;
  /** Legacy test alias; false means owner executable is absent. */
  readonly targetExecutablePresent?: boolean;
  readonly snapshotMutation?:
    | "candidate"
    | "parent"
    | "owner_type"
    | "executable"
    | "process"
    | "open_file"
    | "receipt"
    | "dependency"
    | "owner_binding"
    | "profile";
}

export const MANDATORY_QUERY_SCOPES = [
  "owner_bindings",
  "installed_apps",
  "owner_executables",
  "processes",
  "open_files",
  "startup_targets",
  "receipts",
  "official_uninstallers",
  "dependencies",
] as const satisfies readonly QueryScope[];

export type CorrelationInputErrorCode =
  | "CAPABILITY_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "CORRELATION_AMBIGUOUS"
  | "CORRELATION_COVERAGE_INCOMPLETE"
  | "CORRELATION_MISSING"
  | "CORRELATION_SNAPSHOT_STALE"
  | "CORRELATION_SCHEMA_UNSUPPORTED"
  | "OWNER_BINDING_MISSING"
  | "OWNER_BINDING_STALE"
  | "REQUIREMENT_PROFILE_UNSUPPORTED";

export class CorrelationInputError extends Error {
  readonly severity = "blocking" as const;
  readonly retryable = false;

  constructor(readonly errorCode: CorrelationInputErrorCode) {
    super(errorCode);
    this.name = "CorrelationInputError";
  }
}

const RAW_QUERY_STATES = new Set<string>([
  "complete",
  "capability_missing",
  "permission_denied",
  "partial_inventory",
  "truncated",
  "parse_loss",
  "timeout",
  "cancelled",
]);
const RAW_CLAIM_KINDS = new Set<string>([
  "filesystem",
  "bundle",
  "package",
  "signing",
  "owner",
  "executable",
  "process",
  "open_file",
  "startup_target",
  "receipt_payload",
  "official_uninstaller",
  "dependency",
  "container_metadata",
  "historical_binding",
  "hint",
]);

function failInput(errorCode: CorrelationInputErrorCode): never {
  throw new CorrelationInputError(errorCode);
}

function validateSubject(subject: RawIdentitySubject): void {
  if (
    typeof subject !== "object" ||
    subject === null ||
    !Array.isArray(subject.claims) ||
    !new Set(["library_artifact", "owner_application", "evidence_subject"])
      .has(subject.subjectRole)
  ) {
    failInput("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  if (
    subject.subjectRole === "library_artifact" &&
    subject.subjectKind !== "filesystem_object"
  ) {
    failInput("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  if (
    subject.subjectRole === "owner_application" &&
    !new Set(["app_bundle", "package"]).has(subject.subjectKind)
  ) {
    failInput("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  const strongKinds = new Set<string>();
  for (const rawClaim of subject.claims as readonly unknown[]) {
    if (
      typeof rawClaim !== "object" ||
      rawClaim === null ||
      !("kind" in rawClaim) ||
      typeof rawClaim.kind !== "string" ||
      !RAW_CLAIM_KINDS.has(rawClaim.kind)
    ) {
      failInput("CORRELATION_SCHEMA_UNSUPPORTED");
    }
    if (rawClaim.kind === "hint") continue;
    if (strongKinds.has(rawClaim.kind)) failInput("CORRELATION_AMBIGUOUS");
    strongKinds.add(rawClaim.kind);
  }
}

export function validateRawCorrelationPayload(payload: RawCorrelationPayload): void {
  if (
    payload.schemaVersion !== 2 ||
    !Array.isArray(payload.queries) ||
    typeof payload.snapshotId !== "string" ||
    payload.candidate.subjectRole !== "library_artifact"
  ) {
    failInput("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  const mandatoryScopes = new Set<string>(MANDATORY_QUERY_SCOPES);
  const queryIds = new Set<string>();
  const scopes = new Set<string>();
  const provenanceIds = new Set<string>();

  validateSubject(payload.candidate);
  for (const query of payload.queries as readonly RawSourceQuery[]) {
    if (
      typeof query !== "object" ||
      query === null ||
      query.sourceSchemaVersion !== 2 ||
      typeof query.queryId !== "string" ||
      query.queryId.length === 0 ||
      typeof query.sourceAdapter !== "string" ||
      query.sourceAdapter.length === 0 ||
      !mandatoryScopes.has(query.queryScope) ||
      !new Set(["canonical", "candidate_specific", "supplemental"])
        .has(query.coverageKind) ||
      !RAW_QUERY_STATES.has(query.state) ||
      !Array.isArray(query.subjects)
    ) {
      failInput("CORRELATION_SCHEMA_UNSUPPORTED");
    }
    if (queryIds.has(query.queryId)) failInput("CORRELATION_SCHEMA_UNSUPPORTED");
    queryIds.add(query.queryId);
    const provenanceId = `provenance-${query.queryScope.replaceAll("_", "-")}`;
    if (scopes.has(query.queryScope) || provenanceIds.has(provenanceId)) {
      failInput("CORRELATION_AMBIGUOUS");
    }
    scopes.add(query.queryScope);
    provenanceIds.add(provenanceId);
    for (const subject of query.subjects) validateSubject(subject);
  }

  if (
    scopes.size !== MANDATORY_QUERY_SCOPES.length ||
    MANDATORY_QUERY_SCOPES.some((scope) => !scopes.has(scope))
  ) {
    failInput("CORRELATION_COVERAGE_INCOMPLETE");
  }
}

interface SafeBoundaryDescriptor {
  readonly schemaVersion: 2;
  readonly snapshotId: string;
  readonly queryCount: number;
}

const CONSUME = Symbol("consume-raw-correlation-input");

export class EphemeralCorrelationInput {
  private payload: RawCorrelationPayload | undefined;

  constructor(payload: RawCorrelationPayload) {
    this.payload = payload;
  }

  describe(): SafeBoundaryDescriptor {
    const payload = this.payload;
    if (payload === undefined) throw new TypeError("Raw correlation input уже потреблён");
    return Object.freeze({
      schemaVersion: 2,
      snapshotId: payload.snapshotId,
      queryCount: payload.queries.length,
    });
  }

  toJSON(): never {
    throw new TypeError("Raw correlation input нельзя сериализовать");
  }

  toString(): string {
    return "[EphemeralCorrelationInput redacted]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }

  [CONSUME]<T>(consumer: (payload: RawCorrelationPayload) => T): T {
    const payload = this.payload;
    if (payload === undefined) throw new TypeError("Raw correlation input уже потреблён");
    this.payload = undefined;
    return consumer(payload);
  }
}

export function consumeEphemeralCorrelationInput<T>(
  input: EphemeralCorrelationInput,
  consumer: (payload: RawCorrelationPayload) => T,
): T {
  return input[CONSUME](consumer);
}

function hash(seed: string, domain: string): string {
  return createHash("sha256").update(`${domain}\u0000${seed}`).digest("hex");
}

function rawValue(seed: string, domain: string): string {
  return hash(seed, domain).slice(0, 24);
}

function fallbackDeriver(seed: string): SyntheticKeyedDeriver {
  return {
    keyId: `key-${hash(seed, "key-id").slice(0, 24)}`,
    derivationVersion: 1,
    derive(domain, kind, value) {
      return `hmac-sha256:v1:${createHash("sha256")
        .update([seed, domain, kind, value].join("\u0000"))
        .digest("hex")}`;
    },
  };
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

function makeQuery(
  scope: QueryScope,
  subjects: readonly RawIdentitySubject[],
  state: RawQueryState,
  snapshotId = "snapshot-synthetic",
): RawSourceQuery {
  return {
    queryId: `query-${scope.replaceAll("_", "-")}`,
    sourceAdapter: scope,
    sourceSchemaVersion: 2,
    queryScope: scope,
    coverageKind: scope === "owner_bindings" ? "candidate_specific" : "canonical",
    snapshotId,
    startedAt: "2026-07-18T00:00:00.000Z",
    completedAt: state === "timeout" || state === "cancelled"
      ? null
      : "2026-07-18T00:00:00.000Z",
    state,
    subjects,
  };
}

interface SyntheticOwnerValues {
  readonly rawPath: string;
  readonly basename: string;
  readonly displayName: string;
  readonly bundle: string;
  readonly packageId: string;
  readonly signing: string;
  readonly team: string;
  readonly executable: string;
  readonly filesystem: string;
  readonly ownerType: string;
  readonly root: string;
  readonly uid: number;
  readonly gid: number;
}

function ownerClaims(values: SyntheticOwnerValues, seed: string): readonly RawIdentityClaim[] {
  return [
    { kind: "bundle", bundleIdentifier: values.bundle, metadataFingerprint: rawValue(seed, "bundle-metadata") },
    { kind: "package", packageIdentifier: values.packageId },
    {
      kind: "signing",
      designatedRequirement: values.signing,
      teamIdentifier: values.team,
      executableFingerprint: values.executable,
    },
    { kind: "executable", executableFingerprint: values.executable },
  ];
}

function installedSubjects(
  variant: SyntheticInstalledVariant,
  values: SyntheticOwnerValues,
  seed: string,
): readonly RawIdentitySubject[] {
  const base = (suffix: string, claims: readonly RawIdentityClaim[]): RawIdentitySubject => ({
    localId: `installed-${suffix}`,
    subjectRole: "evidence_subject",
    subjectKind: "app_bundle",
    claims,
  });
  const resolved = ownerClaims(values, seed);
  switch (variant) {
    case "none": return [];
    case "path_only": return [base("path", [{ kind: "hint", hintKind: "path", value: values.rawPath }])];
    case "basename_only": return [base("basename", [{ kind: "hint", hintKind: "basename", value: values.basename }])];
    case "display_name_only": return [base("display", [{ kind: "hint", hintKind: "display_name", value: values.displayName }])];
    case "bundle_only": return [base("bundle", [resolved[0]!])];
    case "package_only": return [base("package", [resolved[1]!])];
    case "signer_only": return [base("signer", [resolved[2]!])];
    case "owner_only": return [base("owner", [{ kind: "owner", uid: values.uid, gid: values.gid }])];
    case "duplicate": return [base("duplicate-a", resolved), base("duplicate-b", resolved)];
    case "shared_signer":
      return ["a", "b"].map((suffix) => {
        const executable = rawValue(seed, `shared-${suffix}`);
        return base(`shared-${suffix}`, [
          { kind: "bundle", bundleIdentifier: `org.synthetic.shared.${suffix}`, metadataFingerprint: rawValue(seed, `bundle-${suffix}`) },
          { kind: "signing", designatedRequirement: values.signing, teamIdentifier: values.team, executableFingerprint: executable },
          { kind: "executable", executableFingerprint: executable },
        ]);
      });
    case "mismatch":
      return [base("mismatch", [
        resolved[0]!,
        { kind: "signing", designatedRequirement: `mismatch-${values.signing}`, teamIdentifier: values.team, executableFingerprint: values.executable },
        resolved[3]!,
      ])];
    case "resolved": return [base("resolved", resolved)];
  }
}

function historicalBindingClaim(
  deriver: SyntheticKeyedDeriver,
  values: SyntheticOwnerValues,
  seed: string,
): Extract<RawIdentityClaim, { kind: "historical_binding" }> {
  const claimDigest = (kind: string, value: unknown) =>
    deriver.derive("cmc:correlation:query-claim:v2", kind, stable(value));
  return {
    kind: "historical_binding",
    keyId: deriver.keyId,
    derivationVersion: deriver.derivationVersion,
    artifactDigest: deriver.derive("cmc:owner-history:v1", "artifact", values.filesystem),
    ownerTypeDigest: deriver.derive("cmc:owner-history:v1", "owner-type", values.ownerType),
    rootDigest: deriver.derive("cmc:owner-history:v1", "root", values.root),
    ownerBundleDigest: claimDigest("bundle", ownerClaims(values, seed)[0]),
    ownerSigningDigest: claimDigest("signing", ownerClaims(values, seed)[2]),
    ownerExecutableDigest: claimDigest("executable", ownerClaims(values, seed)[3]),
    bindingFingerprint: rawValue(seed, "historical-binding"),
  };
}

export function buildSyntheticCorrelationInput(
  options: SyntheticCorrelationOptions,
): EphemeralCorrelationInput {
  if (!options.seed || !options.tempRoot) {
    throw new TypeError("Synthetic correlation builder требует seed и tempRoot");
  }
  const deriver = options.deriver ?? fallbackDeriver(options.seed);
  const positiveFacts = new Set(options.positiveFacts ?? []);
  const values: SyntheticOwnerValues = {
    rawPath: join(options.tempRoot, rawValue(options.seed, "candidate-path")),
    basename: rawValue(options.seed, "basename"),
    displayName: rawValue(options.seed, "display"),
    bundle: `org.synthetic.${rawValue(options.seed, "bundle")}`,
    packageId: `package.synthetic.${rawValue(options.seed, "package")}`,
    signing: `designated-${rawValue(options.seed, "signing")}`,
    team: `team-${rawValue(options.seed, "team")}`,
    executable: rawValue(options.seed, "executable"),
    filesystem: rawValue(options.seed, "filesystem"),
    ownerType: rawValue(options.seed, "owner-type"),
    root: rawValue(options.seed, "parent"),
    uid: 501,
    gid: 20,
  };
  const candidate: RawIdentitySubject = {
    localId: "candidate-synthetic",
    subjectRole: "library_artifact",
    subjectKind: "filesystem_object",
    claims: [
      {
        kind: "filesystem",
        canonicalPath: values.rawPath,
        device: rawValue(options.seed, "device"),
        inode: rawValue(options.seed, "inode"),
        fileType: "directory",
        uid: values.uid,
        gid: values.gid,
        fingerprint: values.filesystem,
      },
      ...(options.ownerMissing
        ? []
        : [{ kind: "owner" as const, uid: options.ownerMismatch ? values.uid + 1 : values.uid, gid: values.gid }]),
      { kind: "hint", hintKind: "basename", value: values.basename },
      { kind: "hint", hintKind: "display_name", value: values.displayName },
    ],
  };
  const subject = (
    localId: string,
    subjectKind: RawIdentitySubject["subjectKind"],
    claims: readonly RawIdentityClaim[],
    subjectRole: CorrelationSubjectRole = "evidence_subject",
  ): RawIdentitySubject => ({ localId, subjectRole, subjectKind, claims });
  const bindingSource = options.bindingSource ?? "signed_process_open_file_history";
  const bindingSubjects: RawIdentitySubject[] = [];
  if (bindingSource === "signed_process_open_file_history") {
    bindingSubjects.push({
      localId: "owner-history-synthetic",
      subjectRole: "owner_application",
      subjectKind: "app_bundle",
      bindingSourceKind: bindingSource,
      claims: [historicalBindingClaim(deriver, values, options.seed)],
    });
  } else if (bindingSource === "exact_receipt_payload") {
    bindingSubjects.push({
      localId: "owner-receipt-synthetic",
      subjectRole: "owner_application",
      subjectKind: "package",
      bindingSourceKind: bindingSource,
      claims: [
        { kind: "package", packageIdentifier: values.packageId },
        { kind: "receipt_payload", packageIdentifier: values.packageId, targetFilesystemFingerprint: values.filesystem },
      ],
    });
  } else if (bindingSource === "os_container_metadata") {
    bindingSubjects.push({
      localId: "owner-container-synthetic",
      subjectRole: "owner_application",
      subjectKind: "app_bundle",
      bindingSourceKind: bindingSource,
      claims: [
        ownerClaims(values, options.seed)[0]!,
        { kind: "container_metadata", bundleIdentifier: values.bundle, targetFilesystemFingerprint: values.filesystem, individualContainer: true },
      ],
    });
  } else if (bindingSource === "mismatch") {
    bindingSubjects.push({
      localId: "owner-mismatch-synthetic",
      subjectRole: "owner_application",
      subjectKind: "package",
      bindingSourceKind: "exact_receipt_payload",
      claims: [
        { kind: "package", packageIdentifier: values.packageId },
        { kind: "receipt_payload", packageIdentifier: values.packageId, targetFilesystemFingerprint: "mismatch" },
      ],
    });
  }
  const maybe = (fact: SyntheticPositiveFact, value: RawIdentitySubject) =>
    positiveFacts.has(fact) ? [value] : [];
  const ownerExecutablePresent = options.ownerExecutablePresent ??
    options.targetExecutablePresent ??
    options.installedVariant === "resolved";
  const receiptRecords = bindingSource === "exact_receipt_payload" || positiveFacts.has("receipt")
    ? [subject("receipt-synthetic", "receipt", [{
        kind: "receipt_payload",
        packageIdentifier: values.packageId,
        targetFilesystemFingerprint: values.filesystem,
      }])]
    : [];
  const queries: readonly RawSourceQuery[] = [
    makeQuery("owner_bindings", bindingSubjects, options.queryStates?.owner_bindings ?? "complete"),
    makeQuery("installed_apps", installedSubjects(options.installedVariant ?? "none", values, options.seed), options.queryStates?.installed_apps ?? "complete"),
    makeQuery(
      "owner_executables",
      ownerExecutablePresent
        ? [subject("owner-executable-synthetic", "executable", [ownerClaims(values, options.seed)[3]!])]
        : [],
      options.queryStates?.owner_executables ?? "complete",
    ),
    makeQuery("processes", maybe("activity", subject("process-synthetic", "process", [{ kind: "process", executableFingerprint: values.executable, pidGeneration: rawValue(options.seed, "pid") }])), options.queryStates?.processes ?? "complete"),
    makeQuery("open_files", maybe("openFile", subject("open-synthetic", "open_file", [{ kind: "open_file", targetFilesystemFingerprint: values.filesystem, processGeneration: rawValue(options.seed, "process") }])), options.queryStates?.open_files ?? "complete"),
    makeQuery("startup_targets", maybe("startupTarget", subject("startup-synthetic", "startup_item", [{ kind: "startup_target", executableFingerprint: values.executable }])), options.queryStates?.startup_targets ?? "complete"),
    makeQuery("receipts", receiptRecords, options.queryStates?.receipts ?? "complete"),
    makeQuery("official_uninstallers", maybe("officialUninstaller", subject("uninstaller-synthetic", "executable", [{ kind: "official_uninstaller", bundleIdentifier: values.bundle, designatedRequirement: values.signing, executableFingerprint: values.executable }])), options.queryStates?.official_uninstallers ?? "complete"),
    makeQuery("dependencies", maybe("dependency", subject("dependency-synthetic", "dependency", [{ kind: "dependency", dependeeExecutableFingerprint: values.executable, relationFingerprint: rawValue(options.seed, "dependency") }])), options.queryStates?.dependencies ?? "complete"),
  ].map((query) => query.queryScope === options.querySnapshotMismatch
    ? { ...query, snapshotId: "snapshot-synthetic-mismatch" }
    : query);

  const snapshotA: RawCorrelationSnapshot = {
    candidateFingerprint: values.filesystem,
    parentFingerprint: rawValue(options.seed, "parent"),
    ownerTypeFingerprint: values.ownerType,
    ownerExecutableFingerprint: values.executable,
    processFingerprint: rawValue(options.seed, "process-snapshot"),
    openFileFingerprint: rawValue(options.seed, "open-snapshot"),
    receiptFingerprint: rawValue(options.seed, "receipt-snapshot"),
    dependencyFingerprint: rawValue(options.seed, "dependency-snapshot"),
    ownerBindingFingerprint: bindingSubjects.length === 1
      ? rawValue(options.seed, "historical-binding")
      : rawValue(options.seed, "binding-missing"),
    requirementProfileFingerprint: rawValue(options.seed, "private-regenerable-profile"),
  };
  const mutation = options.snapshotMutation ?? (options.mutateSnapshotB ? "candidate" : undefined);
  const snapshotField: keyof RawCorrelationSnapshot | undefined = mutation === "candidate"
    ? "candidateFingerprint"
    : mutation === "parent"
      ? "parentFingerprint"
      : mutation === "owner_type"
        ? "ownerTypeFingerprint"
        : mutation === "executable"
          ? "ownerExecutableFingerprint"
          : mutation === "process"
            ? "processFingerprint"
            : mutation === "open_file"
              ? "openFileFingerprint"
              : mutation === "receipt"
                ? "receiptFingerprint"
                : mutation === "dependency"
                  ? "dependencyFingerprint"
                  : mutation === "owner_binding"
                    ? "ownerBindingFingerprint"
                    : mutation === "profile"
                      ? "requirementProfileFingerprint"
                      : undefined;
  const snapshotB = snapshotField === undefined
    ? { ...snapshotA }
    : { ...snapshotA, [snapshotField]: rawValue(options.seed, `${mutation}-replaced`) };

  const payload: RawCorrelationPayload = {
    schemaVersion: 2,
    snapshotId: "snapshot-synthetic",
    artifactCategory: options.artifactCategory ?? "cache",
    artifactPrivateNonExecutable: options.artifactPrivateNonExecutable ?? true,
    candidate,
    queries,
    snapshotA,
    snapshotB,
  };
  validateRawCorrelationPayload(payload);
  return new EphemeralCorrelationInput(payload);
}

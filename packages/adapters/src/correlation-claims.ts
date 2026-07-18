import { createHash } from "node:crypto";
import { join } from "node:path";

import type { QueryScope } from "@codex-mac-cleaner/contracts";

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
  | Readonly<{
      kind: "bundle";
      bundleIdentifier: string;
      metadataFingerprint: string;
    }>
  | Readonly<{
      kind: "package";
      packageIdentifier: string;
    }>
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
  | Readonly<{
      kind: "startup_target";
      executableFingerprint: string;
    }>
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
      kind: "hint";
      hintKind: "path" | "basename" | "display_name";
      value: string;
    }>;

export interface RawIdentitySubject {
  readonly localId: string;
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
  readonly sourceSchemaVersion: 1;
  readonly queryScope: QueryScope;
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
  readonly executableFingerprint: string;
  readonly processFingerprint: string;
  readonly openFileFingerprint: string;
  readonly receiptFingerprint: string;
  readonly dependencyFingerprint: string;
}

export interface RawCorrelationPayload {
  readonly schemaVersion: 1;
  readonly snapshotId: string;
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

export interface SyntheticCorrelationOptions {
  readonly seed: string;
  readonly tempRoot: string;
  readonly installedVariant?: SyntheticInstalledVariant;
  readonly positiveFacts?: readonly SyntheticPositiveFact[];
  readonly queryStates?: Partial<Record<QueryScope, RawQueryState>>;
  readonly mutateSnapshotB?: boolean;
  readonly ownerMismatch?: boolean;
  readonly querySnapshotMismatch?: QueryScope;
  readonly targetExecutablePresent?: boolean;
  readonly snapshotMutation?:
    | "candidate"
    | "parent"
    | "owner_type"
    | "executable"
    | "process"
    | "open_file"
    | "receipt"
    | "dependency";
}

interface SafeBoundaryDescriptor {
  readonly schemaVersion: 1;
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
    if (payload === undefined) {
      throw new TypeError("Raw correlation input уже потреблён");
    }
    return Object.freeze({
      schemaVersion: 1,
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
    if (payload === undefined) {
      throw new TypeError("Raw correlation input уже потреблён");
    }
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

function makeQuery(
  scope: QueryScope,
  subjects: readonly RawIdentitySubject[],
  state: RawQueryState,
  snapshotId = "snapshot-synthetic",
): RawSourceQuery {
  return {
    queryId: `query-${scope.replaceAll("_", "-")}`,
    sourceAdapter: scope,
    sourceSchemaVersion: 1,
    queryScope: scope,
    snapshotId,
    startedAt: "2026-07-18T00:00:00.000Z",
    completedAt: state === "timeout" || state === "cancelled"
      ? null
      : "2026-07-18T00:00:00.000Z",
    state,
    subjects,
  };
}

function installedSubjects(
  variant: SyntheticInstalledVariant,
  values: Readonly<{
    rawPath: string;
    basename: string;
    displayName: string;
    bundle: string;
    packageId: string;
    signing: string;
    team: string;
    executable: string;
    uid: number;
    gid: number;
  }>,
  seed: string,
): readonly RawIdentitySubject[] {
  const base = (suffix: string, claims: readonly RawIdentityClaim[]): RawIdentitySubject => ({
    localId: `installed-${suffix}`,
    subjectKind: "app_bundle",
    claims,
  });
  const resolvedClaims: readonly RawIdentityClaim[] = [
    {
      kind: "bundle",
      bundleIdentifier: values.bundle,
      metadataFingerprint: rawValue(seed, "bundle-metadata"),
    },
    {
      kind: "signing",
      designatedRequirement: values.signing,
      teamIdentifier: values.team,
      executableFingerprint: values.executable,
    },
    { kind: "executable", executableFingerprint: values.executable },
  ];

  switch (variant) {
    case "none":
      return [];
    case "path_only":
      return [base("path", [{ kind: "hint", hintKind: "path", value: values.rawPath }])];
    case "basename_only":
      return [base("basename", [{
        kind: "hint",
        hintKind: "basename",
        value: values.basename,
      }])];
    case "display_name_only":
      return [base("display", [{
        kind: "hint",
        hintKind: "display_name",
        value: values.displayName,
      }])];
    case "bundle_only":
      return [base("bundle", [resolvedClaims[0]!])];
    case "package_only":
      return [base("package", [{ kind: "package", packageIdentifier: values.packageId }])];
    case "signer_only":
      return [base("signer", [resolvedClaims[1] as RawIdentityClaim])];
    case "owner_only":
      return [base("owner", [{ kind: "owner", uid: values.uid, gid: values.gid }])];
    case "duplicate":
      return [base("duplicate-a", resolvedClaims), base("duplicate-b", resolvedClaims)];
    case "shared_signer":
      return ["a", "b"].map((suffix) => {
        const otherExecutable = rawValue(seed, `shared-executable-${suffix}`);
        return base(`shared-signer-${suffix}`, [
          {
            kind: "bundle",
            bundleIdentifier: `org.synthetic.shared.${suffix}`,
            metadataFingerprint: rawValue(seed, `shared-bundle-${suffix}`),
          },
          {
            kind: "signing",
            designatedRequirement: values.signing,
            teamIdentifier: values.team,
            executableFingerprint: otherExecutable,
          },
          { kind: "executable", executableFingerprint: otherExecutable },
        ]);
      });
    case "mismatch":
      return [
        base("mismatch", [
          resolvedClaims[0]!,
          {
            kind: "signing",
            designatedRequirement: `requirement-${rawValue(seed, "mismatch-signing")}`,
            teamIdentifier: values.team,
            executableFingerprint: values.executable,
          },
          resolvedClaims[2]!,
        ]),
      ];
    case "resolved":
      return [base("resolved", resolvedClaims)];
  }
}

export function buildSyntheticCorrelationInput(
  options: SyntheticCorrelationOptions,
): EphemeralCorrelationInput {
  if (!options.seed || !options.tempRoot) {
    throw new TypeError("Synthetic correlation builder требует seed и tempRoot");
  }
  const positiveFacts = new Set(options.positiveFacts ?? []);
  const values = {
    rawPath: join(options.tempRoot, rawValue(options.seed, "candidate-path")),
    basename: rawValue(options.seed, "basename"),
    displayName: rawValue(options.seed, "display"),
    bundle: `org.synthetic.${rawValue(options.seed, "bundle")}`,
    packageId: `package.synthetic.${rawValue(options.seed, "package")}`,
    signing: `designated-${rawValue(options.seed, "signing")}`,
    team: `team-${rawValue(options.seed, "team")}`,
    executable: rawValue(options.seed, "executable"),
    filesystem: rawValue(options.seed, "filesystem"),
    uid: 501,
    gid: 20,
  } as const;

  const candidate: RawIdentitySubject = {
    localId: "candidate-synthetic",
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
      {
        kind: "bundle",
        bundleIdentifier: values.bundle,
        metadataFingerprint: rawValue(options.seed, "bundle-metadata"),
      },
      { kind: "package", packageIdentifier: values.packageId },
      {
        kind: "signing",
        designatedRequirement: values.signing,
        teamIdentifier: values.team,
        executableFingerprint: values.executable,
      },
      {
        kind: "owner",
        uid: options.ownerMismatch ? values.uid + 1 : values.uid,
        gid: values.gid,
      },
      { kind: "executable", executableFingerprint: values.executable },
      { kind: "hint", hintKind: "basename", value: values.basename },
      { kind: "hint", hintKind: "display_name", value: values.displayName },
    ],
  };

  const subject = (
    localId: string,
    subjectKind: RawIdentitySubject["subjectKind"],
    claims: readonly RawIdentityClaim[],
  ): RawIdentitySubject => ({ localId, subjectKind, claims });
  const maybe = (
    fact: SyntheticPositiveFact,
    value: RawIdentitySubject,
  ): readonly RawIdentitySubject[] => positiveFacts.has(fact) ? [value] : [];

  const queries: readonly RawSourceQuery[] = [
    makeQuery(
      "installed_apps",
      installedSubjects(options.installedVariant ?? "none", values, options.seed),
      options.queryStates?.installed_apps ?? "complete",
    ),
    makeQuery(
      "processes",
      maybe("activity", subject("process-synthetic", "process", [{
        kind: "process",
        executableFingerprint: values.executable,
        pidGeneration: rawValue(options.seed, "pid-generation"),
      }])),
      options.queryStates?.processes ?? "complete",
    ),
    makeQuery(
      "open_files",
      maybe("openFile", subject("open-file-synthetic", "open_file", [{
        kind: "open_file",
        targetFilesystemFingerprint: values.filesystem,
        processGeneration: rawValue(options.seed, "process-generation"),
      }])),
      options.queryStates?.open_files ?? "complete",
    ),
    makeQuery(
      "startup_targets",
      maybe("startupTarget", subject("startup-synthetic", "startup_item", [{
        kind: "startup_target",
        executableFingerprint: values.executable,
      }])),
      options.queryStates?.startup_targets ?? "complete",
    ),
    makeQuery(
      "target_executables",
      options.targetExecutablePresent === false
        ? []
        : [subject("executable-synthetic", "executable", [{
            kind: "executable",
            executableFingerprint: values.executable,
          }])],
      options.queryStates?.target_executables ?? "complete",
    ),
    makeQuery(
      "receipts",
      maybe("receipt", subject("receipt-synthetic", "receipt", [{
        kind: "receipt_payload",
        packageIdentifier: values.packageId,
        targetFilesystemFingerprint: values.filesystem,
      }])),
      options.queryStates?.receipts ?? "complete",
    ),
    makeQuery(
      "official_uninstallers",
      maybe("officialUninstaller", subject("uninstaller-synthetic", "executable", [{
        kind: "official_uninstaller",
        bundleIdentifier: values.bundle,
        designatedRequirement: values.signing,
        executableFingerprint: values.executable,
      }])),
      options.queryStates?.official_uninstallers ?? "complete",
    ),
    makeQuery(
      "dependencies",
      maybe("dependency", subject("dependency-synthetic", "dependency", [{
        kind: "dependency",
        dependeeExecutableFingerprint: values.executable,
        relationFingerprint: rawValue(options.seed, "dependency-relation"),
      }])),
      options.queryStates?.dependencies ?? "complete",
    ),
  ].map((query) =>
    query.queryScope === options.querySnapshotMismatch
      ? { ...query, snapshotId: "snapshot-synthetic-mismatch" }
      : query,
  );

  const snapshotA: RawCorrelationSnapshot = {
    candidateFingerprint: values.filesystem,
    parentFingerprint: rawValue(options.seed, "parent"),
    ownerTypeFingerprint: rawValue(options.seed, "owner-type"),
    executableFingerprint: values.executable,
    processFingerprint: rawValue(options.seed, "process-snapshot"),
    openFileFingerprint: rawValue(options.seed, "open-snapshot"),
    receiptFingerprint: rawValue(options.seed, "receipt-snapshot"),
    dependencyFingerprint: rawValue(options.seed, "dependency-snapshot"),
  };
  const snapshotMutation = options.snapshotMutation ??
    (options.mutateSnapshotB ? "candidate" : undefined);
  const snapshotField = snapshotMutation === "candidate"
    ? "candidateFingerprint"
    : snapshotMutation === "parent"
      ? "parentFingerprint"
      : snapshotMutation === "owner_type"
        ? "ownerTypeFingerprint"
        : snapshotMutation === "executable"
          ? "executableFingerprint"
          : snapshotMutation === "process"
            ? "processFingerprint"
            : snapshotMutation === "open_file"
              ? "openFileFingerprint"
              : snapshotMutation === "receipt"
                ? "receiptFingerprint"
                : snapshotMutation === "dependency"
                  ? "dependencyFingerprint"
                  : undefined;
  const snapshotB: RawCorrelationSnapshot = snapshotField === undefined
    ? { ...snapshotA }
    : {
        ...snapshotA,
        [snapshotField]: rawValue(options.seed, `${snapshotMutation}-replaced`),
      };

  return new EphemeralCorrelationInput({
    schemaVersion: 1,
    snapshotId: "snapshot-synthetic",
    candidate,
    queries,
    snapshotA,
    snapshotB,
  });
}

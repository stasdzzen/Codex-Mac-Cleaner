import type { QueryScope } from "@codex-mac-cleaner/contracts";

import {
  CorrelationInputError,
  EphemeralCorrelationInput,
  MANDATORY_QUERY_SCOPES,
  validateRawCorrelationPayload,
  type RawCorrelationPayload,
  type RawCorrelationSnapshot,
  type RawIdentityClaim,
  type RawIdentitySubject,
  type RawQueryState,
  type RawSourceQuery,
} from "./correlation-claims.js";

export interface ProductionSourceCapture<TRecord> {
  readonly state: RawQueryState;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly records: readonly TRecord[];
}

export interface ProductionFilesystemIdentityRecord {
  readonly canonicalPath: string;
  readonly device: string;
  readonly inode: string;
  readonly fileType: "file" | "directory" | "bundle";
  readonly uid: number;
  readonly gid: number;
  readonly fingerprint: string;
}

export interface ProductionBundleIdentityRecord {
  readonly bundleIdentifier: string;
  readonly metadataFingerprint: string;
}

export interface ProductionSigningIdentityRecord {
  readonly designatedRequirement: string;
  readonly teamIdentifier: string;
  readonly executableFingerprint: string;
}

export interface ProductionIdentityHints {
  readonly path?: string;
  readonly basename?: string;
  readonly displayName?: string;
}

interface ProductionCommonIdentityRecord {
  readonly localId: string;
  readonly filesystem?: ProductionFilesystemIdentityRecord;
  readonly bundle?: ProductionBundleIdentityRecord;
  readonly packageIdentifier?: string;
  readonly signing?: ProductionSigningIdentityRecord;
  readonly owner?: Readonly<{ uid: number; gid: number }>;
  readonly executableFingerprint?: string;
  readonly hints?: ProductionIdentityHints;
}

export interface ProductionCandidateIdentityRecord
  extends ProductionCommonIdentityRecord {
  readonly filesystem: ProductionFilesystemIdentityRecord;
}

export type ProductionInstalledAppRecord = ProductionCommonIdentityRecord;

export interface ProductionProcessRecord {
  readonly localId: string;
  readonly executableFingerprint: string;
  readonly pidGeneration: string;
}

export interface ProductionOpenFileRecord {
  readonly localId: string;
  readonly targetFilesystemFingerprint: string;
  readonly processGeneration: string;
}

export interface ProductionStartupTargetRecord {
  readonly localId: string;
  readonly executableFingerprint: string;
}

export interface ProductionTargetExecutableRecord {
  readonly localId: string;
  readonly executableFingerprint: string;
}

export interface ProductionReceiptRecord {
  readonly localId: string;
  readonly packageIdentifier: string;
  readonly targetFilesystemFingerprint: string;
}

export interface ProductionOfficialUninstallerRecord {
  readonly localId: string;
  readonly bundleIdentifier: string;
  readonly designatedRequirement: string;
  readonly executableFingerprint: string;
}

export interface ProductionDependencyRecord {
  readonly localId: string;
  readonly dependeeExecutableFingerprint: string;
  readonly relationFingerprint: string;
}

export interface ProductionCorrelationSnapshotRecord {
  readonly candidateFingerprint: string;
  readonly parentFingerprint: string;
  readonly ownerTypeFingerprint: string;
  readonly executableFingerprint: string;
  readonly processFingerprint: string;
  readonly openFileFingerprint: string;
  readonly receiptFingerprint: string;
  readonly dependencyFingerprint: string;
}

export interface ProductionCandidateCapture {
  readonly candidate: ProductionCandidateIdentityRecord;
  readonly snapshot: ProductionCorrelationSnapshotRecord;
}

/** Command-only read boundary. Реализация не получает shell или mutation API. */
export interface ProductionCorrelationCommandBoundary {
  installedApps(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionInstalledAppRecord>>;
  processes(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionProcessRecord>>;
  openFiles(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionOpenFileRecord>>;
}

/** Read-only filesystem boundary: произвольные write/delete операции отсутствуют. */
export interface ProductionCorrelationFilesystemBoundary {
  captureCandidate(
    candidateRef: string,
    phase: "A" | "B",
    signal: AbortSignal,
  ): Promise<ProductionCandidateCapture>;
  startupTargets(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionStartupTargetRecord>>;
  targetExecutables(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionTargetExecutableRecord>>;
  receipts(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionReceiptRecord>>;
  officialUninstallers(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionOfficialUninstallerRecord>>;
  dependencies(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<ProductionSourceCapture<ProductionDependencyRecord>>;
}

export interface BuildProductionCorrelationInput {
  readonly candidateRef: string;
  readonly snapshotId: string;
  readonly signal: AbortSignal;
  readonly commandBoundary: ProductionCorrelationCommandBoundary;
  readonly filesystemBoundary: ProductionCorrelationFilesystemBoundary;
}

export interface ProductionCorrelationAdapter {
  buildInput(input: Readonly<{
    candidateRef: string;
    snapshotId: string;
    signal: AbortSignal;
  }>): Promise<EphemeralCorrelationInput>;
}

const OPAQUE_INPUT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

function assertOpaque(value: string): void {
  if (!OPAQUE_INPUT.test(value)) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }
}

function commonClaims(record: ProductionCommonIdentityRecord): RawIdentityClaim[] {
  const claims: RawIdentityClaim[] = [];
  if (record.filesystem !== undefined) {
    claims.push({ kind: "filesystem", ...record.filesystem });
  }
  if (record.bundle !== undefined) claims.push({ kind: "bundle", ...record.bundle });
  if (record.packageIdentifier !== undefined) {
    claims.push({ kind: "package", packageIdentifier: record.packageIdentifier });
  }
  if (record.signing !== undefined) claims.push({ kind: "signing", ...record.signing });
  if (record.owner !== undefined) claims.push({ kind: "owner", ...record.owner });
  if (record.executableFingerprint !== undefined) {
    claims.push({
      kind: "executable",
      executableFingerprint: record.executableFingerprint,
    });
  }
  if (record.hints?.path !== undefined) {
    claims.push({ kind: "hint", hintKind: "path", value: record.hints.path });
  }
  if (record.hints?.basename !== undefined) {
    claims.push({ kind: "hint", hintKind: "basename", value: record.hints.basename });
  }
  if (record.hints?.displayName !== undefined) {
    claims.push({
      kind: "hint",
      hintKind: "display_name",
      value: record.hints.displayName,
    });
  }
  return claims;
}

function subject(
  localId: string,
  subjectKind: RawIdentitySubject["subjectKind"],
  claims: readonly RawIdentityClaim[],
): RawIdentitySubject {
  return { localId, subjectKind, claims };
}

function snapshot(record: ProductionCorrelationSnapshotRecord): RawCorrelationSnapshot {
  return { ...record };
}

function query<TRecord>(
  scope: QueryScope,
  sourceAdapter: string,
  snapshotId: string,
  capture: ProductionSourceCapture<TRecord>,
  mapRecord: (record: TRecord) => RawIdentitySubject,
): RawSourceQuery {
  return {
    queryId: `production-query-${scope.replaceAll("_", "-")}`,
    sourceAdapter,
    sourceSchemaVersion: 1,
    queryScope: scope,
    snapshotId,
    startedAt: capture.startedAt,
    completedAt: capture.completedAt,
    state: capture.state,
    subjects: capture.records.map(mapRecord),
  };
}

/**
 * Server-only bridge для production probes. Apps/MCP передают только opaque ref,
 * snapshot ID и read-only boundaries; raw identity остаётся внутри ephemeral input.
 */
export async function buildProductionCorrelationInput(
  input: BuildProductionCorrelationInput,
): Promise<EphemeralCorrelationInput> {
  assertOpaque(input.candidateRef);
  assertOpaque(input.snapshotId);
  input.signal.throwIfAborted();

  const phaseA = await input.filesystemBoundary.captureCandidate(
    input.candidateRef,
    "A",
    input.signal,
  );
  input.signal.throwIfAborted();
  const captures = await Promise.all([
    input.commandBoundary.installedApps(input.candidateRef, input.signal),
    input.commandBoundary.processes(input.candidateRef, input.signal),
    input.commandBoundary.openFiles(input.candidateRef, input.signal),
    input.filesystemBoundary.startupTargets(input.candidateRef, input.signal),
    input.filesystemBoundary.targetExecutables(input.candidateRef, input.signal),
    input.filesystemBoundary.receipts(input.candidateRef, input.signal),
    input.filesystemBoundary.officialUninstallers(input.candidateRef, input.signal),
    input.filesystemBoundary.dependencies(input.candidateRef, input.signal),
  ] as const);
  input.signal.throwIfAborted();
  const phaseB = await input.filesystemBoundary.captureCandidate(
    input.candidateRef,
    "B",
    input.signal,
  );
  input.signal.throwIfAborted();

  const queries: readonly RawSourceQuery[] = [
    query(
      "installed_apps",
      "production-installed-apps",
      input.snapshotId,
      captures[0],
      (record) => subject(record.localId, "app_bundle", commonClaims(record)),
    ),
    query(
      "processes",
      "production-processes",
      input.snapshotId,
      captures[1],
      (record) => subject(record.localId, "process", [{
        kind: "process",
        executableFingerprint: record.executableFingerprint,
        pidGeneration: record.pidGeneration,
      }]),
    ),
    query(
      "open_files",
      "production-open-files",
      input.snapshotId,
      captures[2],
      (record) => subject(record.localId, "open_file", [{
        kind: "open_file",
        targetFilesystemFingerprint: record.targetFilesystemFingerprint,
        processGeneration: record.processGeneration,
      }]),
    ),
    query(
      "startup_targets",
      "production-startup-targets",
      input.snapshotId,
      captures[3],
      (record) => subject(record.localId, "startup_item", [{
        kind: "startup_target",
        executableFingerprint: record.executableFingerprint,
      }]),
    ),
    query(
      "target_executables",
      "production-target-executables",
      input.snapshotId,
      captures[4],
      (record) => subject(record.localId, "executable", [{
        kind: "executable",
        executableFingerprint: record.executableFingerprint,
      }]),
    ),
    query(
      "receipts",
      "production-receipts",
      input.snapshotId,
      captures[5],
      (record) => subject(record.localId, "receipt", [{
        kind: "receipt_payload",
        packageIdentifier: record.packageIdentifier,
        targetFilesystemFingerprint: record.targetFilesystemFingerprint,
      }]),
    ),
    query(
      "official_uninstallers",
      "production-official-uninstallers",
      input.snapshotId,
      captures[6],
      (record) => subject(record.localId, "executable", [{
        kind: "official_uninstaller",
        bundleIdentifier: record.bundleIdentifier,
        designatedRequirement: record.designatedRequirement,
        executableFingerprint: record.executableFingerprint,
      }]),
    ),
    query(
      "dependencies",
      "production-dependencies",
      input.snapshotId,
      captures[7],
      (record) => subject(record.localId, "dependency", [{
        kind: "dependency",
        dependeeExecutableFingerprint: record.dependeeExecutableFingerprint,
        relationFingerprint: record.relationFingerprint,
      }]),
    ),
  ];
  if (
    queries.length !== MANDATORY_QUERY_SCOPES.length ||
    queries.some((entry, index) => entry.queryScope !== MANDATORY_QUERY_SCOPES[index])
  ) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }

  const payload: RawCorrelationPayload = {
    schemaVersion: 1,
    snapshotId: input.snapshotId,
    candidate: subject(
      phaseA.candidate.localId,
      "filesystem_object",
      commonClaims(phaseA.candidate),
    ),
    queries,
    snapshotA: snapshot(phaseA.snapshot),
    snapshotB: snapshot(phaseB.snapshot),
  };
  validateRawCorrelationPayload(payload);
  return new EphemeralCorrelationInput(payload);
}

/**
 * Composition seam для будущего CMC-09: app вызывает только buildInput и не
 * реализует raw identity mapping или resolver rules.
 */
export function createProductionCorrelationAdapter(
  boundaries: Readonly<{
    commandBoundary: ProductionCorrelationCommandBoundary;
    filesystemBoundary: ProductionCorrelationFilesystemBoundary;
  }>,
): ProductionCorrelationAdapter {
  return Object.freeze({
    buildInput: (
      input: Parameters<ProductionCorrelationAdapter["buildInput"]>[0],
    ) => buildProductionCorrelationInput({
      ...input,
      commandBoundary: boundaries.commandBoundary,
      filesystemBoundary: boundaries.filesystemBoundary,
    }),
  });
}

import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type { SnapshotFingerprint } from "@codex-mac-cleaner/policy";
import { JsonStore } from "@codex-mac-cleaner/storage";

import { QuarantineError, type QuarantineErrorCode } from "./errors.js";
import { syncDirectory } from "./filesystem.js";

export type QuarantineState =
  | "previewed"
  | "prepared"
  | "moved"
  | "restored"
  | "purged"
  | "aborted"
  | "conflicted"
  | "inconsistent";

export interface QuarantineManifest {
  readonly schemaVersion: 1;
  readonly operationId: string;
  readonly action: "move";
  readonly state: QuarantineState;
  readonly auditId: string;
  readonly auditRevision: number;
  readonly findingId: string;
  readonly sourcePath: string;
  readonly payloadPath: string;
  readonly sourceFingerprint: SnapshotFingerprint;
  readonly sourceParentFingerprint: SnapshotFingerprint;
  readonly artifactKind: string;
  readonly category: string;
  readonly physicalSize: number;
  readonly classificationRuleIds: readonly string[];
  readonly policyRuleIds: readonly string[];
  readonly previewTokenId: string;
  readonly confirmedAt: string;
  readonly preparedAt: string | null;
  readonly movedAt: string | null;
  readonly restoredAt: null;
  readonly purgedAt: null;
  readonly lastErrorCode: QuarantineErrorCode | null;
  readonly eventSequence: number;
}

const STATES = new Set<QuarantineState>([
  "previewed",
  "prepared",
  "moved",
  "restored",
  "purged",
  "aborted",
  "conflicted",
  "inconsistent",
]);

const OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MANIFEST_FIELDS = new Set([
  "schemaVersion",
  "operationId",
  "action",
  "state",
  "auditId",
  "auditRevision",
  "findingId",
  "sourcePath",
  "payloadPath",
  "sourceFingerprint",
  "sourceParentFingerprint",
  "artifactKind",
  "category",
  "physicalSize",
  "classificationRuleIds",
  "policyRuleIds",
  "previewTokenId",
  "confirmedAt",
  "preparedAt",
  "movedAt",
  "restoredAt",
  "purgedAt",
  "lastErrorCode",
  "eventSequence",
]);
const FILE_TYPES = new Set(["file", "directory", "bundle", "plist", "unknown"]);

export function assertOperationId(operationId: string): void {
  if (!OPERATION_ID.test(operationId)) {
    throw new QuarantineError("OPERATION_CONFLICT");
  }
}

function isFingerprint(value: unknown): value is SnapshotFingerprint {
  if (typeof value !== "object" || value === null) return false;
  const fingerprint = value as Record<string, unknown>;
  return (
    typeof fingerprint.device === "string" &&
    typeof fingerprint.inode === "string" &&
    typeof fingerprint.mode === "number" &&
    typeof fingerprint.uid === "number" &&
    typeof fingerprint.gid === "number" &&
    typeof fingerprint.size === "number" &&
    typeof fingerprint.mtimeNs === "string" &&
    typeof fingerprint.ctimeNs === "string" &&
    typeof fingerprint.fileType === "string" &&
    FILE_TYPES.has(fingerprint.fileType) &&
    typeof fingerprint.mountId === "string" &&
    typeof fingerprint.symbolicLink === "boolean" &&
    typeof fingerprint.linkCount === "number"
  );
}

export function parseManifest(value: unknown): QuarantineManifest {
  if (typeof value !== "object" || value === null) {
    throw new QuarantineError("MANIFEST_INCONSISTENT");
  }
  const manifest = value as Record<string, unknown>;
  const keys = Object.keys(manifest);
  const strings = [
    "operationId",
    "auditId",
    "findingId",
    "sourcePath",
    "payloadPath",
    "artifactKind",
    "category",
    "previewTokenId",
    "confirmedAt",
  ];
  if (
    manifest.schemaVersion !== 1 ||
    keys.length !== MANIFEST_FIELDS.size ||
    keys.some((key) => !MANIFEST_FIELDS.has(key)) ||
    manifest.action !== "move" ||
    typeof manifest.state !== "string" ||
    !STATES.has(manifest.state as QuarantineState) ||
    strings.some((field) => typeof manifest[field] !== "string") ||
    !Number.isSafeInteger(manifest.auditRevision) ||
    (manifest.auditRevision as number) < 0 ||
    !Number.isSafeInteger(manifest.physicalSize) ||
    (manifest.physicalSize as number) < 0 ||
    !Array.isArray(manifest.classificationRuleIds) ||
    !manifest.classificationRuleIds.every((item) => typeof item === "string") ||
    !Array.isArray(manifest.policyRuleIds) ||
    !manifest.policyRuleIds.every((item) => typeof item === "string") ||
    !isFingerprint(manifest.sourceFingerprint) ||
    !isFingerprint(manifest.sourceParentFingerprint) ||
    typeof manifest.eventSequence !== "number" ||
    !Number.isSafeInteger(manifest.eventSequence) ||
    manifest.eventSequence < 1 ||
    !isAbsolute(manifest.sourcePath as string) ||
    !isAbsolute(manifest.payloadPath as string) ||
    (manifest.sourcePath as string).includes("\u0000") ||
    (manifest.payloadPath as string).includes("\u0000") ||
    !Number.isFinite(Date.parse(manifest.confirmedAt as string)) ||
    ![manifest.preparedAt, manifest.movedAt].every(
      (timestamp) =>
        timestamp === null ||
        (typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp))),
    ) ||
    manifest.restoredAt !== null ||
    manifest.purgedAt !== null ||
    !(
      manifest.lastErrorCode === null ||
      typeof manifest.lastErrorCode === "string"
    )
  ) {
    throw new QuarantineError("MANIFEST_INCONSISTENT");
  }
  assertOperationId(manifest.operationId as string);
  return manifest as unknown as QuarantineManifest;
}

export interface OperationPaths {
  readonly operationDirectory: string;
  readonly payloadDirectory: string;
  readonly payloadPath: string;
  readonly manifestPath: string;
}

export class ManifestRepository {
  readonly jsonStore: JsonStore;

  constructor(readonly storeRoot: string) {
    this.jsonStore = new JsonStore(storeRoot);
  }

  paths(operationId: string): OperationPaths {
    assertOperationId(operationId);
    const operationDirectory = join(this.storeRoot, "quarantine", operationId);
    const payloadDirectory = join(operationDirectory, "payload");
    return {
      operationDirectory,
      payloadDirectory,
      payloadPath: join(payloadDirectory, "object"),
      manifestPath: join(operationDirectory, "manifest.json"),
    };
  }

  async ensureOperationDirectories(operationId: string): Promise<OperationPaths> {
    const paths = this.paths(operationId);
    await this.jsonStore.ensureDirectory(
      join("quarantine", operationId, "payload"),
    );
    for (const directory of [
      this.storeRoot,
      join(this.storeRoot, "quarantine"),
      paths.operationDirectory,
      paths.payloadDirectory,
    ]) {
      await syncDirectory(directory);
    }
    return paths;
  }

  async write(manifest: QuarantineManifest): Promise<void> {
    const expected = this.paths(manifest.operationId);
    if (manifest.payloadPath !== expected.payloadPath) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    await this.jsonStore.writeJsonAtomic(
      join("quarantine", manifest.operationId, "manifest.json"),
      manifest,
    );
    await syncDirectory(expected.operationDirectory);
  }

  async read(operationId: string): Promise<QuarantineManifest> {
    const expected = this.paths(operationId);
    const payload = await readFile(expected.manifestPath, "utf8").catch(
      (error) => {
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      },
    );
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch (error) {
      throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
    }
    const manifest = parseManifest(value);
    if (
      manifest.operationId !== operationId ||
      manifest.payloadPath !== expected.payloadPath
    ) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    return manifest;
  }

  async readIfPresent(operationId: string): Promise<QuarantineManifest | undefined> {
    try {
      return await this.read(operationId);
    } catch (error) {
      if (
        error instanceof QuarantineError &&
        error.code === "MANIFEST_INCONSISTENT"
      ) {
        const present = await readFile(this.paths(operationId).manifestPath).then(
          () => true,
          (readError: NodeJS.ErrnoException) => {
            if (readError.code === "ENOENT") return false;
            throw readError;
          },
        );
        if (!present) return undefined;
      }
      throw error;
    }
  }

  async list(): Promise<QuarantineManifest[]> {
    const quarantineRoot = join(this.storeRoot, "quarantine");
    const entries = await readdir(quarantineRoot, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      },
    );
    const manifests: QuarantineManifest[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      const manifest = await this.readIfPresent(entry.name);
      if (manifest !== undefined) manifests.push(manifest);
    }
    return manifests.sort((left, right) =>
      left.operationId.localeCompare(right.operationId),
    );
  }
}

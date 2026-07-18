import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PolicyDecision, SnapshotFingerprint } from "@codex-mac-cleaner/policy";

import {
  QuarantineController,
  inspectMoveSource,
  type FaultInjector,
  type FileSystemOperations,
  type MoveSubject,
  type ObservedMoveState,
  type RevalidationResult,
} from "../src/index.js";

export interface MutableSafetyState {
  ownerIdentity: RevalidationResult["ownerIdentity"];
  activityState: RevalidationResult["activityState"];
  openFileState: RevalidationResult["openFileState"];
  protectedScope: boolean;
  sensitivityFlags: string[];
  evaluatedFingerprintOverride?: SnapshotFingerprint;
}

export interface SyntheticHarness {
  readonly temporaryRoot: string;
  readonly allowedRoot: string;
  readonly sourcePath: string;
  readonly otherPath: string;
  readonly storeRoot: string;
  readonly subject: MoveSubject;
  readonly safety: MutableSafetyState;
  createController(options?: {
    faultInjector?: FaultInjector;
    fileSystem?: Partial<FileSystemOperations>;
  }): QuarantineController;
  readManifest(operationId: string): Promise<Record<string, unknown>>;
  readJournal(): Promise<Array<Record<string, unknown>>>;
  cleanup(): Promise<void>;
}

function policyDecision(fingerprint: SnapshotFingerprint): PolicyDecision {
  return {
    allowedActions: ["inspect", "reveal", "exclude", "prepare_move"],
    blockingRuleIds: [],
    warnings: [],
    evaluatedFingerprint: fingerprint,
  };
}

export async function createSyntheticHarness(): Promise<SyntheticHarness> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "cmc-quarantine-synthetic-"));
  const allowedRoot = join(temporaryRoot, "Library", "Caches");
  const sourcePath = join(allowedRoot, "artifact-a");
  const otherPath = join(allowedRoot, "artifact-b");
  const storeRoot = join(temporaryRoot, "state");
  await mkdir(allowedRoot, { recursive: true });
  await writeFile(sourcePath, "synthetic-object-a", { mode: 0o600 });
  await writeFile(otherPath, "synthetic-object-b", { mode: 0o600 });

  const observed = await inspectMoveSource({ allowedRoot, sourcePath });
  const subject: MoveSubject = {
    auditId: "audit-synthetic",
    auditRevision: 1,
    findingId: "finding-synthetic-a",
    sourcePath,
    allowedRoot,
    sourceFingerprint: observed.sourceFingerprint,
    sourceParentFingerprint: observed.sourceParentFingerprint,
    artifactKind: "file",
    category: "cache",
    physicalSize: observed.sourceFingerprint.size,
    classificationRuleIds: ["CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE"],
    policyRuleIds: ["POLICY_V1_SAFE_QUARANTINE"],
  };
  const safety: MutableSafetyState = {
    ownerIdentity: "matched",
    activityState: "inactive",
    openFileState: "closed",
    protectedScope: false,
    sensitivityFlags: [],
  };

  const revalidate = async (
    _subject: MoveSubject,
    current: ObservedMoveState,
  ): Promise<RevalidationResult> => ({
    policyDecision: policyDecision(
      safety.evaluatedFingerprintOverride ?? current.sourceFingerprint,
    ),
    ownerIdentity: safety.ownerIdentity,
    activityState: safety.activityState,
    openFileState: safety.openFileState,
    protectedScope: safety.protectedScope,
    sensitivityFlags: [...safety.sensitivityFlags],
  });

  return {
    temporaryRoot,
    allowedRoot,
    sourcePath,
    otherPath,
    storeRoot,
    subject,
    safety,
    createController: (options = {}) =>
      new QuarantineController({
        storeRoot,
        resolveSubject: async ({ findingId, auditRevision }) => {
          if (
            findingId !== subject.findingId ||
            auditRevision !== subject.auditRevision
          ) {
            throw new Error("Неизвестная синтетическая находка");
          }
          return subject;
        },
        revalidate,
        ...(options.faultInjector === undefined
          ? {}
          : { faultInjector: options.faultInjector }),
        ...(options.fileSystem === undefined
          ? {}
          : { fileSystem: options.fileSystem }),
      }),
    readManifest: async (operationId) =>
      JSON.parse(
        await readFile(
          join(storeRoot, "quarantine", operationId, "manifest.json"),
          "utf8",
        ),
      ) as Record<string, unknown>,
    readJournal: async () => {
      const payload = await readFile(
        join(storeRoot, "journal", "operations.ndjson"),
        "utf8",
      ).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "";
        throw error;
      });
      return payload
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
    cleanup: async () => rm(temporaryRoot, { recursive: true, force: true }),
  };
}

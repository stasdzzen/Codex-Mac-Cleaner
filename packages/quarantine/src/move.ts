import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import type { PolicyDecision, SnapshotFingerprint } from "@codex-mac-cleaner/policy";

import {
  QuarantineError,
  type FaultInjector,
  type QuarantineErrorCode,
} from "./errors.js";
import {
  captureFingerprint,
  fingerprintsEqual,
  inspectAllowedDirectory,
  inspectMoveSource,
  nodeFileSystem,
  parentIdentityMatches,
  pathExistsNoFollow,
  payloadIdentityMatches,
  syncDirectory,
  type FileSystemOperations,
  type ObservedMoveState,
} from "./filesystem.js";
import { observeDisk } from "./disk-observation.js";
import { OperationJournal } from "./journal.js";
import { KeyedMutex } from "./lock.js";
import {
  assertOperationId,
  ManifestRepository,
  type QuarantineManifest,
  type QuarantineState,
} from "./manifest.js";
import {
  PreviewTokenVault,
  type PreviewToken,
  type StoredPreviewToken,
} from "./preview-token.js";
import type {
  PreparePurgeInput,
  PurgeQuarantineEntryInput,
} from "./purge.js";
import type {
  PrepareRestoreInput,
  RestoreFromQuarantineInput,
} from "./restore.js";
import {
  readStorageSummary as readStorageSummarySnapshot,
  type CandidateStorage,
  type QuarantineActionResult,
  type StorageSummary,
} from "./summary.js";

export interface MoveSubject {
  readonly auditId: string;
  readonly auditRevision: number;
  readonly findingId: string;
  readonly sourcePath: string;
  readonly allowedRoot: string;
  readonly sourceFingerprint: SnapshotFingerprint;
  readonly sourceParentFingerprint: SnapshotFingerprint;
  readonly artifactKind: string;
  readonly category: string;
  readonly physicalSize: number;
  readonly classificationRuleIds: readonly string[];
  readonly policyRuleIds: readonly string[];
}

export interface RevalidationResult {
  readonly policyDecision: PolicyDecision;
  readonly ownerIdentity: "matched" | "mismatched" | "unknown";
  readonly activityState: "inactive" | "active" | "unknown";
  readonly openFileState: "closed" | "open" | "unknown";
  readonly protectedScope: boolean;
  readonly sensitivityFlags: readonly string[];
}

export interface ResolveSubjectInput {
  readonly findingId: string;
  readonly auditRevision: number;
}

export interface QuarantineControllerOptions {
  readonly storeRoot: string;
  readonly candidateStorage?: (
    binding?: Readonly<{
      auditId: string;
      auditRevision: number;
    }>,
  ) => Promise<CandidateStorage>;
  readonly resolveSubject: (input: ResolveSubjectInput) => Promise<MoveSubject>;
  readonly revalidate: (
    subject: MoveSubject,
    observed: ObservedMoveState,
  ) => Promise<RevalidationResult>;
  readonly now?: () => number;
  readonly faultInjector?: FaultInjector;
  readonly fileSystem?: Partial<FileSystemOperations>;
}

export interface PrepareMoveInput {
  readonly findingId: string;
  readonly auditRevision: number;
  readonly uiSessionId: string;
}

export interface MoveToQuarantineInput {
  readonly token: string;
  readonly operationId: string;
  readonly uiSessionId: string;
}

function mapFileSystemError(error: unknown): QuarantineError {
  if (error instanceof QuarantineError) return error;
  if ((error as NodeJS.ErrnoException | undefined)?.code === "EXDEV") {
    return new QuarantineError("CROSS_VOLUME", { cause: error });
  }
  if (
    ["EEXIST", "ENOTEMPTY"].includes(
      (error as NodeJS.ErrnoException | undefined)?.code ?? "",
    )
  ) {
    return new QuarantineError("OPERATION_CONFLICT", { cause: error });
  }
  return new QuarantineError("SOURCE_CHANGED", { cause: error });
}

function mapRestoreFileSystemError(error: unknown): QuarantineError {
  if (error instanceof QuarantineError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";
  if (code === "EXDEV") {
    return new QuarantineError("CROSS_VOLUME", { cause: error });
  }
  if (["EEXIST", "ENOTEMPTY"].includes(code)) {
    return new QuarantineError("RESTORE_PATH_OCCUPIED", { cause: error });
  }
  return new QuarantineError("SOURCE_CHANGED", { cause: error });
}

function mapPurgeFileSystemError(error: unknown): QuarantineError {
  if (error instanceof QuarantineError) return error;
  return new QuarantineError("PURGE_FAILED", { cause: error });
}

function assertSafeRevalidation(
  expectedSource: SnapshotFingerprint,
  expectedParent: SnapshotFingerprint,
  observed: ObservedMoveState,
  result: RevalidationResult,
): void {
  if (result.protectedScope) throw new QuarantineError("PROTECTED_SCOPE");
  if (result.sensitivityFlags.length > 0) {
    throw new QuarantineError("SENSITIVE_DATA");
  }
  if (result.ownerIdentity !== "matched") {
    throw new QuarantineError("SOURCE_CHANGED");
  }
  if (result.activityState !== "inactive") {
    throw new QuarantineError("ACTIVE_PROCESS");
  }
  if (result.openFileState !== "closed") {
    throw new QuarantineError("OPEN_FILE");
  }
  if (
    result.policyDecision.blockingRuleIds.length > 0 ||
    !result.policyDecision.allowedActions.includes("prepare_move")
  ) {
    throw new QuarantineError("OPERATION_CONFLICT");
  }
  if (
    !fingerprintsEqual(
      result.policyDecision.evaluatedFingerprint,
      observed.sourceFingerprint,
    ) ||
    !fingerprintsEqual(expectedSource, observed.sourceFingerprint) ||
    !fingerprintsEqual(expectedParent, observed.sourceParentFingerprint)
  ) {
    throw new QuarantineError("SOURCE_CHANGED");
  }
}

function transitionAllowed(
  from: QuarantineState,
  to: QuarantineState,
): boolean {
  if (from === to && to === "moved") return true;
  const transitions: Readonly<Record<QuarantineState, readonly QuarantineState[]>> = {
    previewed: ["prepared", "aborted"],
    prepared: ["moved", "aborted", "conflicted", "inconsistent"],
    moved: ["restored", "purged", "conflicted", "inconsistent"],
    restored: [],
    purged: [],
    aborted: [],
    conflicted: [],
    inconsistent: [],
  };
  return transitions[from].includes(to);
}

function objectLockKey(subject: MoveSubject): string {
  const fingerprint = subject.sourceFingerprint;
  return `${fingerprint.device}:${fingerprint.inode}`;
}

export class QuarantineController {
  private readonly manifests: ManifestRepository;
  private readonly journal: OperationJournal;
  private readonly tokens: PreviewTokenVault;
  private readonly objectLocks = new KeyedMutex();
  private readonly operationLocks = new KeyedMutex();
  private readonly subjectsByTokenId = new Map<string, MoveSubject>();
  private readonly restoreParentByTokenId = new Map<
    string,
    SnapshotFingerprint
  >();
  private readonly actionResults = new Map<string, QuarantineActionResult>();
  private readonly fileSystem: FileSystemOperations;
  private readonly now: () => number;
  private mutationBlocked = false;

  constructor(private readonly options: QuarantineControllerOptions) {
    this.manifests = new ManifestRepository(options.storeRoot);
    this.journal = new OperationJournal(options.storeRoot);
    this.tokens = new PreviewTokenVault(
      options.now === undefined ? {} : { now: options.now },
    );
    this.now = options.now ?? Date.now;
    this.fileSystem = { ...nodeFileSystem, ...options.fileSystem };
  }

  isMutationBlocked(): boolean {
    return this.mutationBlocked;
  }

  private async refreshMutationBlock(): Promise<void> {
    if (this.mutationBlocked) throw new QuarantineError("MANIFEST_INCONSISTENT");
    let manifests: QuarantineManifest[];
    try {
      manifests = await this.manifests.list();
    } catch (error) {
      this.mutationBlocked = true;
      throw error;
    }
    if (manifests.some((manifest) => manifest.state === "inconsistent")) {
      this.mutationBlocked = true;
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
  }

  private async observeAndRevalidate(
    subject: MoveSubject,
  ): Promise<ObservedMoveState> {
    const observed = await inspectMoveSource({
      allowedRoot: subject.allowedRoot,
      sourcePath: subject.sourcePath,
    });
    const result = await this.options.revalidate(subject, observed);
    assertSafeRevalidation(
      subject.sourceFingerprint,
      subject.sourceParentFingerprint,
      observed,
      result,
    );
    return observed;
  }

  private actionKey(action: "move" | "restore" | "purge", operationId: string) {
    return `${action}:${operationId}`;
  }

  private async buildActionResult(
    manifest: QuarantineManifest,
  ): Promise<QuarantineActionResult> {
    const summary = await this.readStorageSummary({
      auditId: manifest.auditId,
      auditRevision: manifest.auditRevision,
    });
    const diskObservation = await observeDisk(this.options.storeRoot, {
      now: this.now,
    });
    return {
      ...manifest,
      summary,
      stateVersion: summary.stateVersion,
      diskObservation,
    };
  }

  async readStorageSummary(
    binding?: Readonly<{
      auditId: string;
      auditRevision: number;
    }>,
  ): Promise<StorageSummary> {
    return readStorageSummarySnapshot({
      storeRoot: this.options.storeRoot,
      ...(this.options.candidateStorage === undefined
        ? {}
        : {
            candidateStorage: () =>
              this.options.candidateStorage!(binding),
          }),
    });
  }

  private async assertManifestJournalCurrent(
    manifest: QuarantineManifest,
  ): Promise<void> {
    if (!(await this.journal.hasEvent(manifest))) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
  }

  private async inspectPayload(
    manifest: QuarantineManifest,
  ): Promise<SnapshotFingerprint> {
    const paths = this.manifests.paths(manifest.operationId);
    if (manifest.payloadPath !== paths.payloadPath) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    let payload: ObservedMoveState;
    try {
      payload = await inspectMoveSource({
        allowedRoot: paths.operationDirectory,
        sourcePath: paths.payloadPath,
      });
    } catch (error) {
      if (
        error instanceof QuarantineError &&
        ["SYMLINK_BOUNDARY", "CROSS_VOLUME", "PATH_OUTSIDE_ALLOWLIST"].includes(
          error.code,
        )
      ) {
        throw error;
      }
      throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
    }
    if (!payloadIdentityMatches(manifest.sourceFingerprint, payload.sourceFingerprint)) {
      throw new QuarantineError("SOURCE_CHANGED");
    }
    return payload.sourceFingerprint;
  }

  private async resolveRestoreAllowedRoot(
    manifest: QuarantineManifest,
  ): Promise<string> {
    let subject: MoveSubject;
    try {
      subject = await this.options.resolveSubject({
        findingId: manifest.findingId,
        auditRevision: manifest.auditRevision,
      });
    } catch (error) {
      throw new QuarantineError("RESTORE_PARENT_CHANGED", { cause: error });
    }
    if (
      subject.auditId !== manifest.auditId ||
      subject.findingId !== manifest.findingId ||
      subject.auditRevision !== manifest.auditRevision ||
      subject.sourcePath !== manifest.sourcePath ||
      !fingerprintsEqual(subject.sourceFingerprint, manifest.sourceFingerprint)
    ) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    return subject.allowedRoot;
  }

  private async inspectRestoreEntry(manifest: QuarantineManifest): Promise<{
    readonly parentFingerprint: SnapshotFingerprint;
    readonly payloadFingerprint: SnapshotFingerprint;
  }> {
    if (manifest.state !== "moved") {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    await this.assertManifestJournalCurrent(manifest);
    if (await pathExistsNoFollow(manifest.sourcePath)) {
      throw new QuarantineError("RESTORE_PATH_OCCUPIED");
    }
    const allowedRoot = await this.resolveRestoreAllowedRoot(manifest);
    let parentFingerprint: SnapshotFingerprint;
    try {
      parentFingerprint = await inspectAllowedDirectory({
        allowedRoot,
        directoryPath: dirname(manifest.sourcePath),
      });
    } catch (error) {
      if (
        error instanceof QuarantineError &&
        ["SYMLINK_BOUNDARY", "CROSS_VOLUME", "PATH_OUTSIDE_ALLOWLIST"].includes(
          error.code,
        )
      ) {
        throw error;
      }
      throw new QuarantineError("RESTORE_PARENT_CHANGED", { cause: error });
    }
    if (
      !parentIdentityMatches(
        manifest.sourceParentFingerprint,
        parentFingerprint,
      )
    ) {
      throw new QuarantineError("RESTORE_PARENT_CHANGED");
    }
    const payloadFingerprint = await this.inspectPayload(manifest);
    if (
      parentFingerprint.device !== payloadFingerprint.device ||
      parentFingerprint.mountId !== payloadFingerprint.mountId
    ) {
      throw new QuarantineError("CROSS_VOLUME");
    }
    return {
      parentFingerprint,
      payloadFingerprint,
    };
  }

  private assertActionReplayBinding(
    manifest: QuarantineManifest,
    action: "restore" | "purge",
    tokenSecret: string,
    uiSessionId: string,
  ): StoredPreviewToken {
    const token = this.tokens.resolve(tokenSecret);
    if (
      token.action !== action ||
      token.subjectId !== manifest.operationId ||
      token.uiSessionId !== uiSessionId ||
      !payloadIdentityMatches(manifest.sourceFingerprint, token.fingerprint)
    ) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    return token;
  }

  async prepareMove(input: PrepareMoveInput): Promise<PreviewToken> {
    await this.refreshMutationBlock();
    const subject = await this.options.resolveSubject({
      findingId: input.findingId,
      auditRevision: input.auditRevision,
    });
    if (
      subject.findingId !== input.findingId ||
      subject.auditRevision !== input.auditRevision
    ) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    const observed = await this.observeAndRevalidate(subject);
    const token = this.tokens.issue({
      action: "move",
      subjectId: subject.findingId,
      uiSessionId: input.uiSessionId,
      fingerprint: observed.sourceFingerprint,
    });
    this.subjectsByTokenId.set(token.tokenId, subject);
    return token;
  }

  private async persistState(
    manifest: QuarantineManifest,
    state: QuarantineState,
    changes: Partial<QuarantineManifest>,
    options: { readonly injectBeforeAppend?: boolean } = {},
  ): Promise<QuarantineManifest> {
    if (!transitionAllowed(manifest.state, state)) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    return this.journal.withNextSequence(
      manifest.eventSequence,
      async (eventSequence) => {
        const next = {
          ...manifest,
          ...changes,
          state,
          eventSequence,
        } as QuarantineManifest;
        await this.manifests.write(next);
        if (options.injectBeforeAppend) {
          await this.options.faultInjector?.(
            "beforeJournalAppend",
            manifest.operationId,
          );
        }
        await this.journal.append(next, new Date(this.now()).toISOString());
        return next;
      },
    );
  }

  private async createPreviewedManifest(
    operationId: string,
    token: StoredPreviewToken,
    subject: MoveSubject,
  ): Promise<QuarantineManifest> {
    const paths = await this.manifests.ensureOperationDirectories(operationId);
    if (await pathExistsNoFollow(paths.payloadPath)) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    const payloadParent = await inspectMoveSource({
      allowedRoot: paths.operationDirectory,
      sourcePath: paths.payloadDirectory,
    });
    if (payloadParent.sourceFingerprint.device !== subject.sourceFingerprint.device) {
      throw new QuarantineError("CROSS_VOLUME");
    }
    const confirmedAt = new Date(this.now()).toISOString();
    const initial: QuarantineManifest = {
      schemaVersion: 1,
      operationId,
      action: "move",
      state: "previewed",
      auditId: subject.auditId,
      auditRevision: subject.auditRevision,
      findingId: subject.findingId,
      sourcePath: subject.sourcePath,
      payloadPath: paths.payloadPath,
      sourceFingerprint: Object.freeze({ ...subject.sourceFingerprint }),
      sourceParentFingerprint: Object.freeze({
        ...subject.sourceParentFingerprint,
      }),
      artifactKind: subject.artifactKind,
      category: subject.category,
      physicalSize: subject.physicalSize,
      classificationRuleIds: [...subject.classificationRuleIds],
      policyRuleIds: [...subject.policyRuleIds],
      previewTokenId: token.tokenId,
      confirmedAt,
      preparedAt: null,
      movedAt: null,
      restoredAt: null,
      purgedAt: null,
      lastErrorCode: null,
      eventSequence: 0,
    };
    return this.journal.withNextSequence(0, async (eventSequence) => {
      const previewed = { ...initial, eventSequence };
      await this.manifests.write(previewed);
      await this.journal.append(previewed, confirmedAt);
      return previewed;
    });
  }

  private assertReplayBinding(
    manifest: QuarantineManifest,
    input: MoveToQuarantineInput,
  ): void {
    const token = this.tokens.resolve(input.token);
    if (
      token.tokenId !== manifest.previewTokenId ||
      token.action !== "move" ||
      token.subjectId !== manifest.findingId ||
      token.uiSessionId !== input.uiSessionId ||
      !fingerprintsEqual(token.fingerprint, manifest.sourceFingerprint)
    ) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
  }

  async moveToQuarantine(
    input: MoveToQuarantineInput,
  ): Promise<QuarantineActionResult> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    return this.operationLocks.run(input.operationId, async () => {
      const existing = await this.manifests.readIfPresent(input.operationId);
      if (existing !== undefined) {
        this.assertReplayBinding(existing, input);
        const cached = this.actionResults.get(
          this.actionKey("move", input.operationId),
        );
        if (cached !== undefined) return cached;
        return this.buildActionResult(existing);
      }

      const resolved = this.tokens.resolve(input.token);
      const subject = this.subjectsByTokenId.get(resolved.tokenId);
      if (subject === undefined) throw new QuarantineError("OPERATION_CONFLICT");

      return this.objectLocks.run(objectLockKey(subject), async () => {
        const replay = await this.manifests.readIfPresent(input.operationId);
        if (replay !== undefined) {
          this.assertReplayBinding(replay, input);
          const cached = this.actionResults.get(
            this.actionKey("move", input.operationId),
          );
          if (cached !== undefined) return cached;
          return this.buildActionResult(replay);
        }
        const consumed = this.tokens.consume(input.token, {
          action: "move",
          subjectId: subject.findingId,
          uiSessionId: input.uiSessionId,
          fingerprint: subject.sourceFingerprint,
        });

        await this.observeAndRevalidate(subject);
        await this.options.faultInjector?.("beforeManifest", input.operationId);
        let manifest = await this.createPreviewedManifest(
          input.operationId,
          consumed,
          subject,
        );
        manifest = await this.persistState(manifest, "prepared", {
          preparedAt: new Date(this.now()).toISOString(),
        });
        await this.options.faultInjector?.("afterPrepared", input.operationId);

        await this.observeAndRevalidate(subject);
        const paths = this.manifests.paths(input.operationId);
        if (await pathExistsNoFollow(paths.payloadPath)) {
          throw new QuarantineError("OPERATION_CONFLICT");
        }
        try {
          await this.fileSystem.rename(subject.sourcePath, paths.payloadPath);
          await syncDirectory(dirname(subject.sourcePath));
          await syncDirectory(paths.payloadDirectory);
        } catch (error) {
          throw mapFileSystemError(error);
        }
        await this.options.faultInjector?.("afterRename", input.operationId);

        const restoreParentFingerprint = await captureFingerprint(
          dirname(subject.sourcePath),
        );
        manifest = await this.persistState(
          manifest,
          "moved",
          {
            movedAt: new Date(this.now()).toISOString(),
            sourceParentFingerprint: restoreParentFingerprint,
          },
          { injectBeforeAppend: true },
        );
        const result = await this.buildActionResult(manifest);
        this.actionResults.set(this.actionKey("move", input.operationId), result);
        return result;
      });
    });
  }

  async prepareRestore(input: PrepareRestoreInput): Promise<PreviewToken> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    const manifest = await this.manifests.read(input.operationId);
    const observed = await this.inspectRestoreEntry(manifest);
    const token = this.tokens.issue({
      action: "restore",
      subjectId: manifest.operationId,
      uiSessionId: input.uiSessionId,
      fingerprint: observed.payloadFingerprint,
    });
    this.restoreParentByTokenId.set(
      token.tokenId,
      Object.freeze({ ...observed.parentFingerprint }),
    );
    return token;
  }

  async restoreFromQuarantine(
    input: RestoreFromQuarantineInput,
  ): Promise<QuarantineActionResult> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    return this.operationLocks.run(input.operationId, async () => {
      let manifest = await this.manifests.read(input.operationId);
      if (manifest.state === "restored") {
        this.assertActionReplayBinding(
          manifest,
          "restore",
          input.token,
          input.uiSessionId,
        );
        const cached = this.actionResults.get(
          this.actionKey("restore", input.operationId),
        );
        if (cached !== undefined) return cached;
        return this.buildActionResult(manifest);
      }
      const resolved = this.assertActionReplayBinding(
        manifest,
        "restore",
        input.token,
        input.uiSessionId,
      );
      const expectedParent = this.restoreParentByTokenId.get(resolved.tokenId);
      if (expectedParent === undefined) {
        throw new QuarantineError("OPERATION_CONFLICT");
      }
      let observed = await this.inspectRestoreEntry(manifest);
      if (!fingerprintsEqual(expectedParent, observed.parentFingerprint)) {
        throw new QuarantineError("RESTORE_PARENT_CHANGED");
      }
      this.tokens.consume(input.token, {
        action: "restore",
        subjectId: manifest.operationId,
        uiSessionId: input.uiSessionId,
        fingerprint: observed.payloadFingerprint,
      });
      observed = await this.inspectRestoreEntry(manifest);
      if (!fingerprintsEqual(expectedParent, observed.parentFingerprint)) {
        throw new QuarantineError("RESTORE_PARENT_CHANGED");
      }
      let renamed = false;
      try {
        await this.fileSystem.rename(manifest.payloadPath, manifest.sourcePath);
        renamed = true;
        await syncDirectory(dirname(manifest.sourcePath));
        await syncDirectory(dirname(manifest.payloadPath));
      } catch (error) {
        if (renamed) {
          this.mutationBlocked = true;
          throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
        }
        throw mapRestoreFileSystemError(error);
      }
      try {
        manifest = await this.persistState(
          manifest,
          "restored",
          { restoredAt: new Date(this.now()).toISOString() },
          { injectBeforeAppend: true },
        );
      } catch (error) {
        this.mutationBlocked = true;
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      }
      const result = await this.buildActionResult(manifest);
      this.actionResults.set(
        this.actionKey("restore", input.operationId),
        result,
      );
      return result;
    });
  }

  async preparePurge(input: PreparePurgeInput): Promise<PreviewToken> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    const manifest = await this.manifests.read(input.operationId);
    if (manifest.state !== "moved") {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    await this.assertManifestJournalCurrent(manifest);
    const fingerprint = await this.inspectPayload(manifest);
    return this.tokens.issue({
      action: "purge",
      subjectId: manifest.operationId,
      uiSessionId: input.uiSessionId,
      fingerprint,
    });
  }

  private async removeTreeNoFollow(
    root: string,
    current: string,
    rootDevice: bigint,
  ): Promise<void> {
    const fromRoot = relative(root, current);
    if (
      (fromRoot !== "" &&
        (fromRoot === ".." ||
          fromRoot.startsWith(`..${sep}`) ||
          isAbsolute(fromRoot))) ||
      current.includes("\u0000")
    ) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    const stats = await this.fileSystem.lstat(current);
    if (BigInt(stats.dev) !== rootDevice) {
      throw new QuarantineError("CROSS_VOLUME");
    }
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      await this.fileSystem.unlink(current);
      return;
    }
    for (const entry of await this.fileSystem.readdir(current)) {
      if (entry === "" || entry === "." || entry === ".." || entry.includes(sep)) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      await this.removeTreeNoFollow(root, join(current, entry), rootDevice);
    }
    await this.fileSystem.rmdir(current);
  }

  async purgeQuarantineEntry(
    input: PurgeQuarantineEntryInput,
  ): Promise<QuarantineActionResult> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    return this.operationLocks.run(input.operationId, async () => {
      let manifest = await this.manifests.read(input.operationId);
      if (manifest.state === "purged") {
        this.assertActionReplayBinding(
          manifest,
          "purge",
          input.token,
          input.uiSessionId,
        );
        const cached = this.actionResults.get(
          this.actionKey("purge", input.operationId),
        );
        if (cached !== undefined) return cached;
        return this.buildActionResult(manifest);
      }
      if (manifest.state !== "moved") {
        throw new QuarantineError("OPERATION_CONFLICT");
      }
      const observed = await this.inspectPayload(manifest);
      this.tokens.consume(input.token, {
        action: "purge",
        subjectId: manifest.operationId,
        uiSessionId: input.uiSessionId,
        fingerprint: observed,
      });
      const rechecked = await this.inspectPayload(manifest);
      let removed = false;
      try {
        const rootStats = await this.fileSystem.lstat(manifest.payloadPath);
        if (
          rootStats.isSymbolicLink() ||
          !payloadIdentityMatches(
            rechecked,
            await captureFingerprint(manifest.payloadPath),
          )
        ) {
          throw new QuarantineError("SOURCE_CHANGED");
        }
        await this.removeTreeNoFollow(
          manifest.payloadPath,
          manifest.payloadPath,
          BigInt(rootStats.dev),
        );
        removed = true;
        await syncDirectory(dirname(manifest.payloadPath));
      } catch (error) {
        if (removed) {
          this.mutationBlocked = true;
          throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
        }
        throw mapPurgeFileSystemError(error);
      }
      try {
        manifest = await this.persistState(
          manifest,
          "purged",
          { purgedAt: new Date(this.now()).toISOString() },
          { injectBeforeAppend: true },
        );
      } catch (error) {
        this.mutationBlocked = true;
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      }
      const result = await this.buildActionResult(manifest);
      this.actionResults.set(
        this.actionKey("purge", input.operationId),
        result,
      );
      return result;
    });
  }

  async recoverPreparedOperations(): Promise<QuarantineManifest[]> {
    return recoverPreparedOperations(this);
  }

  async recoverInternal(): Promise<QuarantineManifest[]> {
    try {
      return await this.recoverUnchecked();
    } catch (error) {
      if (
        error instanceof QuarantineError &&
        error.code === "MANIFEST_INCONSISTENT"
      ) {
        this.mutationBlocked = true;
      }
      throw error;
    }
  }

  private async recoverUnchecked(): Promise<QuarantineManifest[]> {
    let manifests: QuarantineManifest[];
    try {
      manifests = await this.manifests.list();
    } catch (error) {
      this.mutationBlocked = true;
      throw error;
    }
    const recovered: QuarantineManifest[] = [];
    for (const current of manifests) {
      if (current.state === "inconsistent") {
        this.mutationBlocked = true;
        recovered.push(current);
        continue;
      }
      if (
        (current.state === "restored" || current.state === "purged") &&
        !(await this.journal.hasEvent(current))
      ) {
        this.mutationBlocked = true;
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      if (!new Set<QuarantineState>(["previewed", "prepared", "moved"]).has(current.state)) {
        continue;
      }
      const paths = this.manifests.paths(current.operationId);
      const sourceExists = await pathExistsNoFollow(current.sourcePath);
      const payloadExists = await pathExistsNoFollow(paths.payloadPath);
      let state: QuarantineState;
      let lastErrorCode: QuarantineErrorCode | null = null;
      if (sourceExists && !payloadExists) {
        state = "aborted";
      } else if (!sourceExists && payloadExists) {
        state = "moved";
      } else if (sourceExists && payloadExists) {
        state = "conflicted";
        lastErrorCode = "OPERATION_CONFLICT";
      } else {
        state = "inconsistent";
        lastErrorCode = "MANIFEST_INCONSISTENT";
      }

      let next: QuarantineManifest;
      if (
        current.state === "moved" &&
        state === "moved" &&
        (await this.journal.hasEvent(current))
      ) {
        next = current;
      } else if (current.state === state && state !== "moved") {
        next = current;
      } else if (current.state === "moved" && state === "aborted") {
        next = await this.persistState(current, "inconsistent", {
          lastErrorCode: "MANIFEST_INCONSISTENT",
        });
        this.mutationBlocked = true;
      } else {
        const restoreParentFingerprint =
          state === "moved"
            ? await captureFingerprint(dirname(current.sourcePath))
            : current.sourceParentFingerprint;
        next = await this.persistState(current, state, {
          lastErrorCode,
          sourceParentFingerprint: restoreParentFingerprint,
          movedAt:
            state === "moved"
              ? current.movedAt ?? new Date(this.now()).toISOString()
              : current.movedAt,
        });
      }
      if (next.state === "inconsistent") this.mutationBlocked = true;
      recovered.push(next);
    }
    return recovered;
  }
}

export async function prepareMove(
  controller: QuarantineController,
  input: PrepareMoveInput,
): Promise<PreviewToken> {
  return controller.prepareMove(input);
}

export async function moveToQuarantine(
  controller: QuarantineController,
  input: MoveToQuarantineInput,
): Promise<QuarantineActionResult> {
  return controller.moveToQuarantine(input);
}

export async function recoverPreparedOperations(
  controller: QuarantineController,
): Promise<QuarantineManifest[]> {
  return controller.recoverInternal();
}

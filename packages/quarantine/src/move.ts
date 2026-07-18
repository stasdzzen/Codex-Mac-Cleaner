import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

import type { PolicyDecision, SnapshotFingerprint } from "@codex-mac-cleaner/policy";

import {
  QuarantineError,
  type FaultInjector,
  type QuarantineErrorCode,
} from "./errors.js";
import {
  fingerprintsEqual,
  inspectMoveSource,
  nodeFileSystem,
  pathExistsNoFollow,
  syncDirectory,
  type FileSystemOperations,
  type ObservedMoveState,
} from "./filesystem.js";
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
    moved: ["conflicted", "inconsistent"],
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
  ): Promise<QuarantineManifest> {
    assertOperationId(input.operationId);
    await this.refreshMutationBlock();
    return this.operationLocks.run(input.operationId, async () => {
      const existing = await this.manifests.readIfPresent(input.operationId);
      if (existing !== undefined) {
        this.assertReplayBinding(existing, input);
        return existing;
      }

      const resolved = this.tokens.resolve(input.token);
      const subject = this.subjectsByTokenId.get(resolved.tokenId);
      if (subject === undefined) throw new QuarantineError("OPERATION_CONFLICT");

      return this.objectLocks.run(objectLockKey(subject), async () => {
        const replay = await this.manifests.readIfPresent(input.operationId);
        if (replay !== undefined) {
          this.assertReplayBinding(replay, input);
          return replay;
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

        manifest = await this.persistState(
          manifest,
          "moved",
          { movedAt: new Date(this.now()).toISOString() },
          { injectBeforeAppend: true },
        );
        return manifest;
      });
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
        next = await this.persistState(current, state, {
          lastErrorCode,
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
): Promise<QuarantineManifest> {
  return controller.moveToQuarantine(input);
}

export async function recoverPreparedOperations(
  controller: QuarantineController,
): Promise<QuarantineManifest[]> {
  return controller.recoverInternal();
}

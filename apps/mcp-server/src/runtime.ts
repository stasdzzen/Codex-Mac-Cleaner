import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  ALLOWLISTED_LIBRARY_ROOTS,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  createNodeCommandRunner,
  createLibraryRootsAdapter,
  runAdapters,
  type AdapterFileEntry,
  type CommandRunner,
  type FileSystemFacade,
  type LibraryRoot,
  type MacOSCorrelationReadOnlyFileSystem,
  type MacOSOwnerBindingHistory,
  type Observation,
  type ProductionCorrelationAdapter,
} from "@codex-mac-cleaner/adapters";
import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import {
  AuditCancelInputSchema,
  AuditResultsInputSchema,
  AuditStartInputSchema,
  AuditStatusInputSchema,
  DashboardOpenInputSchema,
  FindingInspectInputSchema,
  FindingRevealInputSchema,
  type DiskObservation,
  type FindingModelView,
  type StorageSummary,
  type UserExclusion,
  type UserExclusionIdentity,
} from "@codex-mac-cleaner/contracts";
import {
  buildCorrelationEvidenceSet,
  normalizeEvidence,
  resolveCorrelation,
  type CorrelationResolverResult,
  type EvidenceSet,
} from "@codex-mac-cleaner/evidence";
import {
  PROTECTED_SCOPE_REGISTRY,
  evaluatePolicy,
  type FindingCategory,
  type PathValidationResult,
  type PolicyDecision,
  type ProtectedScopeKind,
  type SnapshotFingerprint,
  validateMutationPath,
} from "@codex-mac-cleaner/policy";
import {
  ManifestRepository,
  QuarantineController,
  captureFingerprint,
  observeDisk,
  type MoveSubject,
  type QuarantineActionResult,
  type QuarantineManifest,
  type RevalidationResult,
} from "@codex-mac-cleaner/quarantine";
import {
  ExclusionStateStore,
  InstallationKeyStore,
  JsonStore,
  type InstallationKey,
} from "@codex-mac-cleaner/storage";

import type { AuditToolService } from "./server.js";
import type { QuarantineToolService } from "./tools/quarantine.js";

const DASHBOARD_RESOURCE_URI = "ui://codex-mac-cleaner/dashboard-v1.html" as const;

const TERMINAL_STATES = new Set([
  "cancelled",
  "completed",
  "completed_with_warnings",
  "failed",
]);
const MAX_GIT_SCAN_DEPTH = 128;
const MAX_GIT_SCAN_ENTRIES = 100_000;
const MAX_EMPTY_ARTIFACT_ENTRIES = 4_096;
const EMPTY_CACHE_LOG_RULE_ID = "EMPTY_CACHE_LOG_ARTIFACT_V1" as const;
const EMPTY_CACHE_LOG_RULE_VERSION = 1 as const;

type RuntimeProtectedScopeKind = ProtectedScopeKind;

const PROTECTED_SCOPE_ORDER: readonly RuntimeProtectedScopeKind[] =
  PROTECTED_SCOPE_REGISTRY.map((rule) => rule.kind);

const PROTECTED_SCOPE_NAME_PATTERNS: Readonly<
  Partial<Record<RuntimeProtectedScopeKind, RegExp>>
> = Object.freeze({
  system_scope:
    /(?:^|[._ -])(?:system|launchagent|launchdaemon|autostart)(?:$|[._ -])/iu,
  credential_store:
    /(?:^|[._ -])(?:credential|keychain|password|secret|token|wallet|private[_-]?key|authorization)(?:$|[._ -])/iu,
  browser_profile:
    /(?:^|[._ -])(?:safari|chrome|firefox|browser)(?:$|[._ -])/iu,
  personal_data:
    /(?:^|[._ -])(?:personal|mail|message|photo|contact|calendar|database)(?:$|[._ -])/iu,
});

function isWithinBoundary(boundary: string, path: string): boolean {
  const fromBoundary = relative(resolve(boundary), resolve(path));
  return (
    fromBoundary === "" ||
    (!isAbsolute(fromBoundary) &&
      fromBoundary !== ".." &&
      !fromBoundary.startsWith(`..${sep}`))
  );
}

export interface ProtectedScopeEvaluation {
  readonly complete: boolean;
  readonly kinds: readonly RuntimeProtectedScopeKind[];
}

function boundariesOverlap(left: string, right: string): boolean {
  return isWithinBoundary(left, right) || isWithinBoundary(right, left);
}

export function evaluateRuntimeProtectedScopes(input: Readonly<{
  path: string;
  name: string;
  homeDirectory: string;
  stateRoot: string;
  currentProjectRoot: string;
  gitMarker: boolean;
  sensitivityFlags: readonly Observation["sensitivityFlags"][number][];
  metadataProtectionKinds: readonly RuntimeProtectedScopeKind[];
  structuralChecksComplete: boolean;
  gitTraversalComplete: boolean;
  contentSemanticChecksComplete: boolean;
}>): ProtectedScopeEvaluation {
  const kinds = new Set<RuntimeProtectedScopeKind>();
  for (const kind of input.metadataProtectionKinds) kinds.add(kind);
  const trustedContextComplete = [
    input.path,
    input.homeDirectory,
    input.stateRoot,
    input.currentProjectRoot,
  ].every((value) => value.length > 0 && isAbsolute(value));
  if (!isWithinBoundary(input.homeDirectory, input.path)) kinds.add("system_scope");
  if (boundariesOverlap(input.stateRoot, input.path)) kinds.add("plugin_owned_state");
  if (boundariesOverlap(join(input.homeDirectory, ".codex"), input.path)) {
    kinds.add("codex_state");
  }
  if (boundariesOverlap(input.currentProjectRoot, input.path)) {
    kinds.add("current_project_root");
  }
  if (input.gitMarker) kinds.add("local_git_repository");
  for (const [kind, pattern] of Object.entries(PROTECTED_SCOPE_NAME_PATTERNS) as Array<
    [RuntimeProtectedScopeKind, RegExp]
  >) {
    if (pattern.test(input.name)) kinds.add(kind);
  }
  if (
    input.sensitivityFlags.some((flag) =>
      ["credentials", "tokens", "subscription_url"].includes(flag),
    )
  ) {
    kinds.add("credential_store");
  }
  if (input.sensitivityFlags.some((flag) => ["personal_data", "database"].includes(flag))) {
    kinds.add("personal_data");
  }
  if (input.sensitivityFlags.includes("local_project")) {
    kinds.add("current_project_root");
  }
  return Object.freeze({
    complete:
      trustedContextComplete &&
      input.structuralChecksComplete &&
      input.gitTraversalComplete &&
      input.contentSemanticChecksComplete,
    kinds: Object.freeze(PROTECTED_SCOPE_ORDER.filter((kind) => kinds.has(kind))),
  });
}

interface GitProtectionScan {
  readonly marker: "directory" | "file" | null;
  readonly blocked: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprintDigest(fingerprint: SnapshotFingerprint): string {
  return `sha256:v1:${sha256(
    [
      fingerprint.device,
      fingerprint.inode,
      fingerprint.mode,
      fingerprint.uid,
      fingerprint.gid,
      fingerprint.size,
      fingerprint.mtimeNs,
      fingerprint.ctimeNs,
      fingerprint.fileType,
      fingerprint.mountId,
      fingerprint.symbolicLink,
      fingerprint.linkCount,
    ].join(":"),
  )}`;
}

function safeInteger(value: bigint): number {
  const converted = Number(value);
  return Number.isSafeInteger(converted) && converted >= 0 ? converted : 0;
}

function safeDate(value: bigint): string {
  const milliseconds = Number(value / 1_000_000n);
  return Number.isSafeInteger(milliseconds)
    ? new Date(milliseconds).toISOString()
    : "1970-01-01T00:00:00.000Z";
}

function fileType(stats: Awaited<ReturnType<typeof lstat>>): AdapterFileEntry["kind"] {
  if (stats.isSymbolicLink()) return "unknown";
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  return "unknown";
}

function categoryFor(root: LibraryRoot): FindingCategory {
  const categories: Readonly<Record<LibraryRoot, FindingCategory>> = {
    Caches: "cache",
    "Application Support": "application_support",
    Containers: "container",
    "Group Containers": "group_container",
    Preferences: "preference",
    Logs: "log",
    HTTPStorages: "http_storage",
    WebKit: "webkit",
    "Saved Application State": "saved_state",
  };
  return categories[root];
}

const PUBLIC_LIBRARY_LABELS: Readonly<Record<LibraryRoot, string>> = Object.freeze({
  Caches: "Объект кэша",
  "Application Support": "Объект поддержки приложения",
  Containers: "Объект контейнера",
  "Group Containers": "Объект группового контейнера",
  Preferences: "Объект настроек",
  Logs: "Объект журнала",
  HTTPStorages: "Объект HTTP-хранилища",
  WebKit: "Объект WebKit",
  "Saved Application State": "Объект сохранённого состояния",
});

function publicLibraryDisplayName(root: LibraryRoot, candidateRef: string): string {
  return `${PUBLIC_LIBRARY_LABELS[root]} ${candidateRef.slice(-8)}`;
}

interface RuntimeCorrelationProfileProof {
  readonly ownerBindingState:
    | "resolved"
    | "ambiguous"
    | "missing"
    | "mismatch"
    | "stale";
  readonly requirementProfileId:
    | "private_regenerable_remnant_v1"
    | "inspection_only_v1";
  readonly requirementProfileVersion: number;
  readonly requirementProfileFingerprint: string;
  readonly staleDuringAudit: boolean;
  readonly correlationRevisionId: string;
}

export interface RuntimeRegenerabilityProof {
  readonly schemaVersion: 1;
  readonly ruleId: typeof EMPTY_CACHE_LOG_RULE_ID;
  readonly ruleVersion: typeof EMPTY_CACHE_LOG_RULE_VERSION;
  readonly targetFingerprint: string;
  readonly correlationRevisionId: string;
}

interface RuntimeRegenerabilityProbe {
  readonly schemaVersion: 1;
  readonly ruleId: typeof EMPTY_CACHE_LOG_RULE_ID;
  readonly ruleVersion: typeof EMPTY_CACHE_LOG_RULE_VERSION;
  readonly complete: boolean;
  readonly empty: boolean;
  readonly targetFingerprint: string;
}

export function deriveRuntimeDataKind(input: Readonly<{
  category: FindingCategory;
  sensitivityFlags: readonly Observation["sensitivityFlags"][number][];
  correlation: RuntimeCorrelationProfileProof | null;
  proof?: RuntimeRegenerabilityProof | null;
  targetFingerprint?: string;
}>): "known" | "unsafe" | "unknown" {
  if (input.sensitivityFlags.length > 0) return "unsafe";
  const correlation = input.correlation;
  const proof = input.proof ?? null;
  const profileIsComplete =
    correlation !== null &&
    (input.category === "cache" || input.category === "log") &&
    correlation.ownerBindingState === "resolved" &&
    correlation.requirementProfileId === "private_regenerable_remnant_v1" &&
    Number.isSafeInteger(correlation.requirementProfileVersion) &&
    correlation.requirementProfileVersion > 0 &&
    /^sha256:v1:[a-f0-9]{64}$/u.test(correlation.requirementProfileFingerprint) &&
    !correlation.staleDuringAudit;
  const proofIsCurrent =
    proof !== null &&
    proof.schemaVersion === 1 &&
    proof.ruleId === EMPTY_CACHE_LOG_RULE_ID &&
    proof.ruleVersion === EMPTY_CACHE_LOG_RULE_VERSION &&
    proof.targetFingerprint === input.targetFingerprint &&
    proof.correlationRevisionId === correlation?.correlationRevisionId;
  return profileIsComplete && proofIsCurrent ? "known" : "unknown";
}

function createRuntimeRegenerabilityProof(
  probe: RuntimeRegenerabilityProbe,
  correlation: CorrelationResolverResult | null,
): RuntimeRegenerabilityProof | null {
  if (!probe.complete || !probe.empty || correlation === null) return null;
  return Object.freeze({
    schemaVersion: 1,
    ruleId: probe.ruleId,
    ruleVersion: probe.ruleVersion,
    targetFingerprint: probe.targetFingerprint,
    correlationRevisionId: correlation.revision.correlationRevisionId,
  });
}

function enforceProtectedScopeCompleteness(
  decision: PolicyDecision,
  evaluation: ProtectedScopeEvaluation,
): PolicyDecision {
  if (evaluation.complete) return decision;
  return {
    ...decision,
    allowedActions: decision.allowedActions.filter(
      (action) => action !== "prepare_move",
    ),
    blockingRuleIds: [
      ...new Set([...decision.blockingRuleIds, "PROTECTED_SCOPE"]),
    ],
  };
}

interface RuntimeCandidate {
  readonly ref: string;
  readonly path: string;
  readonly allowedRoot: string;
  readonly root: LibraryRoot;
  readonly kind: AdapterFileEntry["kind"];
  readonly fingerprint: SnapshotFingerprint;
  readonly parentFingerprint: SnapshotFingerprint;
  readonly protected: boolean;
  readonly protectedScopeEvaluation: ProtectedScopeEvaluation;
  readonly regenerabilityProbe: RuntimeRegenerabilityProbe;
  readonly pathValidation: PathValidationResult;
}

class RuntimeFileSystemFacade implements FileSystemFacade {
  private readonly candidates = new Map<string, RuntimeCandidate>();
  private readonly expectedUid = process.getuid?.() ?? -1;

  constructor(
    private readonly homeDirectory: string,
    private readonly stateRoot: string,
    private readonly currentProjectRoot: string,
  ) {}

  candidate(ref: string): RuntimeCandidate | undefined {
    return this.candidates.get(ref);
  }

  clear(): void {
    this.candidates.clear();
  }

  private isWithinBoundary(boundary: string, path: string): boolean {
    return isWithinBoundary(boundary, path);
  }

  private async directGitMarker(path: string): Promise<GitProtectionScan> {
    try {
      const marker = await lstat(join(path, ".git"), { bigint: true });
      if (marker.isDirectory()) return { marker: "directory", blocked: false };
      if (marker.isFile()) return { marker: "file", blocked: false };
      return { marker: "file", blocked: false };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { marker: null, blocked: false };
      }
      return { marker: null, blocked: true };
    }
  }

  private async gitProtection(
    candidatePath: string,
    candidateKind: AdapterFileEntry["kind"],
    signal?: AbortSignal,
  ): Promise<GitProtectionScan> {
    const candidateBoundary = resolve(candidatePath);
    if (!this.isWithinBoundary(this.homeDirectory, candidateBoundary)) {
      return { marker: null, blocked: true };
    }

    if (candidateKind === "directory") {
      let rootStats;
      try {
        rootStats = await lstat(candidateBoundary, { bigint: true });
      } catch {
        return { marker: null, blocked: true };
      }
      if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
        return { marker: null, blocked: true };
      }

      const pending: Array<{ readonly path: string; readonly depth: number }> = [
        { path: candidateBoundary, depth: 0 },
      ];
      let scannedEntries = 0;
      while (pending.length > 0) {
        signal?.throwIfAborted();
        const current = pending.pop();
        if (current === undefined || current.depth > MAX_GIT_SCAN_DEPTH) {
          return { marker: null, blocked: true };
        }

        let entries;
        try {
          entries = await readdir(current.path, { withFileTypes: true });
        } catch {
          return { marker: null, blocked: true };
        }
        for (const entry of entries) {
          signal?.throwIfAborted();
          scannedEntries += 1;
          if (
            scannedEntries > MAX_GIT_SCAN_ENTRIES ||
            entry.name === "" ||
            entry.name === "." ||
            entry.name === ".." ||
            entry.name.includes(sep) ||
            entry.name.includes("\0")
          ) {
            return { marker: null, blocked: true };
          }

          const childPath = join(current.path, entry.name);
          if (!this.isWithinBoundary(candidateBoundary, childPath)) {
            return { marker: null, blocked: true };
          }
          let childStats;
          try {
            childStats = await lstat(childPath, { bigint: true });
          } catch {
            return { marker: null, blocked: true };
          }
          if (childStats.dev !== rootStats.dev) {
            return { marker: null, blocked: true };
          }
          if (entry.name === ".git") {
            return {
              marker: childStats.isDirectory() ? "directory" : "file",
              blocked: false,
            };
          }
          if (childStats.isSymbolicLink()) continue;
          if (childStats.isDirectory()) {
            pending.push({ path: childPath, depth: current.depth + 1 });
          }
        }
      }
    }

    const homeBoundary = resolve(this.homeDirectory);
    let ancestor = dirname(candidateBoundary);
    while (this.isWithinBoundary(homeBoundary, ancestor)) {
      signal?.throwIfAborted();
      const marker = await this.directGitMarker(ancestor);
      if (marker.marker !== null || marker.blocked) return marker;
      if (ancestor === homeBoundary) break;
      const parent = dirname(ancestor);
      if (parent === ancestor) return { marker: null, blocked: true };
      ancestor = parent;
    }
    return { marker: null, blocked: false };
  }

  private incompleteRegenerabilityProbe(
    fingerprint: SnapshotFingerprint,
  ): RuntimeRegenerabilityProbe {
    return Object.freeze({
      schemaVersion: 1,
      ruleId: EMPTY_CACHE_LOG_RULE_ID,
      ruleVersion: EMPTY_CACHE_LOG_RULE_VERSION,
      complete: false,
      empty: false,
      targetFingerprint: fingerprintDigest(fingerprint),
    });
  }

  private async probeEmptyCacheLogArtifact(input: Readonly<{
    path: string;
    allowedRoot: string;
    root: LibraryRoot;
    fingerprint: SnapshotFingerprint;
    pathValidation: PathValidationResult;
    structurallyProtected: boolean;
    gitProtection: GitProtectionScan;
    signal?: AbortSignal;
  }>): Promise<RuntimeRegenerabilityProbe> {
    const incomplete = this.incompleteRegenerabilityProbe(input.fingerprint);
    if (
      (input.root !== "Caches" && input.root !== "Logs") ||
      dirname(resolve(input.path)) !== resolve(input.allowedRoot) ||
      !input.pathValidation.ok ||
      input.structurallyProtected ||
      input.gitProtection.blocked ||
      input.gitProtection.marker !== null
    ) {
      return incomplete;
    }
    try {
      input.signal?.throwIfAborted();
      const before = await captureFingerprint(input.path);
      if (fingerprintDigest(before) !== fingerprintDigest(input.fingerprint)) {
        return incomplete;
      }
      let empty = false;
      if (before.fileType === "file") {
        empty = before.size === 0 && before.linkCount === 1;
      } else if (before.fileType === "directory") {
        const entries = await readdir(input.path, { withFileTypes: true });
        if (entries.length > MAX_EMPTY_ARTIFACT_ENTRIES) return incomplete;
        for (const entry of entries) {
          input.signal?.throwIfAborted();
          if (
            entry.name === "" ||
            entry.name === "." ||
            entry.name === ".." ||
            entry.name.includes(sep) ||
            entry.name.includes("\0")
          ) {
            return incomplete;
          }
          const childPath = join(input.path, entry.name);
          if (!this.isWithinBoundary(input.path, childPath)) return incomplete;
          const child = await lstat(childPath, { bigint: true });
          if (
            child.isSymbolicLink() ||
            child.dev.toString() !== before.device ||
            (this.expectedUid >= 0 && Number(child.uid) !== this.expectedUid)
          ) {
            return incomplete;
          }
        }
        empty = entries.length === 0;
      } else {
        return incomplete;
      }
      const after = await captureFingerprint(input.path);
      if (fingerprintDigest(after) !== fingerprintDigest(before)) return incomplete;
      return Object.freeze({
        schemaVersion: 1,
        ruleId: EMPTY_CACHE_LOG_RULE_ID,
        ruleVersion: EMPTY_CACHE_LOG_RULE_VERSION,
        complete: true,
        empty,
        targetFingerprint: fingerprintDigest(after),
      });
    } catch {
      return incomplete;
    }
  }

  async revalidateCandidate(candidate: RuntimeCandidate): Promise<RuntimeCandidate> {
    const root = await captureFingerprint(candidate.allowedRoot);
    const current = await captureFingerprint(candidate.path);
    const currentParent = await captureFingerprint(dirname(candidate.path));
    const gitProtection = await this.gitProtection(candidate.path, candidate.kind);
    const pathValidation = validateMutationPath({
      root: candidate.allowedRoot,
      candidate: candidate.path,
      expectedOwnerUid: this.expectedUid,
      expectedDevice: root.device,
      expectedMountId: root.mountId,
      expectedFileType: candidate.fingerprint.fileType,
      ancestry: [
        {
          canonicalPath: candidate.allowedRoot,
          uid: root.uid,
          device: root.device,
          mountId: root.mountId,
          fileType: root.fileType,
          symbolicLink: root.symbolicLink,
          mountPoint: false,
          linkCount: root.linkCount,
          gitMarker: null,
        },
        {
          canonicalPath: candidate.path,
          uid: current.uid,
          device: current.device,
          mountId: current.mountId,
          fileType: current.fileType,
          symbolicLink: current.symbolicLink,
          mountPoint:
            current.device !== root.device || current.mountId !== root.mountId,
          linkCount: current.linkCount,
          gitMarker: gitProtection.marker,
        },
      ],
    });
    const structurallyProtected =
      current.symbolicLink ||
      current.fileType === "unknown" ||
      current.device !== root.device ||
      (this.expectedUid >= 0 && current.uid !== this.expectedUid);
    const regenerabilityProbe = await this.probeEmptyCacheLogArtifact({
      path: candidate.path,
      allowedRoot: candidate.allowedRoot,
      root: candidate.root,
      fingerprint: current,
      pathValidation,
      structurallyProtected,
      gitProtection,
    });
    const protectedScopeEvaluation = evaluateRuntimeProtectedScopes({
      path: candidate.path,
      name: basename(candidate.path),
      homeDirectory: this.homeDirectory,
      stateRoot: this.stateRoot,
      currentProjectRoot: this.currentProjectRoot,
      gitMarker: gitProtection.marker !== null,
      sensitivityFlags: [],
      metadataProtectionKinds: [],
      structuralChecksComplete: !structurallyProtected && pathValidation.ok,
      gitTraversalComplete: !gitProtection.blocked,
      contentSemanticChecksComplete:
        regenerabilityProbe.complete && regenerabilityProbe.empty,
    });
    return {
      ...candidate,
      fingerprint: current,
      parentFingerprint: currentParent,
      pathValidation,
      protected:
        !protectedScopeEvaluation.complete ||
        protectedScopeEvaluation.kinds.length > 0 ||
        gitProtection.blocked ||
        !pathValidation.ok,
      protectedScopeEvaluation,
      regenerabilityProbe,
    };
  }

  async listLibraryRoot(
    root: LibraryRoot,
    signal: AbortSignal,
  ): Promise<readonly AdapterFileEntry[]> {
    signal.throwIfAborted();
    const allowedRoot = join(this.homeDirectory, "Library", root);
    let rootStats;
    try {
      rootStats = await lstat(allowedRoot, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) return [];
    const entries = await readdir(allowedRoot, { withFileTypes: true });
    const output: AdapterFileEntry[] = [];
    for (const entry of entries) {
      signal.throwIfAborted();
      if (entry.name === "." || entry.name === ".." || entry.name.includes(sep)) continue;
      const path = join(allowedRoot, entry.name);
      const stats = await lstat(path, { bigint: true });
      const kind = fileType(stats);
      const structurallyProtected =
        stats.isSymbolicLink() ||
        kind === "unknown" ||
        stats.dev !== rootStats.dev ||
        (this.expectedUid >= 0 && Number(stats.uid) !== this.expectedUid);
      const ref = `candidate-${sha256(path).slice(0, 24)}`;
      const snapshot = await captureFingerprint(path);
      const parentFingerprint = await captureFingerprint(dirname(path));
      const gitProtection = await this.gitProtection(path, kind, signal);
      const pathValidation = validateMutationPath({
        root: allowedRoot,
        candidate: path,
        expectedOwnerUid: this.expectedUid,
        expectedDevice: rootStats.dev.toString(),
        expectedMountId: `device:${rootStats.dev.toString()}`,
        expectedFileType: snapshot.fileType,
        ancestry: [
          {
            canonicalPath: allowedRoot,
            uid: Number(rootStats.uid),
            device: rootStats.dev.toString(),
            mountId: `device:${rootStats.dev.toString()}`,
            fileType: "directory",
            symbolicLink: rootStats.isSymbolicLink(),
            mountPoint: false,
            linkCount: Number(rootStats.nlink),
            gitMarker: null,
          },
          {
            canonicalPath: path,
            uid: snapshot.uid,
            device: snapshot.device,
            mountId: snapshot.mountId,
            fileType: snapshot.fileType,
            symbolicLink: snapshot.symbolicLink,
            mountPoint:
              snapshot.device !== rootStats.dev.toString() ||
              snapshot.mountId !== `device:${rootStats.dev.toString()}`,
            linkCount: snapshot.linkCount,
            gitMarker: gitProtection.marker,
          },
        ],
      });
      const regenerabilityProbe = await this.probeEmptyCacheLogArtifact({
        path,
        allowedRoot,
        root,
        fingerprint: snapshot,
        pathValidation,
        structurallyProtected,
        gitProtection,
        signal,
      });
      const protectedScopeEvaluation = evaluateRuntimeProtectedScopes({
        path,
        name: entry.name,
        homeDirectory: this.homeDirectory,
        stateRoot: this.stateRoot,
        currentProjectRoot: this.currentProjectRoot,
        gitMarker: gitProtection.marker !== null,
        sensitivityFlags: [],
        metadataProtectionKinds: [],
        structuralChecksComplete: !structurallyProtected && pathValidation.ok,
        gitTraversalComplete: !gitProtection.blocked,
        contentSemanticChecksComplete:
          regenerabilityProbe.complete && regenerabilityProbe.empty,
      });
      const excludeFromCandidates =
        structurallyProtected ||
        protectedScopeEvaluation.kinds.length > 0 ||
        gitProtection.blocked ||
        !pathValidation.ok;
      this.candidates.set(ref, {
        ref,
        path,
        allowedRoot,
        root,
        kind,
        fingerprint: snapshot,
        parentFingerprint,
        protected:
          !protectedScopeEvaluation.complete ||
          protectedScopeEvaluation.kinds.length > 0 ||
          gitProtection.blocked ||
          !pathValidation.ok,
        protectedScopeEvaluation,
        regenerabilityProbe,
        pathValidation,
      });
      output.push({
        ref,
        displayName: publicLibraryDisplayName(root, ref),
        kind,
        logicalSize: safeInteger(stats.size),
        physicalSize: safeInteger(stats.blocks * 512n),
        modifiedAt: safeDate(stats.mtimeNs),
        fingerprint: [
          stats.dev,
          stats.ino,
          stats.mode,
          stats.uid,
          stats.gid,
          stats.size,
          stats.mtimeNs,
          stats.ctimeNs,
          stats.nlink,
        ].join(":"),
        volumeKind: stats.dev === rootStats.dev ? "internal_apfs" : "external",
        protection: excludeFromCandidates ? ["personal_data"] : [],
      });
    }
    return output;
  }

  async listTargetedSource(): Promise<readonly []> {
    return [];
  }
}

function sameIdentity(
  exclusion: UserExclusion,
  identity: UserExclusionIdentity,
): boolean {
  return (
    exclusion.ruleId === identity.ruleId &&
    exclusion.artifactKind === identity.artifactKind &&
    exclusion.normalizedTargetIdentity === identity.normalizedTargetIdentity &&
    (exclusion.bundleId ?? null) === (identity.bundleId ?? null) &&
    (exclusion.packageId ?? null) === (identity.packageId ?? null) &&
    (exclusion.signingIdentity ?? null) === (identity.signingIdentity ?? null) &&
    exclusion.ownerTypeFingerprint === identity.ownerTypeFingerprint
  );
}

interface FindingRecord {
  readonly model: FindingModelView;
  readonly observation: Observation;
  readonly evidence: EvidenceSet;
  readonly classification: Classification;
  readonly policy: PolicyDecision;
  readonly correlation: CorrelationResolverResult | null;
  readonly regenerabilityProof: RuntimeRegenerabilityProof | null;
  readonly candidate: RuntimeCandidate;
  readonly identity: UserExclusionIdentity;
}

interface AuditRunRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly controller: AbortController;
  state:
    | "queued"
    | "running"
    | "cancelling"
    | "cancelled"
    | "completed"
    | "completed_with_warnings"
    | "failed";
  stateVersion: number;
  cancelRequestedAt: string | null;
  revision: number | null;
  completedSteps: number;
  coverageWarningCodes: string[];
  coverage: {
    checkedSourceCount: number;
    skippedSourceCount: number;
    warnings: string[];
  };
  findings: FindingRecord[];
  excludedCount: number;
}

export interface RuntimeExclusionStore {
  list(): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  create(exclusion: UserExclusion): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  remove(exclusionId: string): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly UserExclusion[];
  }>;
  reset(expectedStateVersion: number): ReturnType<ExclusionStateStore["reset"]>;
  readForAudit(): Promise<
    | Readonly<{ status: "ready"; exclusions: readonly UserExclusion[] }>
    | Readonly<{
        status: "invalid";
        errorCode: "EXCLUSION_STATE_INVALID";
        tokenIssuance: "blocked";
      }>
  >;
}

class PersistentRuntimeExclusionStore implements RuntimeExclusionStore {
  private readonly store: ExclusionStateStore;

  constructor(stateRoot: string) {
    this.store = new ExclusionStateStore({ stateRoot });
  }

  async list() {
    return this.store.list();
  }

  async create(exclusion: UserExclusion) {
    return this.store.create({
      ...exclusion,
      bundleId: exclusion.bundleId ?? null,
      packageId: exclusion.packageId ?? null,
      signingIdentity: exclusion.signingIdentity ?? null,
    });
  }

  async remove(exclusionId: string) {
    return this.store.remove(exclusionId);
  }

  async reset(expectedStateVersion: number) {
    return this.store.reset(expectedStateVersion);
  }

  async readForAudit() {
    return this.store.readForAudit();
  }
}

export interface RuntimeServiceOptions {
  readonly homeDirectory?: string;
  readonly stateRoot?: string;
  readonly currentProjectRoot?: string;
  readonly now?: () => Date;
  readonly createId?: (prefix: string) => string;
  /**
   * Низкоуровневые production boundaries для in-process проверки composition.
   * Они не доступны через MCP, env или plugin manifest; packaged runtime всегда
   * использует concrete Node/macOS implementations и package-owned state.
   */
  readonly correlation?: Readonly<{
    readonly commands?: CommandRunner;
    readonly filesystem?: MacOSCorrelationReadOnlyFileSystem;
    readonly ownerBindingHistory?: MacOSOwnerBindingHistory;
    readonly installationKey?: InstallationKey;
  }>;
}

function defaultStateRoot(homeDirectory: string): string {
  return (
    process.env.CODEX_MAC_CLEANER_PLUGIN_DATA ??
    join(homeDirectory, "Library", "Application Support", "Codex Mac Cleaner", "plugin")
  );
}

class AuditRuntimeService implements AuditToolService {
  private readonly runs = new Map<string, AuditRunRecord>();
  private readonly auditIdByRequest = new Map<string, string>();
  private latestAuditId: string | null = null;

  constructor(
    private readonly filesystem: RuntimeFileSystemFacade,
    private readonly exclusions: RuntimeExclusionStore,
    private readonly stateRoot: string,
    private readonly homeDirectory: string,
    private readonly installationKey: InstallationKey,
    private readonly correlationCommands: CommandRunner,
    private readonly correlationFilesystem: MacOSCorrelationReadOnlyFileSystem | undefined,
    private readonly ownerBindingHistory: MacOSOwnerBindingHistory | undefined,
    private readonly now: () => Date,
    private readonly createId: (prefix: string) => string,
  ) {}

  private runFor(auditId: string): AuditRunRecord {
    const run = this.runs.get(auditId);
    if (run === undefined) throw new Error("AUDIT_STALE");
    return run;
  }

  private completedRun(auditId: string, revision: number): AuditRunRecord {
    const run = this.runFor(auditId);
    if (
      run.revision !== revision ||
      (run.state !== "completed" && run.state !== "completed_with_warnings")
    ) {
      throw new Error("AUDIT_STALE");
    }
    return run;
  }

  private async exclusionSnapshot(): Promise<{
    readonly invalid: boolean;
    readonly exclusions: readonly UserExclusion[];
    readonly stateVersion: number;
  }> {
    const state = await this.exclusions.readForAudit();
    if (state.status === "invalid") {
      return { invalid: true, exclusions: [], stateVersion: 0 };
    }
    const listed = await this.exclusions.list();
    return {
      invalid: false,
      exclusions: listed.exclusions,
      stateVersion: listed.stateVersion,
    };
  }

  private correlationAdapter(
    candidates: ReadonlyMap<string, string>,
  ): ProductionCorrelationAdapter {
    return createMacOSProductionCorrelationAdapter({
      commands: this.correlationCommands,
      candidates: createMacOSCandidateRegistry({
        candidates,
        userHome: this.homeDirectory,
      }),
      stateRoot: this.stateRoot,
      installationKey: this.installationKey,
      ...(this.correlationFilesystem === undefined
        ? {}
        : { filesystem: this.correlationFilesystem }),
      ...(this.ownerBindingHistory === undefined
        ? {}
        : { ownerBindingHistory: this.ownerBindingHistory }),
      now: () => this.now().toISOString(),
    });
  }

  private findingId(auditId: string, targetRef: string): string {
    return `finding-${sha256(`${auditId}:${targetRef}`).slice(0, 24)}`;
  }

  private supportLevel(
    observation: Observation,
    category: FindingCategory,
  ): EvidenceSet["supportLevel"] {
    return category === "cache" || category === "log"
      ? observation.supportLevel
      : "analysis_only";
  }

  private async resolveCandidate(
    adapter: ProductionCorrelationAdapter,
    observation: Observation,
    auditId: string,
    auditRevision: number,
    exclusionStateVersion: number,
    signal: AbortSignal,
    phase: "audit" | "revalidation",
  ): Promise<CorrelationResolverResult> {
    const rawInput = await adapter.buildInput({
      candidateRef: observation.targetRef,
      snapshotId: `${phase}-${sha256(`${auditId}:${observation.targetRef}`).slice(0, 32)}`,
      signal,
    });
    return resolveCorrelation({
      auditId,
      auditRevision,
      findingId: this.findingId(auditId, observation.targetRef),
      exclusionStateVersion,
      ruleSetVersion: 2,
      policyVersion: 2,
      now: this.now().toISOString(),
      deriver: this.installationKey,
      rawInput,
    });
  }

  private buildFinding(
    observation: Observation,
    candidate: RuntimeCandidate,
    correlation: CorrelationResolverResult | null,
    auditId: string,
    exclusionState: Readonly<{
      invalid: boolean;
      exclusions: readonly UserExclusion[];
    }>,
  ): FindingRecord {
    const category = categoryFor(candidate.root);
    const supportLevel = this.supportLevel(observation, category);
    const regenerabilityProof = createRuntimeRegenerabilityProof(
      candidate.regenerabilityProbe,
      correlation,
    );
    const evidence = correlation === null
      ? normalizeEvidence([observation], [])[0]!
      : buildCorrelationEvidenceSet(correlation, {
          supportLevel,
          sensitivityFlags: observation.sensitivityFlags,
          dataKind: deriveRuntimeDataKind({
            category,
            sensitivityFlags: observation.sensitivityFlags,
            correlation: {
              ownerBindingState: correlation.safeView.ownerBindingState,
              requirementProfileId: correlation.revision.requirementProfileId,
              requirementProfileVersion:
                correlation.revision.requirementProfileVersion,
              requirementProfileFingerprint:
                correlation.revision.requirementProfileFingerprint,
              staleDuringAudit: correlation.revision.staleDuringAudit,
              correlationRevisionId: correlation.revision.correlationRevisionId,
            },
            proof: regenerabilityProof,
            targetFingerprint: fingerprintDigest(candidate.fingerprint),
          }),
        });
    const classification = classifyEvidence(evidence);
    const currentFingerprint = candidate.fingerprint;
    const findingId = this.findingId(auditId, observation.targetRef);
    const identity: UserExclusionIdentity = {
      ruleId: classification.ruleIds[0] ?? "CLASSIFIER_V2_UNKNOWN_INCOMPLETE_EVIDENCE",
      artifactKind: candidate.kind,
      normalizedTargetIdentity: `target:v1:${sha256(
        correlation?.candidateSubjectId ?? evidence.targetIdentity,
      )}`,
      bundleId: null,
      packageId: null,
      signingIdentity: null,
      ownerTypeFingerprint: `owner-type:v1:${sha256(
        `${candidate.fingerprint.uid}:${candidate.fingerprint.fileType}`,
      )}`,
    };
    const matchedExclusion = exclusionState.exclusions.find((exclusion) =>
      sameIdentity(exclusion, identity),
    );
    const policy = enforceProtectedScopeCompleteness(
      evaluatePolicy({
        classification,
        evidenceSet: evidence,
        ...(correlation === null
          ? {}
          : { correlationRevision: correlation.revision }),
        supportLevel: evidence.supportLevel,
        category,
        sensitivityFlags: evidence.sensitivityFlags,
        protectedScopeKinds: candidate.protectedScopeEvaluation.kinds,
        exclusionMatch: exclusionState.invalid
          ? { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" }
          : matchedExclusion === undefined
            ? { status: "none" }
            : { status: "matched", exclusionId: matchedExclusion.exclusionId },
        officialUninstallerApplicable:
          correlation?.safeView.facts.officialUninstaller.state === "present",
        snapshotFingerprint: candidate.fingerprint,
        currentFingerprint,
        pathValidation: candidate.pathValidation,
      }),
      candidate.protectedScopeEvaluation,
    );
    const blockingReasons =
      policy.blockingRuleIds.length === 0
        ? []
        : [...policy.blockingRuleIds];
    const model: FindingModelView = {
      findingId,
      displayName: observation.displayName,
      category,
      supportLevel,
      logicalSize: observation.logicalSize,
      physicalSize: observation.physicalSize,
      label: classification.label,
      confidence: classification.confidence,
      risk: policy.blockingRuleIds.length === 0 ? "low" : "medium",
      allowedActions: [...policy.allowedActions],
      safeMetadata: {
        format: "unknown",
        parseStatus: "not_attempted",
        byteLength: observation.logicalSize,
        modifiedAt: observation.observedAt,
        sensitivityFlags: [...observation.sensitivityFlags],
      },
      blockingReasons,
    };
    return {
      model,
      observation,
      evidence,
      classification,
      policy,
      correlation,
      regenerabilityProof,
      candidate,
      identity,
    };
  }

  private async execute(run: AuditRunRecord): Promise<void> {
    run.state = "running";
    run.stateVersion += 1;
    this.filesystem.clear();
    try {
      const result = await runAdapters([createLibraryRootsAdapter(this.filesystem)], {
        signal: run.controller.signal,
      });
      run.coverageWarningCodes = result.coverage.gaps.map((gap) => gap.errorCode);
      run.coverage = {
        checkedSourceCount: result.coverage.checkedSourceCount,
        skippedSourceCount: result.coverage.skippedSourceCount,
        warnings: result.coverage.gaps.map((gap) => gap.safeMessage),
      };
      const exclusionState = await this.exclusionSnapshot();
      const candidatePaths = new Map(
        result.observations.flatMap((observation) => {
          const candidate = this.filesystem.candidate(observation.targetRef);
          return candidate === undefined
            ? []
            : [[observation.targetRef, candidate.path] as const];
        }),
      );
      const correlationAdapter = this.correlationAdapter(candidatePaths);
      const findings: FindingRecord[] = [];
      const correlationWarningCodes = new Set<string>();
      for (const observation of result.observations) {
        run.controller.signal.throwIfAborted();
        const candidate = this.filesystem.candidate(observation.targetRef);
        if (candidate === undefined) continue;
        let correlation: CorrelationResolverResult | null = null;
        try {
          correlation = await this.resolveCandidate(
            correlationAdapter,
            observation,
            run.auditId,
            1,
            exclusionState.stateVersion,
            run.controller.signal,
            "audit",
          );
          if (correlation.safeView.coverageSummary.gapCount > 0) {
            correlationWarningCodes.add("CORRELATION_COVERAGE_INCOMPLETE");
          }
          if (correlation.safeView.ownerBindingState === "ambiguous") {
            correlationWarningCodes.add("CORRELATION_AMBIGUOUS");
          } else if (correlation.safeView.ownerBindingState === "mismatch") {
            correlationWarningCodes.add("CORRELATION_MISMATCH");
          }
          if (correlation.safeView.staleDuringAudit) {
            correlationWarningCodes.add("CORRELATION_SNAPSHOT_STALE");
          }
        } catch {
          correlationWarningCodes.add("CORRELATION_COVERAGE_INCOMPLETE");
        }
        const finding = this.buildFinding(
          observation,
          candidate,
          correlation,
          run.auditId,
          exclusionState,
        );
        if (
          !exclusionState.exclusions.some((exclusion) =>
            sameIdentity(exclusion, finding.identity),
          )
        ) {
          findings.push(finding);
        } else {
          run.excludedCount += 1;
        }
      }
      run.findings = findings;
      run.coverageWarningCodes = [
        ...new Set([...run.coverageWarningCodes, ...correlationWarningCodes]),
      ];
      if (correlationWarningCodes.size > 0) {
        run.coverage = {
          ...run.coverage,
          warnings: [
            ...run.coverage.warnings,
            "Некоторые correlation facts недоступны; изменяющие действия заблокированы.",
          ],
        };
      }
      run.state =
        result.state === "completed" && run.coverageWarningCodes.length > 0
          ? "completed_with_warnings"
          : result.state;
      run.revision =
        result.state === "completed" || result.state === "completed_with_warnings" ? 1 : null;
      run.completedSteps = 1;
    } catch (error) {
      if (run.controller.signal.aborted) {
        run.state = "cancelled";
      } else {
        run.state = "failed";
        run.coverageWarningCodes = ["INTERNAL_ERROR"];
      }
      run.completedSteps = 1;
    } finally {
      run.stateVersion += 1;
    }
  }

  async start(rawInput: unknown) {
    const input = AuditStartInputSchema.parse(rawInput);
    const existingId = this.auditIdByRequest.get(input.requestId);
    if (existingId !== undefined) {
      const existing = this.runFor(existingId);
      return { auditId: existing.auditId, state: "queued" as const, stateVersion: 0 };
    }
    const auditId = this.createId("audit");
    const run: AuditRunRecord = {
      auditId,
      requestId: input.requestId,
      controller: new AbortController(),
      state: "queued",
      stateVersion: 0,
      cancelRequestedAt: null,
      revision: null,
      completedSteps: 0,
      coverageWarningCodes: [],
      coverage: { checkedSourceCount: 0, skippedSourceCount: 0, warnings: [] },
      findings: [],
      excludedCount: 0,
    };
    this.runs.set(auditId, run);
    this.auditIdByRequest.set(input.requestId, auditId);
    this.latestAuditId = auditId;
    queueMicrotask(() => void this.execute(run));
    return { auditId, state: "queued" as const, stateVersion: 0 };
  }

  async status(rawInput: unknown) {
    const input = AuditStatusInputSchema.parse(rawInput);
    const run = this.runFor(input.auditId);
    return {
      auditId: run.auditId,
      state: run.state,
      stateVersion: run.stateVersion,
      progress: { completedSteps: run.completedSteps, totalSteps: 1 },
      coverageWarningCodes: run.coverageWarningCodes,
    };
  }

  async cancel(rawInput: unknown) {
    const input = AuditCancelInputSchema.parse(rawInput);
    const run = this.runFor(input.auditId);
    if (!TERMINAL_STATES.has(run.state)) {
      run.cancelRequestedAt ??= this.now().toISOString();
      run.state = "cancelling";
      run.stateVersion += 1;
      run.controller.abort();
    }
    return {
      auditId: run.auditId,
      state: run.state,
      stateVersion: run.stateVersion,
      cancelRequestedAt: run.cancelRequestedAt,
    };
  }

  private async safeSnapshot(run: AuditRunRecord) {
    const exclusionState = await this.exclusions.list();
    const storageSummary = await this.storageSummary();
    const diskObservation = await observeDisk(this.stateRoot);
    return {
      storageSummary,
      diskObservation,
      excludedCount: run.excludedCount,
      stateVersion: Math.max(run.stateVersion, storageSummary.stateVersion, exclusionState.stateVersion),
    };
  }

  async results(rawInput: unknown) {
    const input = AuditResultsInputSchema.parse(rawInput);
    const run = this.completedRun(input.auditId, input.revision);
    const safe = await this.safeSnapshot(run);
    const findings = run.findings
      .map((finding) => finding.model)
      .filter((finding) =>
        (input.filters.categories === undefined || input.filters.categories.includes(finding.category)) &&
        (input.filters.supportLevels === undefined ||
          input.filters.supportLevels.includes(finding.supportLevel)) &&
        (input.filters.labels === undefined || input.filters.labels.includes(finding.label)) &&
        (input.filters.risks === undefined || input.filters.risks.includes(finding.risk)),
      );
    return {
      auditId: run.auditId,
      revision: input.revision,
      stateVersion: safe.stateVersion,
      storageSummary: safe.storageSummary,
      diskObservation: safe.diskObservation,
      excludedCount: safe.excludedCount,
      findings,
      nextCursor: null,
    };
  }

  async dashboard(rawInput: unknown) {
    const input = DashboardOpenInputSchema.parse(rawInput);
    const run = this.completedRun(input.auditId, input.revision);
    const results = await this.results({
      auditId: input.auditId,
      revision: input.revision,
      cursor: null,
      filters: {},
    });
    const output = {
      auditId: results.auditId,
      revision: results.revision,
      state: run.state,
      stateVersion: results.stateVersion,
      resourceUri: DASHBOARD_RESOURCE_URI,
      storageSummary: results.storageSummary,
      diskObservation: results.diskObservation,
      excludedCount: results.excludedCount,
      findings: results.findings,
    };
    const manifests = await new ManifestRepository(this.stateRoot).list();
    const dashboard = {
      auditId: run.auditId,
      revision: input.revision,
      state: run.state,
      stateVersion: output.stateVersion,
      progress: { completedSteps: 1, totalSteps: 1 },
      coverage: run.coverage,
      storageSummary: output.storageSummary,
      diskObservation: output.diskObservation,
      excludedCount: output.excludedCount,
      findings: run.findings.map((finding) => {
        const safe = finding.correlation?.safeView;
        const facts = safe?.facts;
        const receiptState =
          safe?.receiptLifecycle.lifecycle === "live" ||
          safe?.receiptLifecycle.lifecycle === "stale"
            ? "present"
            : safe?.receiptLifecycle.lifecycle === "absent"
              ? "absent"
              : "unknown";
        return {
          ...finding.model,
          componentDisplayName: finding.model.displayName,
          correlationRevisionId: safe?.correlationRevisionId ?? null,
          ownerBindingState: safe?.ownerBindingState ?? "missing",
          ownerBindingSourceClass: safe?.ownerBindingSourceClass ?? "none",
          requirementProfileId: safe?.requirementProfileId ?? "inspection_only_v1",
          requirementApplicability: safe?.requirementApplicability ?? null,
          receiptLifecycle: safe?.receiptLifecycle ?? {
            lifecycle: "unknown",
            reasonCode: "missing",
          },
          facts: facts ?? null,
          coverageSummary: safe?.coverageSummary ?? {
            completeSourceCount: 0,
            gapCount: 1,
            gapCodes: ["missing"],
          },
          staleDuringAudit: safe?.staleDuringAudit ?? true,
          blockingReasonCodes: safe?.blockingReasonCodes ?? ["coverage_incomplete"],
          findingFacts: {
            lastObservedAt: finding.observation.observedAt,
            temporalKind: finding.evidence.stale ? "stale" : "current",
            mainBundleState: facts?.ownerApplication.state ?? "unknown",
            activityState: facts?.activity.state ?? "unknown",
            openFileState: facts?.openFile.state ?? "unknown",
            startupKinds:
              facts?.startupTarget.state === "present" ? ["unknown"] : [],
            targetExecutableState: facts?.ownerExecutable.state ?? "unknown",
            receiptState,
            dependencyState: facts?.dependency.state ?? "unknown",
            sensitivityFlags: finding.observation.sensitivityFlags,
            recommendedRemovalMethod: finding.evidence.recommendedRemovalMethod,
            blockingReasons: finding.model.blockingReasons,
          },
          reclaimEstimate: {
            estimatedPhysicalBytes: finding.model.physicalSize,
            confidence: "low",
            basis: "observed_physical_size",
            limitations: ["snapshot_estimate"],
            observedAt: finding.observation.observedAt,
          },
          evidence: [],
        };
      }),
      quarantineEntries: manifests
        .filter((manifest) => manifest.state === "moved")
        .map((manifest) => ({
          entryId: manifest.operationId,
          displayName: "Объект карантина",
          physicalBytes: manifest.physicalSize,
          movedAt: manifest.movedAt ?? manifest.confirmedAt,
          state: "moved" as const,
        })),
    };
    return { output, meta: { dashboard } };
  }

  async inspect(rawInput: unknown) {
    const input = FindingInspectInputSchema.parse(rawInput);
    const { finding, run } = this.findingWithRun(
      input.findingId,
      input.auditRevision,
    );
    return {
      findingId: input.findingId,
      auditRevision: input.auditRevision,
      stateVersion: run.stateVersion,
      finding: finding.model,
      evidenceSummaries: [finding.classification.explanation],
      stale: false,
    };
  }

  async reveal(rawInput: unknown) {
    const input = FindingRevealInputSchema.parse(rawInput);
    const { finding, run } = this.findingWithRun(
      input.findingId,
      input.auditRevision,
    );
    return {
      findingId: input.findingId,
      auditRevision: input.auditRevision,
      stateVersion: run.stateVersion,
      outcome: finding.policy.allowedActions.includes("reveal") ? "not_available" : "stale",
    };
  }

  private findingWithRun(
    findingId: string,
    revision: number,
  ): { readonly finding: FindingRecord; readonly run: AuditRunRecord } {
    for (const run of this.runs.values()) {
      if (run.revision !== revision) continue;
      const finding = run.findings.find((candidate) => candidate.model.findingId === findingId);
      if (finding !== undefined) return { finding, run };
    }
    throw new Error("AUDIT_STALE");
  }

  finding(findingId: string, revision: number): FindingRecord {
    return this.findingWithRun(findingId, revision).finding;
  }

  async resolveIdentity(
    findingId: string,
    auditRevision: number,
  ): Promise<UserExclusionIdentity | null> {
    try {
      return this.finding(findingId, auditRevision).identity;
    } catch {
      return null;
    }
  }

  async storageSummary(): Promise<StorageSummary> {
    const run = this.latestAuditId === null ? undefined : this.runs.get(this.latestAuditId);
    const candidateLogicalBytes = run?.findings.reduce(
      (total, finding) => total + finding.model.logicalSize,
      0,
    ) ?? 0;
    const candidatePhysicalBytes = run?.findings.reduce(
      (total, finding) => total + finding.model.physicalSize,
      0,
    ) ?? 0;
    const controller = new QuarantineController({
      storeRoot: this.stateRoot,
      candidateStorage: async () => ({ candidateLogicalBytes, candidatePhysicalBytes }),
      resolveSubject: async () => {
        throw new Error("AUDIT_STALE");
      },
      revalidate: async () => {
        throw new Error("AUDIT_STALE");
      },
    });
    return controller.readStorageSummary();
  }

  moveSubject(findingId: string, revision: number): MoveSubject {
    const { finding, run } = this.findingWithRun(findingId, revision);
    return {
      auditId: run.auditId,
      auditRevision: revision,
      findingId,
      sourcePath: finding.candidate.path,
      allowedRoot: finding.candidate.allowedRoot,
      sourceFingerprint: finding.candidate.fingerprint,
      sourceParentFingerprint: finding.candidate.parentFingerprint,
      artifactKind: finding.candidate.kind,
      category: finding.model.category,
      physicalSize: finding.model.physicalSize,
      classificationRuleIds: finding.classification.ruleIds,
      policyRuleIds: finding.policy.blockingRuleIds,
    };
  }

  async revalidate(
    subject: MoveSubject,
    observed: { sourceFingerprint: SnapshotFingerprint; sourceParentFingerprint: SnapshotFingerprint },
  ): Promise<RevalidationResult> {
    const { finding, run } = this.findingWithRun(
      subject.findingId,
      subject.auditRevision,
    );
    const currentPath = await this.filesystem.revalidateCandidate(finding.candidate);
    const exclusionState = await this.exclusionSnapshot();
    let currentFinding: FindingRecord | null = null;
    try {
      const adapter = this.correlationAdapter(
        new Map([[finding.observation.targetRef, finding.candidate.path]]),
      );
      const correlation = await this.resolveCandidate(
        adapter,
        finding.observation,
        run.auditId,
        subject.auditRevision,
        exclusionState.stateVersion,
        new AbortController().signal,
        "revalidation",
      );
      currentFinding = this.buildFinding(
        finding.observation,
        currentPath,
        correlation,
        run.auditId,
        exclusionState,
      );
    } catch {
      currentFinding = null;
    }
    const currentCorrelation = currentFinding?.correlation ?? null;
    const originalCorrelation = finding.correlation;
    const authorityStable =
      originalCorrelation !== null &&
      currentCorrelation !== null &&
      currentCorrelation.candidateSubjectId === originalCorrelation.candidateSubjectId &&
      currentCorrelation.revision.ownerBindingFingerprint ===
        originalCorrelation.revision.ownerBindingFingerprint &&
      currentCorrelation.revision.requirementProfileFingerprint ===
        originalCorrelation.revision.requirementProfileFingerprint &&
      currentCorrelation.revision.exclusionStateVersion ===
        originalCorrelation.revision.exclusionStateVersion &&
      finding.regenerabilityProof !== null &&
      currentFinding !== null &&
      currentFinding.regenerabilityProof !== null &&
      finding.regenerabilityProof.ruleId ===
        currentFinding.regenerabilityProof.ruleId &&
      finding.regenerabilityProof.ruleVersion ===
        currentFinding.regenerabilityProof.ruleVersion &&
      !currentCorrelation.revision.staleDuringAudit;
    const evaluated =
      currentFinding === null
        ? finding.policy
        : enforceProtectedScopeCompleteness(
            evaluatePolicy({
              classification: currentFinding.classification,
              evidenceSet: currentFinding.evidence,
              ...(currentCorrelation === null
                ? {}
                : { correlationRevision: currentCorrelation.revision }),
              supportLevel: currentFinding.evidence.supportLevel,
              category: currentFinding.model.category,
              sensitivityFlags: currentFinding.evidence.sensitivityFlags,
              protectedScopeKinds: currentPath.protectedScopeEvaluation.kinds,
              exclusionMatch: exclusionState.invalid
                ? { status: "invalid", errorCode: "EXCLUSION_STATE_INVALID" }
                : exclusionState.exclusions.some((exclusion) =>
                      sameIdentity(exclusion, currentFinding!.identity),
                    )
                  ? {
                      status: "matched",
                      exclusionId:
                        exclusionState.exclusions.find((exclusion) =>
                          sameIdentity(exclusion, currentFinding!.identity),
                        )!.exclusionId,
                    }
                  : { status: "none" },
              officialUninstallerApplicable:
                currentCorrelation?.safeView.facts.officialUninstaller.state ===
                "present",
              snapshotFingerprint: finding.candidate.fingerprint,
              currentFingerprint: observed.sourceFingerprint,
              pathValidation: currentPath.pathValidation,
            }),
            currentPath.protectedScopeEvaluation,
          );
    const policyDecision: PolicyDecision = authorityStable
      ? evaluated
      : {
          ...evaluated,
          allowedActions: evaluated.allowedActions.filter(
            (action) => action !== "prepare_move",
          ),
          blockingRuleIds: [
            ...new Set([
              ...evaluated.blockingRuleIds,
              "POLICY_CORRELATION_BINDING_MISMATCH",
            ]),
          ],
        };
    const activity = currentCorrelation?.safeView.facts.activity.state;
    const openFile = currentCorrelation?.safeView.facts.openFile.state;
    return {
      policyDecision,
      ownerIdentity:
        authorityStable &&
        currentCorrelation?.safeView.ownerBindingState === "resolved" &&
        observed.sourceFingerprint.uid ===
          (process.getuid?.() ?? observed.sourceFingerprint.uid)
          ? "matched"
          : currentCorrelation === null
            ? "unknown"
            : "mismatched",
      activityState:
        activity === "absent"
          ? "inactive"
          : activity === "present"
            ? "active"
            : "unknown",
      openFileState:
        openFile === "absent"
          ? "closed"
          : openFile === "present"
            ? "open"
            : "unknown",
      protectedScope: currentPath.protected,
      sensitivityFlags:
        currentFinding?.evidence.sensitivityFlags ?? finding.evidence.sensitivityFlags,
    };
  }
}

type RuntimeActionHandleBinding =
  | Readonly<{
      action: "move";
      uiSessionId: string;
      findingId: string;
      auditRevision: number;
      secret: string;
      expiresAt: string;
    }>
  | Readonly<{
      action: "restore" | "purge";
      uiSessionId: string;
      operationId: string;
      secret: string;
      expiresAt: string;
    }>;

type RuntimeActionHandleExpectation = Readonly<{
  action: "move" | "restore" | "purge";
  uiSessionId: string;
  operationId: string;
}>;

type RuntimeActionHandleRecord = {
  readonly binding: RuntimeActionHandleBinding;
  operationId: string | undefined;
  state: "issued" | "running" | "succeeded";
  inFlight: Promise<unknown> | undefined;
  result: unknown;
};

/**
 * Session-local bridge между legacy transport field `previewToken` и
 * server-only core preview secret. Successful exact replay возвращает
 * сохранённый safe result; ни handle, ни registry не персистятся.
 */
export class RuntimeActionHandleRegistry {
  private readonly records = new Map<string, RuntimeActionHandleRecord>();
  private readonly operationClaims = new Map<string, string>();
  private readonly now: () => number;
  private readonly createHandle: () => string;

  constructor(
    options: Readonly<{
      now?: () => number;
      createHandle?: () => string;
    }> = {},
  ) {
    this.now = options.now ?? Date.now;
    this.createHandle =
      options.createHandle ?? (() => `action-handle-${randomUUID()}`);
  }

  issue(binding: RuntimeActionHandleBinding): string {
    const expiresAt = Date.parse(binding.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= this.now()) {
      throw new Error("ACTION_HANDLE_EXPIRED");
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const handle = this.createHandle();
      if (
        handle.length === 0 ||
        handle === binding.secret ||
        this.records.has(handle)
      ) {
        continue;
      }
      this.records.set(handle, {
        binding: Object.freeze({ ...binding }),
        operationId:
          binding.action === "move" ? undefined : binding.operationId,
        state: "issued",
        inFlight: undefined,
        result: undefined,
      });
      return handle;
    }
    throw new Error("ACTION_HANDLE_GENERATION_FAILED");
  }

  private claimKey(expected: RuntimeActionHandleExpectation): string {
    return [expected.action, expected.uiSessionId, expected.operationId].join(
      "\u0000",
    );
  }

  private remove(handle: string, record: RuntimeActionHandleRecord): void {
    this.records.delete(handle);
    if (record.operationId === undefined) return;
    const claimKey = this.claimKey({
      action: record.binding.action,
      uiSessionId: record.binding.uiSessionId,
      operationId: record.operationId,
    });
    if (this.operationClaims.get(claimKey) === handle) {
      this.operationClaims.delete(claimKey);
    }
  }

  private expired(record: RuntimeActionHandleRecord): boolean {
    return Date.parse(record.binding.expiresAt) <= this.now();
  }

  private claimOperation(
    handle: string,
    record: RuntimeActionHandleRecord,
    expected: RuntimeActionHandleExpectation,
  ): void {
    if (record.operationId === undefined) {
      record.operationId = expected.operationId;
    } else if (record.operationId !== expected.operationId) {
      throw new Error("ACTION_HANDLE_BINDING_MISMATCH");
    }
    const claimKey = this.claimKey(expected);
    const claimedHandle = this.operationClaims.get(claimKey);
    if (claimedHandle !== undefined && claimedHandle !== handle) {
      const claimedRecord = this.records.get(claimedHandle);
      if (
        claimedRecord !== undefined &&
        claimedRecord.state !== "succeeded" &&
        this.expired(claimedRecord)
      ) {
        this.remove(claimedHandle, claimedRecord);
      } else {
        throw new Error("ACTION_HANDLE_OPERATION_CONFLICT");
      }
    }
    this.operationClaims.set(claimKey, handle);
  }

  async execute<Result>(
    handle: string,
    expected: RuntimeActionHandleExpectation,
    executor: (secret: string) => Promise<Result>,
  ): Promise<Result> {
    const record = this.records.get(handle);
    if (record === undefined) throw new Error("ACTION_HANDLE_INVALID");
    const { binding } = record;
    if (
      binding.action !== expected.action ||
      binding.uiSessionId !== expected.uiSessionId ||
      (binding.action !== "move" &&
        binding.operationId !== expected.operationId)
    ) {
      throw new Error("ACTION_HANDLE_BINDING_MISMATCH");
    }
    if (record.state !== "succeeded" && this.expired(record)) {
      this.remove(handle, record);
      throw new Error("ACTION_HANDLE_EXPIRED");
    }
    this.claimOperation(handle, record, expected);
    if (record.state === "succeeded") return record.result as Result;
    if (record.state === "running") {
      return record.inFlight as Promise<Result>;
    }

    const execution = Promise.resolve()
      .then(() => executor(binding.secret))
      .then(
        (result) => {
          record.state = "succeeded";
          record.inFlight = undefined;
          record.result = result;
          return result;
        },
        (error: unknown) => {
          record.state = "issued";
          record.inFlight = undefined;
          throw error;
        },
      );
    record.state = "running";
    record.inFlight = execution;
    return execution;
  }
}

class RuntimeQuarantineService implements QuarantineToolService {
  private readonly uiSessionId = `ui-session-${randomUUID()}`;
  private readonly actionHandles = new RuntimeActionHandleRegistry();

  constructor(
    private readonly controller: QuarantineController,
    private readonly audit: AuditRuntimeService,
    private readonly exclusions: {
      assertFindingCanReceiveDestructiveToken(
        findingId: string,
        auditRevision: number,
      ): Promise<void>;
    },
    private readonly stateRoot: string,
  ) {}

  private entry(manifest: QuarantineManifest) {
    return {
      quarantineEntryId: manifest.operationId,
      displayName: "Объект карантина",
      physicalBytes: manifest.physicalSize,
      movedAt: manifest.movedAt ?? manifest.confirmedAt,
      state:
        manifest.state === "restored" || manifest.state === "purged"
          ? manifest.state
          : ("moved" as const),
    };
  }

  private action(result: QuarantineActionResult) {
    return {
      quarantineEntry: this.entry(result),
      storageSummary: result.summary,
      diskObservation: result.diskObservation,
      stateVersion: result.stateVersion,
    };
  }

  async prepareMove(input: { findingId: string; auditRevision: number }) {
    await this.exclusions.assertFindingCanReceiveDestructiveToken(
      input.findingId,
      input.auditRevision,
    );
    const finding = this.audit.finding(input.findingId, input.auditRevision);
    const preview = await this.controller.prepareMove({ ...input, uiSessionId: this.uiSessionId });
    const actionHandle = this.actionHandles.issue({
      action: "move",
      uiSessionId: this.uiSessionId,
      findingId: input.findingId,
      auditRevision: input.auditRevision,
      secret: preview.secret,
      expiresAt: preview.expiresAt,
    });
    return {
      previewToken: actionHandle,
      expiresAt: preview.expiresAt,
      findingId: input.findingId,
      auditRevision: input.auditRevision,
      displayName: finding.model.displayName,
      reclaimEstimate: {
        estimatedPhysicalBytes: finding.model.physicalSize,
        confidence: "low" as const,
        basis: "observed_physical_size" as const,
        limitations: ["snapshot_estimate" as const],
        observedAt: finding.observation.observedAt,
      },
      stateVersion: 0,
    };
  }

  async move(input: { previewToken: string; operationId: string }) {
    return this.actionHandles.execute(
      input.previewToken,
      {
        action: "move",
        uiSessionId: this.uiSessionId,
        operationId: input.operationId,
      },
      async (secret) =>
        this.action(
          await this.controller.moveToQuarantine({
            token: secret,
            operationId: input.operationId,
            uiSessionId: this.uiSessionId,
          }),
        ),
    );
  }

  async list() {
    const manifests = await new ManifestRepository(this.stateRoot).list();
    const storageSummary = await this.controller.readStorageSummary();
    const diskObservation: DiskObservation = await observeDisk(this.stateRoot);
    return {
      quarantineEntries: manifests
        .filter((manifest) => ["moved", "restored", "purged"].includes(manifest.state))
        .map((manifest) => this.entry(manifest)),
      storageSummary,
      diskObservation,
      stateVersion: storageSummary.stateVersion,
    };
  }

  async prepareRestore(input: { operationId: string }) {
    const manifest = await new ManifestRepository(this.stateRoot).read(input.operationId);
    const preview = await this.controller.prepareRestore({
      operationId: input.operationId,
      uiSessionId: this.uiSessionId,
    });
    const actionHandle = this.actionHandles.issue({
      action: "restore",
      uiSessionId: this.uiSessionId,
      operationId: input.operationId,
      secret: preview.secret,
      expiresAt: preview.expiresAt,
    });
    return {
      previewToken: actionHandle,
      expiresAt: preview.expiresAt,
      quarantineEntry: this.entry(manifest),
      stateVersion: manifest.eventSequence,
    };
  }

  async restore(input: { operationId: string; previewToken: string }) {
    return this.actionHandles.execute(
      input.previewToken,
      {
        action: "restore",
        uiSessionId: this.uiSessionId,
        operationId: input.operationId,
      },
      async (secret) =>
        this.action(
          await this.controller.restoreFromQuarantine({
            operationId: input.operationId,
            token: secret,
            uiSessionId: this.uiSessionId,
          }),
        ),
    );
  }

  async preparePurge(input: { operationId: string }) {
    const manifest = await new ManifestRepository(this.stateRoot).read(input.operationId);
    const preview = await this.controller.preparePurge({
      operationId: input.operationId,
      uiSessionId: this.uiSessionId,
    });
    const actionHandle = this.actionHandles.issue({
      action: "purge",
      uiSessionId: this.uiSessionId,
      operationId: input.operationId,
      secret: preview.secret,
      expiresAt: preview.expiresAt,
    });
    return {
      previewToken: actionHandle,
      expiresAt: preview.expiresAt,
      quarantineEntry: this.entry(manifest),
      stateVersion: manifest.eventSequence,
    };
  }

  async purge(input: { operationId: string; previewToken: string }) {
    return this.actionHandles.execute(
      input.previewToken,
      {
        action: "purge",
        uiSessionId: this.uiSessionId,
        operationId: input.operationId,
      },
      async (secret) =>
        this.action(
          await this.controller.purgeQuarantineEntry({
            operationId: input.operationId,
            token: secret,
            uiSessionId: this.uiSessionId,
          }),
        ),
    );
  }
}

export interface RuntimeCore {
  readonly auditService: AuditRuntimeService;
  readonly exclusionStore: RuntimeExclusionStore;
  createQuarantineService(exclusions: {
    assertFindingCanReceiveDestructiveToken(
      findingId: string,
      auditRevision: number,
    ): Promise<void>;
  }): Promise<QuarantineToolService>;
}

export async function createRuntimeCore(
  options: RuntimeServiceOptions = {},
): Promise<RuntimeCore> {
  const requestedHomeDirectory = resolve(options.homeDirectory ?? homedir());
  const homeDirectory = await realpath(requestedHomeDirectory);
  const requestedStateRoot = resolve(
    options.stateRoot ?? defaultStateRoot(homeDirectory),
  );
  await new JsonStore(requestedStateRoot).ensureDirectory(".");
  const stateRoot = await realpath(requestedStateRoot);
  const exclusionStore = new PersistentRuntimeExclusionStore(
    join(stateRoot, "exclusions"),
  );
  const installationKey = await new InstallationKeyStore({ stateRoot })
    .loadOrCreate();
  const requestedCurrentProjectRoot = resolve(
    options.currentProjectRoot ?? process.cwd(),
  );
  const currentProjectRoot = await realpath(requestedCurrentProjectRoot);
  const filesystem = new RuntimeFileSystemFacade(
    homeDirectory,
    stateRoot,
    currentProjectRoot,
  );
  const auditService = new AuditRuntimeService(
    filesystem,
    exclusionStore,
    stateRoot,
    homeDirectory,
    options.correlation?.installationKey ?? installationKey,
    options.correlation?.commands ?? createNodeCommandRunner(),
    options.correlation?.filesystem,
    options.correlation?.ownerBindingHistory,
    options.now ?? (() => new Date()),
    options.createId ?? ((prefix) => `${prefix}-${randomUUID()}`),
  );
  return {
    auditService,
    exclusionStore,
    async createQuarantineService(exclusions) {
      const manifests = new ManifestRepository(stateRoot);
      const controller = new QuarantineController({
        storeRoot: stateRoot,
        candidateStorage: async () => {
          const summary = await auditService.storageSummary();
          return {
            candidateLogicalBytes: summary.candidateLogicalBytes,
            candidatePhysicalBytes: summary.candidatePhysicalBytes,
          };
        },
        resolveSubject: async ({ findingId, auditRevision }) => {
          try {
            return auditService.moveSubject(findingId, auditRevision);
          } catch {
            const manifest = (await manifests.list()).find(
              (candidate) =>
                candidate.findingId === findingId &&
                candidate.auditRevision === auditRevision,
            );
            if (manifest === undefined) throw new Error("AUDIT_STALE");
            const allowedRoot = ALLOWLISTED_LIBRARY_ROOTS
              .map((root) => join(homeDirectory, "Library", root))
              .find((root) => dirname(manifest.sourcePath) === root);
            if (allowedRoot === undefined) throw new Error("PATH_OUTSIDE_ALLOWLIST");
            return {
              auditId: manifest.auditId,
              auditRevision: manifest.auditRevision,
              findingId: manifest.findingId,
              sourcePath: manifest.sourcePath,
              allowedRoot,
              sourceFingerprint: manifest.sourceFingerprint,
              sourceParentFingerprint: manifest.sourceParentFingerprint,
              artifactKind: manifest.artifactKind,
              category: manifest.category,
              physicalSize: manifest.physicalSize,
              classificationRuleIds: manifest.classificationRuleIds,
              policyRuleIds: manifest.policyRuleIds,
            };
          }
        },
        revalidate: (subject, observed) => auditService.revalidate(subject, observed),
      });
      await controller.recoverPreparedOperations();
      return new RuntimeQuarantineService(
        controller,
        auditService,
        exclusions,
        stateRoot,
      );
    },
  };
}

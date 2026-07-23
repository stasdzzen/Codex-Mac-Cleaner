import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  ALLOWLISTED_LIBRARY_ROOTS,
  createAutostartAdapter,
  createCommandTimeoutRunner,
  createInspectionOnlyAdapter,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  createNodeCommandRunner,
  createOrphanedProcessAdapter,
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
  type TargetedRecord,
} from "@codex-mac-cleaner/adapters";
import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import {
  AuditCancelInputSchema,
  AuditResultsInputSchema,
  AuditStartInputSchema,
  AuditStatusInputSchema,
  DashboardOpenInputSchema,
  DashboardPageInputSchema,
  CorrelationRevisionSchema,
  FindingModelViewSchema,
  FindingInspectInputSchema,
  FindingRevealInputSchema,
  ModelSafeTextSchema,
  SafeCorrelationViewSchema,
  type DiskObservation,
  type AuditProgressPhase,
  type FindingModelView,
  type KeyedUserExclusion,
  type KeyedUserExclusionIdentity,
  type StorageSummary,
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
  matchKeyedUserExclusions,
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
  deriveKeyedUserExclusion,
  KeyedExclusionStateStore,
  InstallationKeyStore,
  JsonStore,
  type InstallationKey,
  type KeyedExclusionMetadata,
  type RawUserExclusionIdentity,
  type RuntimeSchema,
} from "@codex-mac-cleaner/storage";

import type { AuditToolService } from "./server.js";
import type { QuarantineToolService } from "./tools/quarantine.js";

const DASHBOARD_RESOURCE_URI = "ui://codex-mac-cleaner/dashboard-v4.html" as const;
const DASHBOARD_PAGE_SIZE = 100;
const DASHBOARD_PAGE_MAX_BYTES = 512 * 1024;

const TERMINAL_STATES = new Set([
  "cancelled",
  "completed",
  "completed_with_warnings",
  "failed",
]);
const MAX_GIT_SCAN_DEPTH = 128;
const MAX_GIT_SCAN_ENTRIES = 100_000;
const MAX_REGENERABLE_ARTIFACT_ENTRIES = 4_096;
const DEFAULT_CANDIDATE_CONCURRENCY = 8;
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const CACHE_LOG_REGENERABILITY_RULE_ID =
  "BOUNDED_CACHE_LOG_REGENERABILITY_V2" as const;
const CACHE_LOG_REGENERABILITY_RULE_VERSION = 2 as const;
const LATEST_AUDIT_STATE_PATH = "audits/latest.json";

type RuntimeProtectedScopeKind = ProtectedScopeKind;

type RuntimeStartupKind = "launch_agent" | "launch_daemon";

interface RuntimeDiagnostic {
  readonly componentDisplayName: string;
  readonly category: FindingCategory;
  readonly startupKind: RuntimeStartupKind | null;
  readonly activityState: "present" | "unknown";
  readonly targetExecutableState: "absent" | "unknown";
}

function safeWidgetComponentDisplayName(
  value: string,
  fallback: string,
): string {
  const normalized = basename(value)
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 160);
  const parsed = ModelSafeTextSchema.safeParse(normalized);
  return parsed.success ? parsed.data : fallback;
}

async function mapConcurrentOrdered<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        output[index] = await worker(values[index]!, index);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

const PROTECTED_SCOPE_ORDER: readonly RuntimeProtectedScopeKind[] =
  PROTECTED_SCOPE_REGISTRY.map((rule) => rule.kind);

const PROTECTED_SCOPE_NAME_PATTERNS: Readonly<
  Partial<Record<RuntimeProtectedScopeKind, RegExp>>
> = Object.freeze({
  system_scope:
    /(?:^|[._ -])(?:system|launchagent|launchdaemon|autostart)(?:$|[._ -])/iu,
  credential_store:
    /(?:^|[._ -])(?:credentials?|keychains?|passwords?|secrets?|tokens?|wallets?|private[_-]?keys?|authori[sz]ations?|auth|oauth|sessions?|cookies?|logins?)(?:$|[._ -])/iu,
  browser_profile:
    /(?:^|[._ -])(?:safari|chrome|firefox|browsers?|bookmarks?|history|profiles?)(?:$|[._ -])/iu,
  personal_data:
    /(?:^|[._ -])(?:personal|mails?|messages?|photos?|contacts?|calendars?|databases?|db|sqlite3?|documents?|save(?:d|s)?|savegames?|sync|vpn|web[._ -]+data|local[._ -]+state|settings?|preferences?|configs?|configuration)(?:$|[._ -])/iu,
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
  readonly ruleId: typeof CACHE_LOG_REGENERABILITY_RULE_ID;
  readonly ruleVersion: typeof CACHE_LOG_REGENERABILITY_RULE_VERSION;
  readonly targetFingerprint: string;
  readonly correlationRevisionId: string;
}

interface RuntimeRegenerabilityProbe {
  readonly schemaVersion: 1;
  readonly ruleId: typeof CACHE_LOG_REGENERABILITY_RULE_ID;
  readonly ruleVersion: typeof CACHE_LOG_REGENERABILITY_RULE_VERSION;
  readonly complete: boolean;
  readonly regenerable: boolean;
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
    proof.ruleId === CACHE_LOG_REGENERABILITY_RULE_ID &&
    proof.ruleVersion === CACHE_LOG_REGENERABILITY_RULE_VERSION &&
    proof.targetFingerprint === input.targetFingerprint &&
    proof.correlationRevisionId === correlation?.correlationRevisionId;
  return profileIsComplete && proofIsCurrent ? "known" : "unknown";
}

function createRuntimeRegenerabilityProof(
  probe: RuntimeRegenerabilityProbe,
  correlation: CorrelationResolverResult | null,
): RuntimeRegenerabilityProof | null {
  if (!probe.complete || !probe.regenerable || correlation === null) return null;
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
  private readonly diagnostics = new Map<string, RuntimeDiagnostic>();
  private readonly expectedUid = process.getuid?.() ?? -1;

  constructor(
    private readonly homeDirectory: string,
    private readonly stateRoot: string,
    private readonly currentProjectRoot: string,
    private readonly commands: CommandRunner,
    private readonly systemLibraryRoot: string,
    private readonly processInspectionEnabled: boolean,
  ) {}

  candidate(ref: string): RuntimeCandidate | undefined {
    return this.candidates.get(ref);
  }

  diagnostic(ref: string): RuntimeDiagnostic | undefined {
    return this.diagnostics.get(ref);
  }

  clear(): void {
    this.candidates.clear();
    this.diagnostics.clear();
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
          if (entry.name === ".git") {
            let childStats;
            try {
              childStats = await lstat(childPath, { bigint: true });
            } catch {
              return { marker: null, blocked: true };
            }
            if (childStats.dev !== rootStats.dev) {
              return { marker: null, blocked: true };
            }
            return {
              marker: childStats.isDirectory() ? "directory" : "file",
              blocked: false,
            };
          }
          if (entry.isSymbolicLink() || entry.isFile()) continue;
          if (!entry.isDirectory()) return { marker: null, blocked: true };
          let childStats;
          try {
            childStats = await lstat(childPath, { bigint: true });
          } catch {
            return { marker: null, blocked: true };
          }
          if (
            childStats.dev !== rootStats.dev ||
            childStats.isSymbolicLink() ||
            !childStats.isDirectory()
          ) {
            return { marker: null, blocked: true };
          }
          pending.push({ path: childPath, depth: current.depth + 1 });
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
      ruleId: CACHE_LOG_REGENERABILITY_RULE_ID,
      ruleVersion: CACHE_LOG_REGENERABILITY_RULE_VERSION,
      complete: false,
      regenerable: false,
      targetFingerprint: fingerprintDigest(fingerprint),
    });
  }

  private async probeCacheLogArtifact(input: Readonly<{
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
      let regenerable = false;
      if (before.fileType === "file") {
        regenerable =
          before.linkCount === 1 &&
          (input.root === "Caches" || before.size === 0);
      } else if (before.fileType === "directory") {
        const pending = [input.path];
        let entryCount = 0;
        while (pending.length > 0) {
          const directory = pending.pop()!;
          const entries = await readdir(directory, { withFileTypes: true });
          entryCount += entries.length;
          if (entryCount > MAX_REGENERABLE_ARTIFACT_ENTRIES) return incomplete;
          for (const entry of entries) {
            input.signal?.throwIfAborted();
            if (
              entry.name === "" ||
              entry.name === "." ||
              entry.name === ".." ||
              entry.name.includes(sep) ||
              entry.name.includes("\0") ||
              Object.values(PROTECTED_SCOPE_NAME_PATTERNS).some((pattern) =>
                pattern?.test(entry.name),
              )
            ) {
              return incomplete;
            }
            const childPath = join(directory, entry.name);
            if (!this.isWithinBoundary(input.path, childPath)) return incomplete;
            const child = await lstat(childPath, { bigint: true });
            if (
              child.isSymbolicLink() ||
              child.dev.toString() !== before.device ||
              (this.expectedUid >= 0 && Number(child.uid) !== this.expectedUid)
            ) {
              return incomplete;
            }
            if (child.isDirectory()) {
              pending.push(childPath);
            } else if (!child.isFile() || child.nlink !== 1n) {
              return incomplete;
            }
          }
        }
        regenerable = input.root === "Caches" || entryCount === 0;
      } else {
        return incomplete;
      }
      const after = await captureFingerprint(input.path);
      if (fingerprintDigest(after) !== fingerprintDigest(before)) return incomplete;
      return Object.freeze({
        schemaVersion: 1,
        ruleId: CACHE_LOG_REGENERABILITY_RULE_ID,
        ruleVersion: CACHE_LOG_REGENERABILITY_RULE_VERSION,
        complete: true,
        regenerable,
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
    const regenerabilityProbe = await this.probeCacheLogArtifact({
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
        regenerabilityProbe.complete && regenerabilityProbe.regenerable,
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
      const regenerabilityProbe = await this.probeCacheLogArtifact({
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
          regenerabilityProbe.complete && regenerabilityProbe.regenerable,
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

  private async launchExecutableState(
    plistPath: string,
    signal: AbortSignal,
  ): Promise<"present" | "absent" | "unknown"> {
    try {
      const output = await this.commands.run(
        "/usr/bin/plutil",
        ["-convert", "json", "-o", "-", plistPath],
        { signal },
      );
      if (output.exitCode !== 0) return "unknown";
      const parsed: unknown = JSON.parse(output.stdout);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "unknown";
      }
      const metadata = parsed as Readonly<Record<string, unknown>>;
      const argumentsValue = metadata.ProgramArguments;
      const executable =
        typeof metadata.Program === "string"
          ? metadata.Program
          : Array.isArray(argumentsValue) && typeof argumentsValue[0] === "string"
            ? argumentsValue[0]
            : null;
      if (executable === null || !isAbsolute(executable)) return "unknown";
      try {
        await lstat(executable);
        return "present";
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "absent"
          : "unknown";
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ETIMEDOUT") throw error;
      signal.throwIfAborted();
      return "unknown";
    }
  }

  private async missingLaunchTargets(
    root: string,
    startupKind: RuntimeStartupKind,
    systemOwned: boolean,
    signal: AbortSignal,
  ): Promise<readonly TargetedRecord[]> {
    let rootStats;
    try {
      rootStats = await lstat(root, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) return [];
    const entries = await readdir(root, { withFileTypes: true });
    const records: TargetedRecord[] = [];
    for (const entry of entries) {
      signal.throwIfAborted();
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".plist") ||
        entry.name.includes(sep) ||
        entry.name.includes("\0")
      ) {
        continue;
      }
      const path = join(root, entry.name);
      const stats = await lstat(path, { bigint: true });
      if (
        stats.isSymbolicLink() ||
        !stats.isFile() ||
        (!systemOwned && this.expectedUid >= 0 && Number(stats.uid) !== this.expectedUid)
      ) {
        continue;
      }
      const targetState = await this.launchExecutableState(path, signal);
      if (targetState !== "absent") continue;
      const ref = `autostart-${sha256(path).slice(0, 24)}`;
      const displayName = systemOwned
        ? "Системная запись автозапуска с отсутствующим target"
        : "Запись автозапуска с отсутствующим target";
      this.diagnostics.set(ref, {
        componentDisplayName: safeWidgetComponentDisplayName(
          entry.name,
          systemOwned ? "Системная запись автозапуска" : "Запись автозапуска",
        ),
        category: "autostart",
        startupKind,
        activityState: "unknown",
        targetExecutableState: "absent",
      });
      records.push({
        ref,
        displayName,
        kind: startupKind === "launch_daemon" ? "launch_daemon" : "launch_item",
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
        ].join(":"),
        executableState: "absent",
        logicalSize: safeInteger(stats.size),
        physicalSize: safeInteger(stats.blocks * 512n),
        recommendedMethod: systemOwned ? "advanced_mode" : "inspect_only",
      });
    }
    return records;
  }

  private async missingExecutableProcesses(
    signal: AbortSignal,
  ): Promise<readonly TargetedRecord[]> {
    const output = await this.commands.run(
      "/bin/ps",
      ["-axo", "pid=,uid=,comm="],
      { signal },
    );
    if (output.exitCode !== 0) return [];
    const records: TargetedRecord[] = [];
    const seenExecutables = new Set<string>();
    const observedAt = new Date().toISOString();
    for (const line of output.stdout.split(/\r?\n/u)) {
      signal.throwIfAborted();
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/u);
      if (match === null) continue;
      const uid = Number(match[2]);
      const executable = match[3]!;
      if (
        !Number.isSafeInteger(uid) ||
        !isAbsolute(executable) ||
        executable.includes("\0") ||
        seenExecutables.has(executable)
      ) {
        continue;
      }
      seenExecutables.add(executable);
      try {
        await lstat(executable);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") continue;
      }
      const systemOwned = this.expectedUid >= 0 && uid !== this.expectedUid;
      const ref = `process-${sha256(`${uid}:${executable}`).slice(0, 24)}`;
      const displayName = systemOwned
        ? "Системный активный процесс с отсутствующим executable"
        : "Активный процесс с отсутствующим executable";
      this.diagnostics.set(ref, {
        componentDisplayName: safeWidgetComponentDisplayName(
          executable,
          systemOwned ? "Системный активный процесс" : "Активный процесс",
        ),
        category: "unknown",
        startupKind: null,
        activityState: "present",
        targetExecutableState: "absent",
      });
      records.push({
        ref,
        displayName,
        kind: "service",
        modifiedAt: observedAt,
        fingerprint: sha256(`${uid}:${executable}`),
        executableState: "absent",
        logicalSize: 0,
        physicalSize: 0,
        recommendedMethod: systemOwned ? "advanced_mode" : "inspect_only",
      });
    }
    return records;
  }

  async listTargetedSource(
    kind: string,
    signal: AbortSignal,
  ): Promise<readonly TargetedRecord[]> {
    if (kind === "autostart") {
      return this.missingLaunchTargets(
        join(this.homeDirectory, "Library", "LaunchAgents"),
        "launch_agent",
        false,
        signal,
      );
    }
    if (kind === "inspection") {
      const [launchAgents, launchDaemons] = await Promise.all([
        this.missingLaunchTargets(
          join(this.systemLibraryRoot, "LaunchAgents"),
          "launch_agent",
          true,
          signal,
        ),
        this.missingLaunchTargets(
          join(this.systemLibraryRoot, "LaunchDaemons"),
          "launch_daemon",
          true,
          signal,
        ),
      ]);
      return [...launchAgents, ...launchDaemons];
    }
    if (kind === "orphaned_processes") {
      return this.processInspectionEnabled
        ? this.missingExecutableProcesses(signal)
        : [];
    }
    return [];
  }
}

function rawExclusionIdentity(
  identity: UserExclusionIdentity,
): RawUserExclusionIdentity {
  return {
    targetIdentity: identity.normalizedTargetIdentity,
    ownerTypeFingerprint: identity.ownerTypeFingerprint,
    ...(identity.bundleId == null
      ? {}
      : { bundleIdentifier: identity.bundleId }),
    ...(identity.packageId == null
      ? {}
      : { packageIdentifier: identity.packageId }),
    ...(identity.signingIdentity == null
      ? {}
      : { signingRequirement: identity.signingIdentity }),
  };
}

interface FindingRecord {
  readonly model: FindingModelView;
  readonly componentDisplayName: string;
  readonly observation: Observation;
  readonly evidence: EvidenceSet;
  readonly classification: Classification;
  readonly policy: PolicyDecision;
  readonly correlation: RuntimeCorrelationRecord | null;
  readonly regenerabilityProof: RuntimeRegenerabilityProof | null;
  readonly candidate: RuntimeCandidate | null;
  readonly identity: UserExclusionIdentity | null;
  readonly diagnostic: RuntimeDiagnostic | null;
}

type RuntimeCorrelationRecord = Pick<
  CorrelationResolverResult,
  "candidateSubjectId" | "revision" | "safeView"
>;

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
  progressPhase: AuditProgressPhase;
  completedSteps: number;
  totalSteps: number;
  processedCandidates: number;
  totalCandidates: number;
  coverageWarningCodes: string[];
  coverage: {
    checkedSourceCount: number;
    skippedSourceCount: number;
    warnings: string[];
  };
  findings: FindingRecord[];
  excludedCount: number;
  persistence: Promise<void> | null;
}

type PersistedCandidate = Pick<
  RuntimeCandidate,
  | "ref"
  | "path"
  | "allowedRoot"
  | "root"
  | "kind"
  | "fingerprint"
  | "parentFingerprint"
>;

interface PersistedFinding {
  readonly model: FindingModelView;
  readonly componentDisplayName: string;
  readonly observation: Observation;
  readonly evidence: EvidenceSet;
  readonly classification: Classification;
  readonly policy: PolicyDecision;
  readonly correlation: RuntimeCorrelationRecord | null;
  readonly regenerabilityProof: RuntimeRegenerabilityProof | null;
  readonly candidate: PersistedCandidate | null;
  readonly diagnostic: RuntimeDiagnostic | null;
}

type PersistedAuditRun = Omit<
  AuditRunRecord,
  "controller" | "persistence" | "findings"
> & {
  readonly findings: readonly PersistedFinding[];
};

interface PersistedAuditEnvelope {
  readonly schemaVersion: 1;
  readonly keyId: string;
  readonly derivationVersion: number;
  readonly payload: PersistedAuditRun;
  readonly integrity: string;
}

const UnknownRuntimeSchema: RuntimeSchema<unknown> = {
  parse: (value) => value,
};

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return Object.keys(value).sort().join("\u0000") ===
    [...keys].sort().join("\u0000");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (plainRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function persistedCandidate(value: unknown): value is PersistedCandidate {
  return (
    plainRecord(value) &&
    hasExactKeys(value, [
      "ref",
      "path",
      "allowedRoot",
      "root",
      "kind",
      "fingerprint",
      "parentFingerprint",
    ]) &&
    typeof value.ref === "string" &&
    typeof value.path === "string" &&
    typeof value.allowedRoot === "string" &&
    typeof value.root === "string" &&
    typeof value.kind === "string" &&
    plainRecord(value.fingerprint) &&
    plainRecord(value.parentFingerprint)
  );
}

function persistedCorrelation(
  value: unknown,
): value is RuntimeCorrelationRecord {
  return (
    plainRecord(value) &&
    hasExactKeys(value, ["candidateSubjectId", "revision", "safeView"]) &&
    typeof value.candidateSubjectId === "string" &&
    CorrelationRevisionSchema.safeParse(value.revision).success &&
    SafeCorrelationViewSchema.safeParse(value.safeView).success
  );
}

function persistedFinding(value: unknown): value is PersistedFinding {
  if (
    !plainRecord(value) ||
    !hasExactKeys(value, [
      "model",
      "componentDisplayName",
      "observation",
      "evidence",
      "classification",
      "policy",
      "correlation",
      "regenerabilityProof",
      "candidate",
      "diagnostic",
    ])
  ) {
    return false;
  }
  if (!FindingModelViewSchema.safeParse(value.model).success) return false;
  if (!ModelSafeTextSchema.safeParse(value.componentDisplayName).success) {
    return false;
  }
  if (
    !plainRecord(value.observation) ||
    !plainRecord(value.evidence) ||
    !plainRecord(value.classification) ||
    !plainRecord(value.policy)
  ) {
    return false;
  }
  if (
    value.correlation !== null &&
    !persistedCorrelation(value.correlation)
  ) {
    return false;
  }
  if (
    value.candidate !== null &&
    !persistedCandidate(value.candidate)
  ) {
    return false;
  }
  return true;
}

function identityForFinding(input: Readonly<{
  classification: Classification;
  candidate: Pick<RuntimeCandidate, "kind" | "fingerprint">;
  targetIdentity: string;
}>): UserExclusionIdentity {
  return {
    ruleId:
      input.classification.ruleIds[0] ??
      "CLASSIFIER_V2_UNKNOWN_INCOMPLETE_EVIDENCE",
    artifactKind: input.candidate.kind,
    normalizedTargetIdentity: `target:v1:${sha256(input.targetIdentity)}`,
    bundleId: null,
    packageId: null,
    signingIdentity: null,
    ownerTypeFingerprint: `owner-type:v1:${sha256(
      `${input.candidate.fingerprint.uid}:${input.candidate.fingerprint.fileType}`,
    )}`,
  };
}

function hydratePersistedFinding(
  finding: PersistedFinding,
): FindingRecord {
  const candidate: RuntimeCandidate | null =
    finding.candidate === null
      ? null
      : {
          ...finding.candidate,
          protected: true,
          protectedScopeEvaluation: { complete: false, kinds: [] },
          regenerabilityProbe: {
            schemaVersion: 1,
            ruleId: CACHE_LOG_REGENERABILITY_RULE_ID,
            ruleVersion: CACHE_LOG_REGENERABILITY_RULE_VERSION,
            complete: false,
            regenerable: false,
            targetFingerprint: fingerprintDigest(
              finding.candidate.fingerprint,
            ),
          },
          pathValidation: {
            ok: false,
            errorCode: "PATH_ANCESTRY_INCOMPLETE",
          },
        };
  return {
    ...finding,
    candidate,
    identity:
      candidate === null
        ? null
        : identityForFinding({
            classification: finding.classification,
            candidate,
            targetIdentity:
              finding.correlation?.candidateSubjectId ??
              finding.evidence.targetIdentity,
          }),
  };
}

function parsePersistedAuditPayload(value: unknown): PersistedAuditRun {
  if (!plainRecord(value)) throw new TypeError("Invalid persisted audit");
  const state = value.state;
  if (
    (state !== "completed" && state !== "completed_with_warnings") ||
    typeof value.auditId !== "string" ||
    typeof value.requestId !== "string" ||
    !Number.isSafeInteger(value.stateVersion) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.progressPhase !== "string" ||
    !Number.isSafeInteger(value.completedSteps) ||
    !Number.isSafeInteger(value.totalSteps) ||
    !Number.isSafeInteger(value.processedCandidates) ||
    !Number.isSafeInteger(value.totalCandidates) ||
    !Array.isArray(value.coverageWarningCodes) ||
    !value.coverageWarningCodes.every((code) => typeof code === "string") ||
    !plainRecord(value.coverage) ||
    !Number.isSafeInteger(value.coverage.checkedSourceCount) ||
    !Number.isSafeInteger(value.coverage.skippedSourceCount) ||
    !Array.isArray(value.coverage.warnings) ||
    !value.coverage.warnings.every((warning) => typeof warning === "string") ||
    !Array.isArray(value.findings) ||
    !value.findings.every(persistedFinding) ||
    !Number.isSafeInteger(value.excludedCount)
  ) {
    throw new TypeError("Invalid persisted audit");
  }
  return value as unknown as PersistedAuditRun;
}

function parsePersistedAuditEnvelope(value: unknown): PersistedAuditEnvelope {
  if (
    !plainRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.keyId !== "string" ||
    !Number.isSafeInteger(value.derivationVersion) ||
    typeof value.integrity !== "string" ||
    !plainRecord(value.payload)
  ) {
    throw new TypeError("Invalid persisted audit envelope");
  }
  return value as unknown as PersistedAuditEnvelope;
}

export type PaginationChannel = "model" | "dashboard";

interface CursorBinding {
  readonly auditId: string;
  readonly revision: number;
  readonly channel: PaginationChannel;
  readonly filterKey: string;
  readonly offset: number;
}

export interface PaginationBinding {
  readonly auditId: string;
  readonly revision: number;
  readonly channel: PaginationChannel;
  readonly filterKey: string;
}

interface NormalizedAuditFilters {
  readonly categories: readonly string[] | undefined;
  readonly supportLevels: readonly string[] | undefined;
  readonly labels: readonly string[] | undefined;
  readonly risks: readonly string[] | undefined;
}

export function normalizeAuditFilters(
  filters: Readonly<{
    categories?: readonly string[] | undefined;
    supportLevels?: readonly string[] | undefined;
    labels?: readonly string[] | undefined;
    risks?: readonly string[] | undefined;
  }>,
): NormalizedAuditFilters {
  const normalize = (values: readonly string[] | undefined) =>
    values === undefined ? undefined : [...new Set(values)].sort();
  return {
    categories: normalize(filters.categories),
    supportLevels: normalize(filters.supportLevels),
    labels: normalize(filters.labels),
    risks: normalize(filters.risks),
  };
}

function matchesAuditFilters(
  finding: FindingModelView,
  filters: NormalizedAuditFilters,
): boolean {
  return (
    (filters.categories === undefined ||
      filters.categories.includes(finding.category)) &&
    (filters.supportLevels === undefined ||
      filters.supportLevels.includes(finding.supportLevel)) &&
    (filters.labels === undefined || filters.labels.includes(finding.label)) &&
    (filters.risks === undefined || filters.risks.includes(finding.risk))
  );
}

function summarizeFindings(
  all: readonly FindingRecord[],
  matching: readonly FindingRecord[],
) {
  return {
    totalCount: all.length,
    matchingCount: matching.length,
    supportLevelCounts: {
      candidate: matching.filter(
        (finding) => finding.model.supportLevel === "candidate",
      ).length,
      analysisOnly: matching.filter(
        (finding) => finding.model.supportLevel === "analysis_only",
      ).length,
      unsupportedManual: matching.filter(
        (finding) => finding.model.supportLevel === "unsupported_manual",
      ).length,
    },
  };
}

export class BoundedCursorPager {
  private readonly cursors = new Map<string, CursorBinding>();
  private readonly cursorByBinding = new Map<string, string>();

  constructor(
    private readonly createCursor: () => string = () =>
      `cursor-${randomUUID()}`,
  ) {}

  private bindingKey(binding: CursorBinding): string {
    return JSON.stringify([
      binding.auditId,
      binding.revision,
      binding.channel,
      binding.filterKey,
      binding.offset,
    ]);
  }

  private cursorFor(binding: CursorBinding): string {
    const bindingKey = this.bindingKey(binding);
    const existing = this.cursorByBinding.get(bindingKey);
    if (existing !== undefined) return existing;
    const cursor = this.createCursor();
    if (this.cursors.has(cursor)) {
      throw new Error("INTERNAL_ERROR");
    }
    this.cursors.set(cursor, binding);
    this.cursorByBinding.set(bindingKey, cursor);
    return cursor;
  }

  private offset(cursor: string | null, expected: PaginationBinding): number {
    if (cursor === null) return 0;
    const binding = this.cursors.get(cursor);
    if (
      binding === undefined ||
      binding.auditId !== expected.auditId ||
      binding.revision !== expected.revision ||
      binding.channel !== expected.channel ||
      binding.filterKey !== expected.filterKey
    ) {
      throw new Error("AUDIT_STALE");
    }
    return binding.offset;
  }

  page<TInput, TOutput>(
    input: Readonly<{
      items: readonly TInput[];
      cursor: string | null;
      binding: PaginationBinding;
      toOutput: (item: TInput) => TOutput;
    }>,
  ): { readonly findings: readonly TOutput[]; readonly nextCursor: string | null } {
    const offset = this.offset(input.cursor, input.binding);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > input.items.length
    ) {
      throw new Error("AUDIT_STALE");
    }
    const page: TOutput[] = [];
    let byteLength = 2;
    let index = offset;
    while (
      index < input.items.length &&
      page.length < DASHBOARD_PAGE_SIZE
    ) {
      const output = input.toOutput(input.items[index]!);
      const outputBytes = Buffer.byteLength(JSON.stringify(output), "utf8");
      const separatorBytes = page.length === 0 ? 0 : 1;
      if (byteLength + separatorBytes + outputBytes > DASHBOARD_PAGE_MAX_BYTES) {
        if (page.length === 0) {
          throw new Error("INTERNAL_ERROR");
        }
        break;
      }
      page.push(output);
      byteLength += separatorBytes + outputBytes;
      index += 1;
    }
    return {
      findings: page,
      nextCursor:
        index < input.items.length
          ? this.cursorFor({ ...input.binding, offset: index })
          : null,
    };
  }
}

export interface RuntimeExclusionStore {
  list(): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly KeyedUserExclusion[];
  }>;
  create(
    metadata: KeyedExclusionMetadata,
    identity: UserExclusionIdentity,
  ): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly KeyedUserExclusion[];
  }>;
  remove(exclusionId: string): Promise<{
    readonly stateVersion: number;
    readonly exclusions: readonly KeyedUserExclusion[];
  }>;
  reset(expectedStateVersion: number): ReturnType<KeyedExclusionStateStore["reset"]>;
  readForAudit(): Promise<
    | Readonly<{
        status: "ready";
        stateVersion: number;
        exclusions: readonly KeyedUserExclusion[];
      }>
    | Readonly<{
        status: "invalid";
        errorCode: string;
        tokenIssuance: "blocked";
      }>
  >;
  deriveIdentity(identity: UserExclusionIdentity): KeyedUserExclusionIdentity;
}

class PersistentRuntimeExclusionStore implements RuntimeExclusionStore {
  private readonly store: KeyedExclusionStateStore;

  constructor(
    stateRoot: string,
    private readonly installationKey: InstallationKey | null,
  ) {
    this.store = new KeyedExclusionStateStore({ stateRoot });
  }

  async list() {
    return this.store.list();
  }

  async create(
    metadata: KeyedExclusionMetadata,
    identity: UserExclusionIdentity,
  ) {
    await this.store.createFromIdentity(metadata, rawExclusionIdentity(identity));
    return this.store.list();
  }

  async remove(exclusionId: string) {
    return this.store.remove(exclusionId);
  }

  async reset(expectedStateVersion: number) {
    return this.store.reset(expectedStateVersion);
  }

  async readForAudit() {
    if (this.installationKey === null) {
      return {
        status: "invalid" as const,
        errorCode: "CORRELATION_SCHEMA_UNSUPPORTED",
        tokenIssuance: "blocked" as const,
      };
    }
    return this.store.readForAudit();
  }

  deriveIdentity(identity: UserExclusionIdentity): KeyedUserExclusionIdentity {
    if (this.installationKey === null) {
      throw new Error("EXCLUSION_STATE_INVALID");
    }
    const exclusion = deriveKeyedUserExclusion(
      this.installationKey,
      {
        exclusionId: "exclusion-identity-probe",
        ruleId: identity.ruleId,
        artifactKind: identity.artifactKind,
        createdAt: "1970-01-01T00:00:00.000Z",
        reasonCategory: "other",
      },
      rawExclusionIdentity(identity),
    );
    return {
      ruleId: exclusion.ruleId,
      artifactKind: exclusion.artifactKind,
      keyId: exclusion.keyId,
      derivationVersion: exclusion.derivationVersion,
      subjectDigest: exclusion.subjectDigest,
      claimDigests: exclusion.claimDigests,
    };
  }
}

export interface RuntimeServiceOptions {
  readonly homeDirectory?: string;
  readonly stateRoot?: string;
  readonly currentProjectRoot?: string;
  readonly now?: () => Date;
  readonly createId?: (prefix: string) => string;
  /** Deterministic tests могут переопределить bounded concurrency; packaged runtime использует 8. */
  readonly candidateConcurrency?: number;
  /**
   * Низкоуровневые production boundaries для in-process проверки composition.
   * Они не доступны через MCP, env или plugin manifest; packaged runtime всегда
   * использует concrete Node/macOS implementations и package-owned state.
   */
  readonly correlation?: Readonly<{
    readonly commands?: CommandRunner;
    /** Test-only override; packaged runtime ограничивает каждую команду 30 секундами. */
    readonly commandTimeoutMs?: number;
    readonly filesystem?: MacOSCorrelationReadOnlyFileSystem;
    readonly ownerBindingHistory?: MacOSOwnerBindingHistory;
    readonly installationKey?: InstallationKey;
  }>;
  /** Test-only root override; packaged runtime inspects the real /Library read-only. */
  readonly diagnostics?: Readonly<{
    readonly systemLibraryRoot?: string;
    readonly enableProcessInspection?: boolean;
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
  private readonly pager: BoundedCursorPager;
  private latestAuditId: string | null = null;
  private latestCompletedAuditId: string | null = null;
  private executionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filesystem: RuntimeFileSystemFacade,
    private readonly exclusions: RuntimeExclusionStore,
    private readonly stateRoot: string,
    private readonly homeDirectory: string,
    private readonly installationKey: InstallationKey,
    private readonly correlationCommands: CommandRunner,
    private readonly commandTimeoutMs: number,
    private readonly correlationFilesystem: MacOSCorrelationReadOnlyFileSystem | undefined,
    private readonly ownerBindingHistory: MacOSOwnerBindingHistory | undefined,
    private readonly candidateConcurrency: number,
    private readonly now: () => Date,
    private readonly createId: (prefix: string) => string,
  ) {
    this.pager = new BoundedCursorPager(() => this.createId("cursor"));
  }

  private persistedPayload(run: AuditRunRecord): PersistedAuditRun {
    const {
      controller: _controller,
      persistence: _persistence,
      findings,
      ...payload
    } = run;
    return JSON.parse(
      JSON.stringify({
        ...payload,
        findings: findings.map((finding): PersistedFinding => ({
          model: finding.model,
          componentDisplayName: finding.componentDisplayName,
          observation: finding.observation,
          evidence: finding.evidence,
          classification: finding.classification,
          policy: finding.policy,
          correlation:
            finding.correlation === null
              ? null
              : {
                  candidateSubjectId:
                    finding.correlation.candidateSubjectId,
                  revision: finding.correlation.revision,
                  safeView: finding.correlation.safeView,
                },
          regenerabilityProof: finding.regenerabilityProof,
          candidate:
            finding.candidate === null
              ? null
              : {
                  ref: finding.candidate.ref,
                  path: finding.candidate.path,
                  allowedRoot: finding.candidate.allowedRoot,
                  root: finding.candidate.root,
                  kind: finding.candidate.kind,
                  fingerprint: finding.candidate.fingerprint,
                  parentFingerprint:
                    finding.candidate.parentFingerprint,
                },
          diagnostic: finding.diagnostic,
        })),
      }),
    ) as PersistedAuditRun;
  }

  private async persistLatest(run: AuditRunRecord): Promise<void> {
    const payload = this.persistedPayload(run);
    const envelope: PersistedAuditEnvelope = {
      schemaVersion: 1,
      keyId: this.installationKey.keyId,
      derivationVersion: this.installationKey.derivationVersion,
      payload,
      integrity: this.installationKey.derive(
        "cmc:audit-snapshot:integrity:v1",
        "payload",
        stableJson(payload),
      ),
    };
    await new JsonStore(this.stateRoot).writeJsonAtomic(
      LATEST_AUDIT_STATE_PATH,
      envelope,
    );
  }

  async restoreLatest(): Promise<boolean> {
    try {
      const raw = await new JsonStore(this.stateRoot).readJson(
        LATEST_AUDIT_STATE_PATH,
        UnknownRuntimeSchema,
      );
      const envelope = parsePersistedAuditEnvelope(raw);
      if (
        envelope.keyId !== this.installationKey.keyId ||
        envelope.derivationVersion !== this.installationKey.derivationVersion
      ) {
        return false;
      }
      const expected = this.installationKey.derive(
        "cmc:audit-snapshot:integrity:v1",
        "payload",
        stableJson(envelope.payload),
      );
      const actualBuffer = Buffer.from(envelope.integrity, "utf8");
      const expectedBuffer = Buffer.from(expected, "utf8");
      if (
        actualBuffer.byteLength !== expectedBuffer.byteLength ||
        !timingSafeEqual(actualBuffer, expectedBuffer)
      ) {
        return false;
      }
      const payload = parsePersistedAuditPayload(envelope.payload);
      const allowedRoots = new Set(
        ALLOWLISTED_LIBRARY_ROOTS.map((root) =>
          join(this.homeDirectory, "Library", root),
        ),
      );
      for (const finding of payload.findings) {
        const candidate = finding.candidate;
        if (
          candidate !== null &&
          (!allowedRoots.has(candidate.allowedRoot) ||
            dirname(candidate.path) !== candidate.allowedRoot)
        ) {
          return false;
        }
      }
      const run: AuditRunRecord = {
        ...payload,
        findings: payload.findings.map(hydratePersistedFinding),
        controller: new AbortController(),
        persistence: null,
      };
      this.runs.set(run.auditId, run);
      this.auditIdByRequest.set(run.requestId, run.auditId);
      this.latestAuditId = run.auditId;
      this.latestCompletedAuditId = run.auditId;
      return true;
    } catch {
      return false;
    }
  }

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

  private dashboardRun(
    auditId: string | null,
    revision: number | null,
  ): AuditRunRecord {
    if (auditId === null) {
      if (revision !== null || this.latestCompletedAuditId === null) {
        throw new Error("AUDIT_STALE");
      }
      return this.completedRun(
        this.latestCompletedAuditId,
        this.runFor(this.latestCompletedAuditId).revision ?? -1,
      );
    }
    return revision === null
      ? this.runFor(auditId)
      : this.completedRun(auditId, revision);
  }

  private dashboardFinding(finding: FindingRecord) {
    const safe = finding.correlation?.safeView;
    const facts = safe?.facts;
    const diagnostic = finding.diagnostic;
    const receiptState =
      safe?.receiptLifecycle.lifecycle === "live" ||
      safe?.receiptLifecycle.lifecycle === "stale"
        ? "present"
        : safe?.receiptLifecycle.lifecycle === "absent"
          ? "absent"
          : "unknown";
    return {
      findingId: finding.model.findingId,
      displayName: finding.model.displayName,
      componentDisplayName: finding.componentDisplayName,
      category: finding.model.category,
      supportLevel: finding.model.supportLevel,
      logicalSize: finding.model.logicalSize,
      physicalSize: finding.model.physicalSize,
      label: finding.model.label,
      confidence: finding.model.confidence,
      risk: finding.model.risk,
      allowedActions: finding.model.allowedActions,
      correlationRevisionId: safe?.correlationRevisionId ?? null,
      ownerBindingState: safe?.ownerBindingState ?? "missing",
      ownerBindingSourceClass: safe?.ownerBindingSourceClass ?? "none",
      requirementProfileId:
        safe?.requirementProfileId ?? "inspection_only_v1",
      requirementApplicability: safe?.requirementApplicability ?? null,
      receiptLifecycle: safe?.receiptLifecycle ?? null,
      facts: facts ?? null,
      coverageSummary:
        safe?.coverageSummary ??
        (diagnostic === null
          ? {
              completeSourceCount: 0,
              gapCount: 1,
              gapCodes: ["missing" as const],
            }
          : {
              completeSourceCount: 1,
              gapCount: 0,
              gapCodes: [],
            }),
      staleDuringAudit: safe?.staleDuringAudit ?? diagnostic === null,
      blockingReasonCodes:
        safe?.blockingReasonCodes ?? finding.policy.blockingRuleIds,
      findingFacts: {
        lastObservedAt: finding.observation.observedAt,
        temporalKind: finding.evidence.stale ? "stale" : "current",
        mainBundleState: facts?.ownerApplication.state ?? "unknown",
        activityState:
          facts?.activity.state ?? diagnostic?.activityState ?? "unknown",
        openFileState: facts?.openFile.state ?? "unknown",
        startupKinds:
          diagnostic !== null && diagnostic.startupKind !== null
            ? [diagnostic.startupKind]
            : facts?.startupTarget.state === "present"
              ? ["unknown"]
              : [],
        targetExecutableState:
          diagnostic?.targetExecutableState ??
          facts?.ownerExecutable.state ??
          "unknown",
        receiptState,
        dependencyState: facts?.dependency.state ?? "unknown",
        sensitivityFlags: finding.observation.sensitivityFlags,
        recommendedRemovalMethod: finding.evidence.recommendedRemovalMethod,
        blockingReasons: finding.model.blockingReasons,
      },
      reclaimEstimate: {
        estimatedPhysicalBytes: finding.model.physicalSize,
        confidence: "low" as const,
        basis: "observed_physical_size" as const,
        limitations: ["snapshot_estimate" as const],
        observedAt: finding.observation.observedAt,
      },
      evidence:
        diagnostic === null
          ? []
          : finding.evidence.items.map((item) => ({
              evidenceId: item.evidenceId,
              ruleInputType: item.ruleInputType,
              sourceAdapter: item.sourceAdapter,
              outcome: item.outcome,
              observedAt: item.observedAt,
              summary: item.summary,
            })),
      blockingReasons: finding.model.blockingReasons,
    };
  }

  private progress(run: AuditRunRecord) {
    return {
      phase: run.progressPhase,
      completedSteps: run.completedSteps,
      totalSteps: run.totalSteps,
      processedCandidates: run.processedCandidates,
      totalCandidates: run.totalCandidates,
    };
  }

  private async exclusionSnapshot(): Promise<{
    readonly invalid: boolean;
    readonly exclusions: readonly KeyedUserExclusion[];
    readonly stateVersion: number;
  }> {
    const state = await this.exclusions.readForAudit();
    if (state.status === "invalid") {
      return { invalid: true, exclusions: [], stateVersion: 0 };
    }
    return {
      invalid: false,
      exclusions: state.exclusions,
      stateVersion: state.stateVersion,
    };
  }

  private exclusionMatch(
    exclusions: readonly KeyedUserExclusion[],
    identity: UserExclusionIdentity,
  ) {
    return matchKeyedUserExclusions(
      exclusions,
      this.exclusions.deriveIdentity(identity),
    );
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
      commandTimeoutMs: this.commandTimeoutMs,
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
      exclusions: readonly KeyedUserExclusion[];
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
    const identity = identityForFinding({
      classification,
      candidate,
      targetIdentity:
        correlation?.candidateSubjectId ?? evidence.targetIdentity,
    });
    const exclusionMatch = exclusionState.invalid
      ? { status: "invalid" as const }
      : this.exclusionMatch(exclusionState.exclusions, identity);
    const matchedExclusion =
      exclusionMatch.status === "matched"
        ? exclusionState.exclusions.find(
            (exclusion) => exclusion.exclusionId === exclusionMatch.exclusionId,
          )
        : undefined;
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
      componentDisplayName: safeWidgetComponentDisplayName(
        candidate.path,
        model.displayName,
      ),
      observation,
      evidence,
      classification,
      policy,
      correlation,
      regenerabilityProof,
      candidate,
      identity,
      diagnostic: null,
    };
  }

  private buildDiagnosticFinding(
    observation: Observation,
    auditId: string,
  ): FindingRecord | null {
    const diagnostic = this.filesystem.diagnostic(observation.targetRef);
    if (diagnostic === undefined) return null;
    const evidence = normalizeEvidence([observation], [])[0]!;
    const classification = classifyEvidence(evidence);
    const fingerprintHash = sha256(observation.fingerprint);
    const timestampNs = String(
      Math.max(0, Date.parse(observation.observedAt)) * 1_000_000,
    );
    const fingerprint: SnapshotFingerprint = {
      device: "diagnostic",
      inode: fingerprintHash.slice(0, 16),
      mode: 0,
      uid: 0,
      gid: 0,
      size: observation.logicalSize,
      mtimeNs: timestampNs,
      ctimeNs: timestampNs,
      fileType: "plist",
      mountId: "diagnostic",
      symbolicLink: false,
      linkCount: 1,
    };
    const evaluated = evaluatePolicy({
      classification,
      evidenceSet: evidence,
      supportLevel: observation.supportLevel,
      category: diagnostic.category,
      sensitivityFlags: observation.sensitivityFlags,
      protectedScopeKinds:
        observation.supportLevel === "unsupported_manual"
          ? ["system_scope"]
          : [],
      exclusionMatch: { status: "none" },
      officialUninstallerApplicable: false,
      snapshotFingerprint: fingerprint,
      currentFingerprint: fingerprint,
      pathValidation: { ok: false, errorCode: "PATH_OUTSIDE_ALLOWLIST" },
    });
    const policy: PolicyDecision = {
      ...evaluated,
      allowedActions: evaluated.allowedActions.filter(
        (action) => action === "inspect",
      ),
    };
    const model: FindingModelView = {
      findingId: this.findingId(auditId, observation.targetRef),
      displayName: observation.displayName,
      category: diagnostic.category,
      supportLevel: observation.supportLevel,
      logicalSize: observation.logicalSize,
      physicalSize: observation.physicalSize,
      label: classification.label,
      confidence: classification.confidence,
      risk: observation.supportLevel === "unsupported_manual" ? "high" : "medium",
      allowedActions: [...policy.allowedActions],
      safeMetadata: {
        format: diagnostic.category === "autostart" ? "plist" : "unknown",
        parseStatus: "parsed",
        byteLength: observation.logicalSize,
        modifiedAt: observation.observedAt,
        sensitivityFlags: [...observation.sensitivityFlags],
      },
      blockingReasons: [...policy.blockingRuleIds],
    };
    return {
      model,
      componentDisplayName: diagnostic.componentDisplayName,
      observation,
      evidence,
      classification,
      policy,
      correlation: null,
      regenerabilityProof: null,
      candidate: null,
      identity: null,
      diagnostic,
    };
  }

  private async execute(run: AuditRunRecord): Promise<void> {
    if (run.controller.signal.aborted) {
      run.state = "cancelled";
      run.progressPhase = "cancelled";
      run.stateVersion += 1;
      return;
    }
    run.state = "running";
    run.progressPhase = "discovering_candidates";
    run.stateVersion += 1;
    this.filesystem.clear();
    try {
      const result = await runAdapters(
        [
          createLibraryRootsAdapter(this.filesystem),
          createAutostartAdapter(this.filesystem),
          createInspectionOnlyAdapter(this.filesystem),
          createOrphanedProcessAdapter(this.filesystem),
        ],
        { signal: run.controller.signal },
      );
      // Coordinator может завершиться состоянием cancelled без исключения.
      // Повторно проверяем общий signal, чтобы явная отмена всегда проходила
      // через единый terminal state без публикации частичной revision.
      run.controller.signal.throwIfAborted();
      run.coverageWarningCodes = result.coverage.gaps.map((gap) => gap.errorCode);
      run.coverage = {
        checkedSourceCount: result.coverage.checkedSourceCount,
        skippedSourceCount: result.coverage.skippedSourceCount,
        warnings: result.coverage.gaps.map((gap) => gap.safeMessage),
      };
      run.totalCandidates = result.observations.length;
      run.totalSteps = result.observations.length + 2;
      run.completedSteps = 1;
      run.progressPhase =
        result.observations.length === 0
          ? "finalizing"
          : "collecting_global_evidence";
      run.stateVersion += 1;
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
      const recordCandidateProgress = () => {
        run.processedCandidates += 1;
        run.completedSteps = 1 + run.processedCandidates;
        run.progressPhase =
          run.processedCandidates < run.totalCandidates
            ? "correlating_candidates"
            : "finalizing";
        run.stateVersion += 1;
      };
      const outcomes = await mapConcurrentOrdered(
        result.observations,
        this.candidateConcurrency,
        async (observation) => {
          run.controller.signal.throwIfAborted();
          const candidate = this.filesystem.candidate(observation.targetRef);
          if (candidate === undefined) {
            const finding = this.buildDiagnosticFinding(
              observation,
              run.auditId,
            );
            recordCandidateProgress();
            return {
              finding,
              excluded: false,
              warningCodes:
                finding === null
                  ? ["CORRELATION_COVERAGE_INCOMPLETE"]
                  : [],
            } as const;
          }
          let correlation: CorrelationResolverResult | null = null;
          const warningCodes: string[] = [];
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
              warningCodes.push("CORRELATION_COVERAGE_INCOMPLETE");
            }
            if (correlation.safeView.ownerBindingState === "ambiguous") {
              warningCodes.push("CORRELATION_AMBIGUOUS");
            } else if (correlation.safeView.ownerBindingState === "mismatch") {
              warningCodes.push("CORRELATION_MISMATCH");
            }
            if (correlation.safeView.staleDuringAudit) {
              warningCodes.push("CORRELATION_SNAPSHOT_STALE");
            }
          } catch {
            run.controller.signal.throwIfAborted();
            warningCodes.push("CORRELATION_COVERAGE_INCOMPLETE");
          }
          const finding = this.buildFinding(
            observation,
            candidate,
            correlation,
            run.auditId,
            exclusionState,
          );
          const excluded =
            !exclusionState.invalid &&
            finding.identity !== null &&
            this.exclusionMatch(
              exclusionState.exclusions,
              finding.identity,
            ).status === "matched";
          recordCandidateProgress();
          return { finding, excluded, warningCodes } as const;
        },
      );
      const correlationWarningCodes = new Set(
        outcomes.flatMap(({ warningCodes }) => warningCodes),
      );
      run.findings = outcomes.flatMap(({ finding, excluded }) =>
        finding === null || excluded ? [] : [finding],
      );
      run.excludedCount = outcomes.filter(({ excluded }) => excluded).length;
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
      run.controller.signal.throwIfAborted();
      run.state =
        result.state === "completed" && run.coverageWarningCodes.length > 0
          ? "completed_with_warnings"
          : result.state;
      run.revision =
        result.state === "completed" || result.state === "completed_with_warnings" ? 1 : null;
      run.completedSteps = run.totalSteps;
      run.progressPhase = "completed";
    } catch (error) {
      if (run.controller.signal.aborted) {
        run.state = "cancelled";
        run.progressPhase = "cancelled";
      } else {
        run.state = "failed";
        run.progressPhase = "failed";
        run.coverageWarningCodes = ["INTERNAL_ERROR"];
      }
    } finally {
      run.stateVersion += 1;
      if (
        run.state === "completed" ||
        run.state === "completed_with_warnings"
      ) {
        this.latestCompletedAuditId = run.auditId;
        run.persistence = this.persistLatest(run).catch(() => {
          run.state = "completed_with_warnings";
          run.coverageWarningCodes = [
            ...new Set([...run.coverageWarningCodes, "INTERNAL_ERROR"]),
          ];
          run.coverage = {
            ...run.coverage,
            warnings: [
              ...run.coverage.warnings,
              "Последний результат не удалось сохранить для следующей задачи.",
            ],
          };
          run.stateVersion += 1;
        });
        await run.persistence;
      }
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
      progressPhase: "queued",
      completedSteps: 0,
      totalSteps: 2,
      processedCandidates: 0,
      totalCandidates: 0,
      coverageWarningCodes: [],
      coverage: { checkedSourceCount: 0, skippedSourceCount: 0, warnings: [] },
      findings: [],
      excludedCount: 0,
      persistence: null,
    };
    this.runs.set(auditId, run);
    this.auditIdByRequest.set(input.requestId, auditId);
    this.latestAuditId = auditId;
    queueMicrotask(() => {
      const execution = this.executionQueue.then(() => this.execute(run));
      this.executionQueue = execution.catch(() => undefined);
    });
    return { auditId, state: "queued" as const, stateVersion: 0 };
  }

  async status(rawInput: unknown) {
    const input = AuditStatusInputSchema.parse(rawInput);
    const run = this.runFor(input.auditId);
    if (run.persistence !== null) {
      await run.persistence;
    }
    return {
      auditId: run.auditId,
      state: run.state,
      stateVersion: run.stateVersion,
      revision: run.revision,
      progress: this.progress(run),
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
    const exclusionState = await this.exclusionSnapshot();
    const storageSummary = await this.storageSummaryForRun(run);
    const diskObservation = await observeDisk(this.stateRoot);
    return {
      storageSummary,
      diskObservation,
      excludedCount: run.excludedCount,
      stateVersion: Math.max(
        run.stateVersion,
        storageSummary.stateVersion,
        exclusionState.stateVersion,
      ),
    };
  }

  async results(rawInput: unknown) {
    const input = AuditResultsInputSchema.parse(rawInput);
    const run = this.completedRun(input.auditId, input.revision);
    const safe = await this.safeSnapshot(run);
    const filters = normalizeAuditFilters(input.filters);
    const filterKey = JSON.stringify(filters);
    const matching = run.findings.filter((finding) =>
      matchesAuditFilters(finding.model, filters),
    );
    const cursorBinding = {
      auditId: run.auditId,
      revision: input.revision,
      channel: "model" as const,
      filterKey,
    };
    const page = this.pager.page({
      items: matching,
      cursor: input.cursor,
      binding: cursorBinding,
      toOutput: (finding) => finding.model,
    });
    return {
      auditId: run.auditId,
      revision: input.revision,
      stateVersion: safe.stateVersion,
      storageSummary: safe.storageSummary,
      diskObservation: safe.diskObservation,
      excludedCount: safe.excludedCount,
      findingSummary: summarizeFindings(run.findings, matching),
      findings: page.findings,
      nextCursor: page.nextCursor,
    };
  }

  async dashboardPage(rawInput: unknown) {
    const input = DashboardPageInputSchema.parse(rawInput);
    const run = this.completedRun(input.auditId, input.revision);
    const filters = normalizeAuditFilters(input.filters);
    const filterKey = JSON.stringify(filters);
    const matching = run.findings.filter((finding) =>
      matchesAuditFilters(finding.model, filters),
    );
    const cursorBinding = {
      auditId: run.auditId,
      revision: input.revision,
      channel: "dashboard" as const,
      filterKey,
    };
    const page = this.pager.page({
      items: matching,
      cursor: input.cursor,
      binding: cursorBinding,
      toOutput: (finding) => this.dashboardFinding(finding),
    });
    const safe = await this.safeSnapshot(run);
    return {
      auditId: run.auditId,
      revision: input.revision,
      stateVersion: safe.stateVersion,
      findingSummary: summarizeFindings(run.findings, matching),
      findings: page.findings,
      nextCursor: page.nextCursor,
    };
  }

  async dashboard(rawInput: unknown) {
    const input = DashboardOpenInputSchema.parse(rawInput);
    const run = this.dashboardRun(input.auditId, input.revision);
    const resolvedRevision =
      input.auditId === null ? run.revision : input.revision;
    const actionable =
      resolvedRevision !== null &&
      run.revision !== null &&
      (run.state === "completed" || run.state === "completed_with_warnings");
    const results = actionable
      ? await this.results({
          auditId: run.auditId,
          revision: run.revision,
          cursor: null,
          filters: {},
        })
      : {
          auditId: run.auditId,
          revision: null,
          ...(await this.safeSnapshot(run)),
          findingSummary: summarizeFindings([], []),
          findings: [] as FindingModelView[],
          nextCursor: null,
        };
    run.stateVersion = Math.max(run.stateVersion, results.stateVersion);
    const dashboardFilters = normalizeAuditFilters({});
    const dashboardFilterKey = JSON.stringify(dashboardFilters);
    const dashboardPage =
      actionable && run.revision !== null
        ? this.pager.page({
            items: run.findings,
            cursor: null,
            toOutput: (finding) => this.dashboardFinding(finding),
            binding: {
              auditId: run.auditId,
              revision: run.revision,
              channel: "dashboard",
              filterKey: dashboardFilterKey,
            },
          })
        : { findings: [], nextCursor: null };
    const output = {
      auditId: results.auditId,
      revision: results.revision,
      state: run.state,
      stateVersion: results.stateVersion,
      resourceUri: DASHBOARD_RESOURCE_URI,
      storageSummary: results.storageSummary,
      diskObservation: results.diskObservation,
      excludedCount: results.excludedCount,
      findingSummary: results.findingSummary,
      findings: results.findings,
      nextCursor: results.nextCursor,
    };
    const manifests = await new ManifestRepository(this.stateRoot).list();
    const dashboard = {
      auditId: run.auditId,
      revision: results.revision,
      state: run.state,
      stateVersion: output.stateVersion,
      progress: this.progress(run),
      coverage: run.coverage,
      storageSummary: output.storageSummary,
      diskObservation: output.diskObservation,
      excludedCount: output.excludedCount,
      findingSummary: output.findingSummary,
      findings: dashboardPage.findings,
      nextCursor: dashboardPage.nextCursor,
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

  private async storageSummaryForRun(
    run: AuditRunRecord | undefined,
  ): Promise<StorageSummary> {
    const candidateLogicalBytes = run?.findings.reduce(
      (total, finding) =>
        total + (finding.candidate === null ? 0 : finding.model.logicalSize),
      0,
    ) ?? 0;
    const candidatePhysicalBytes = run?.findings.reduce(
      (total, finding) =>
        total + (finding.candidate === null ? 0 : finding.model.physicalSize),
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

  async storageSummary(): Promise<StorageSummary> {
    const selectedAuditId =
      this.latestCompletedAuditId ?? this.latestAuditId;
    const run =
      selectedAuditId === null
        ? undefined
        : this.runs.get(selectedAuditId);
    return this.storageSummaryForRun(run);
  }

  async storageSummaryForAudit(
    auditId: string,
    auditRevision: number,
  ): Promise<StorageSummary> {
    return this.storageSummaryForRun(
      this.completedRun(auditId, auditRevision),
    );
  }

  moveSubject(findingId: string, revision: number): MoveSubject {
    const { finding, run } = this.findingWithRun(findingId, revision);
    const candidate = finding.candidate;
    if (candidate === null) throw new Error("AUDIT_STALE");
    return {
      auditId: run.auditId,
      auditRevision: revision,
      findingId,
      sourcePath: candidate.path,
      allowedRoot: candidate.allowedRoot,
      sourceFingerprint: candidate.fingerprint,
      sourceParentFingerprint: candidate.parentFingerprint,
      artifactKind: candidate.kind,
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
    const candidate = finding.candidate;
    if (candidate === null) throw new Error("AUDIT_STALE");
    const currentPath = await this.filesystem.revalidateCandidate(candidate);
    const exclusionState = await this.exclusionSnapshot();
    let currentFinding: FindingRecord | null = null;
    try {
      const adapter = this.correlationAdapter(
        new Map([[finding.observation.targetRef, candidate.path]]),
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
                : currentFinding.identity !== null
                  ? this.exclusionMatch(
                      exclusionState.exclusions,
                      currentFinding.identity,
                    )
                  : { status: "none" },
              officialUninstallerApplicable:
                currentCorrelation?.safeView.facts.officialUninstaller.state ===
                "present",
              snapshotFingerprint: candidate.fingerprint,
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
  const candidateConcurrency =
    options.candidateConcurrency ?? DEFAULT_CANDIDATE_CONCURRENCY;
  if (!Number.isSafeInteger(candidateConcurrency) || candidateConcurrency < 1) {
    throw new Error("RUNTIME_CONFIGURATION_INVALID");
  }
  const requestedHomeDirectory = resolve(options.homeDirectory ?? homedir());
  const homeDirectory = await realpath(requestedHomeDirectory);
  const requestedStateRoot = resolve(
    options.stateRoot ?? defaultStateRoot(homeDirectory),
  );
  await new JsonStore(requestedStateRoot).ensureDirectory(".");
  const stateRoot = await realpath(requestedStateRoot);
  const exclusionStateRoot = join(stateRoot, "exclusions");
  const exclusionInstallationKey = await new InstallationKeyStore({
    stateRoot: exclusionStateRoot,
  }).loadOrCreate().catch(() => null);
  const exclusionStore = new PersistentRuntimeExclusionStore(
    exclusionStateRoot,
    exclusionInstallationKey,
  );
  const installationKey = await new InstallationKeyStore({ stateRoot })
    .loadOrCreate();
  const requestedCurrentProjectRoot = resolve(
    options.currentProjectRoot ?? process.cwd(),
  );
  const currentProjectRoot = await realpath(requestedCurrentProjectRoot);
  const correlationCommands =
    options.correlation?.commands ?? createNodeCommandRunner();
  const commandTimeoutMs =
    options.correlation?.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const discoveryCommands = createCommandTimeoutRunner(
    correlationCommands,
    commandTimeoutMs,
  );
  const realRuntimeHome = homeDirectory === resolve(homedir());
  const systemLibraryRoot = resolve(
    options.diagnostics?.systemLibraryRoot ??
      (realRuntimeHome
        ? "/Library"
        : join(homeDirectory, ".cmc-system-library-unavailable")),
  );
  const filesystem = new RuntimeFileSystemFacade(
    homeDirectory,
    stateRoot,
    currentProjectRoot,
    discoveryCommands,
    systemLibraryRoot,
    options.diagnostics?.enableProcessInspection ?? realRuntimeHome,
  );
  const auditService = new AuditRuntimeService(
    filesystem,
    exclusionStore,
    stateRoot,
    homeDirectory,
    options.correlation?.installationKey ?? installationKey,
    correlationCommands,
    commandTimeoutMs,
    options.correlation?.filesystem,
    options.correlation?.ownerBindingHistory,
    candidateConcurrency,
    options.now ?? (() => new Date()),
    options.createId ?? ((prefix) => `${prefix}-${randomUUID()}`),
  );
  await auditService.restoreLatest();
  return {
    auditService,
    exclusionStore,
    async createQuarantineService(exclusions) {
      const manifests = new ManifestRepository(stateRoot);
      const controller = new QuarantineController({
        storeRoot: stateRoot,
        candidateStorage: async (binding) => {
          let summary: StorageSummary;
          try {
            summary =
              binding === undefined
                ? await auditService.storageSummary()
                : await auditService.storageSummaryForAudit(
                    binding.auditId,
                    binding.auditRevision,
                  );
          } catch {
            summary = await auditService.storageSummary();
          }
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

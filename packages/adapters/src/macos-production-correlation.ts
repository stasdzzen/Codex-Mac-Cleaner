import { createHash } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  InstallationKey,
  InstallationKeyStore,
  KeyedOwnerBindingHistoryStore,
  type KeyedOwnerBindingHistoryRecord,
} from "@codex-mac-cleaner/storage";

import {
  createCommandTimeoutRunner,
  type CommandRunner,
} from "./command-runner.js";
import {
  CorrelationInputError,
  type CorrelationArtifactCategory,
  type EphemeralCorrelationInput,
  type RawIdentityClaim,
  type RawQueryState,
} from "./correlation-claims.js";
import {
  buildProductionCorrelationInput,
  type ProductionCandidateCapture,
  type ProductionCandidateIdentityRecord,
  type ProductionCorrelationAdapter,
  type ProductionCorrelationCommandBoundary,
  type ProductionCorrelationFilesystemBoundary,
  type ProductionCorrelationSnapshotRecord,
  type ProductionDependencyRecord,
  type ProductionHistoricalBindingRecord,
  type ProductionInstalledAppRecord,
  type ProductionOfficialUninstallerRecord,
  type ProductionOpenFileRecord,
  type ProductionOwnerBindingRecord,
  type ProductionOwnerExecutableRecord,
  type ProductionProcessRecord,
  type ProductionReceiptRecord,
  type ProductionSourceCapture,
  type ProductionStartupTargetRecord,
} from "./production-correlation.js";
import { isAbortError } from "./types.js";

const MAX_SOURCE_RECORDS = 4_096;
const MAX_COMMAND_CONCURRENCY = 4;
const APP_ROOTS = ["/Applications", "/System/Applications"] as const;
const PRIVATE_ACTIONABLE_CATEGORIES = new Set<CorrelationArtifactCategory>(["cache", "log"]);

export interface MacOSCorrelationFileStat {
  readonly device: string;
  readonly inode: string;
  readonly fileType: "file" | "directory" | "bundle";
  readonly uid: number;
  readonly gid: number;
  readonly size: number;
  readonly modifiedAtMs: number;
}

export interface MacOSCorrelationDirectoryEntry {
  readonly path: string;
  readonly fileType: "file" | "directory" | "bundle";
}

/** Низкоуровневый read-only порт. Он не возвращает identity/correlation records. */
export interface MacOSCorrelationReadOnlyFileSystem {
  canonicalize(path: string, signal: AbortSignal): Promise<string>;
  stat(path: string, signal: AbortSignal): Promise<MacOSCorrelationFileStat>;
  readDirectory(path: string, signal: AbortSignal): Promise<readonly MacOSCorrelationDirectoryEntry[]>;
}

export interface MacOSCandidateLocation {
  readonly candidatePath: string;
  readonly userHome: string;
}

/** Registry связывает opaque ref с local path; parsing и claim mapping принадлежат adapters. */
export interface MacOSCandidateRegistry {
  resolve(candidateRef: string, signal: AbortSignal): Promise<MacOSCandidateLocation | null>;
}

export function createMacOSCandidateRegistry(input: Readonly<{
  candidates: ReadonlyMap<string, string>;
  userHome: string;
}>): MacOSCandidateRegistry {
  const candidates = new Map(input.candidates);
  return Object.freeze({
    async resolve(candidateRef: string, signal: AbortSignal) {
      signal.throwIfAborted();
      const candidatePath = candidates.get(candidateRef);
      return candidatePath === undefined ? null : { candidatePath, userHome: input.userHome };
    },
  });
}

export function createNodeMacOSCorrelationReadOnlyFileSystem(): MacOSCorrelationReadOnlyFileSystem {
  const filesystem: MacOSCorrelationReadOnlyFileSystem = {
    async canonicalize(path, signal) {
      signal.throwIfAborted();
      return realpath(path);
    },
    async stat(path, signal) {
      signal.throwIfAborted();
      const value = await lstat(path);
      return {
        device: String(value.dev),
        inode: String(value.ino),
        fileType: value.isDirectory() ? path.endsWith(".app") ? "bundle" : "directory" : "file",
        uid: value.uid,
        gid: value.gid,
        size: value.size,
        modifiedAtMs: value.mtimeMs,
      };
    },
    async readDirectory(path, signal) {
      signal.throwIfAborted();
      return (await readdir(path, { withFileTypes: true })).map((entry) => ({
        path: join(path, entry.name),
        fileType: entry.isDirectory() ? entry.name.endsWith(".app") ? "bundle" : "directory" : "file",
      }));
    },
  };
  return Object.freeze(filesystem);
}

export interface MacOSOwnerBindingHistory {
  list(): Promise<readonly KeyedOwnerBindingHistoryRecord[]>;
  replace(records: readonly KeyedOwnerBindingHistoryRecord[]): Promise<void>;
}

export interface CreateMacOSProductionCorrelationAdapterInput {
  readonly commands: CommandRunner;
  readonly candidates: MacOSCandidateRegistry;
  readonly filesystem?: MacOSCorrelationReadOnlyFileSystem;
  readonly now?: () => string;
  readonly commandTimeoutMs?: number;
  /** Package-owned concrete persistence; app передаёт только private state root. */
  readonly stateRoot?: string;
  /** Injectable key/history предназначены для deterministic package tests. */
  readonly installationKey?: InstallationKey;
  readonly ownerBindingHistory?: MacOSOwnerBindingHistory;
}

interface CommandCapture {
  readonly state: RawQueryState;
  readonly stdout: string;
  readonly stderr: string;
}

interface FileIdentity {
  readonly filesystem: NonNullable<ProductionCandidateIdentityRecord["filesystem"]>;
  readonly executableFingerprint: string;
}

interface CollectedApp {
  readonly record: ProductionInstalledAppRecord;
  readonly state: RawQueryState;
  readonly executablePath: string | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly packageRegisteredUninstaller: boolean;
}

interface ProcessInternal {
  readonly pid: string;
  readonly record: ProductionProcessRecord;
}

interface OpenInternal {
  readonly pid: string;
  readonly record: ProductionOpenFileRecord;
}

interface InstalledCapture {
  readonly capture: ProductionSourceCapture<ProductionInstalledAppRecord>;
  readonly apps: readonly CollectedApp[];
  readonly packageInventory: Readonly<{
    state: RawQueryState;
    identifiers: readonly string[];
  }>;
}

interface ProcessCapture {
  readonly capture: ProductionSourceCapture<ProductionProcessRecord>;
  readonly records: readonly ProcessInternal[];
}

interface OpenCapture {
  readonly capture: ProductionSourceCapture<ProductionOpenFileRecord>;
  readonly records: readonly OpenInternal[];
}

interface ReceiptCapture {
  readonly capture: ProductionSourceCapture<ProductionReceiptRecord>;
  readonly packageIdentifiers: readonly string[];
}

interface GlobalCollectionCycle {
  readonly installed: InstalledCapture;
  readonly processes: ProcessCapture;
  readonly openFiles: OpenCapture;
  readonly startupTargets: ProductionSourceCapture<ProductionStartupTargetRecord>;
}

interface CollectionCycle {
  readonly candidate: ProductionCandidateIdentityRecord;
  readonly ownerBindings: ProductionSourceCapture<ProductionOwnerBindingRecord>;
  readonly installed: ProductionSourceCapture<ProductionInstalledAppRecord>;
  readonly ownerExecutables: ProductionSourceCapture<ProductionOwnerExecutableRecord>;
  readonly processes: ProductionSourceCapture<ProductionProcessRecord>;
  readonly openFiles: ProductionSourceCapture<ProductionOpenFileRecord>;
  readonly startupTargets: ProductionSourceCapture<ProductionStartupTargetRecord>;
  readonly receipts: ProductionSourceCapture<ProductionReceiptRecord>;
  readonly officialUninstallers: ProductionSourceCapture<ProductionOfficialUninstallerRecord>;
  readonly dependencies: ProductionSourceCapture<ProductionDependencyRecord>;
  readonly discoveredHistory: readonly KeyedOwnerBindingHistoryRecord[];
  readonly snapshot: ProductionCorrelationSnapshotRecord;
}

const STATE_PRIORITY: Readonly<Record<RawQueryState, number>> = {
  complete: 0,
  parse_loss: 1,
  partial_inventory: 2,
  truncated: 3,
  capability_missing: 4,
  permission_denied: 5,
  timeout: 6,
  cancelled: 7,
};

function mergeState(...states: readonly RawQueryState[]): RawQueryState {
  return states.reduce(
    (current, state) => STATE_PRIORITY[state] > STATE_PRIORITY[current] ? state : current,
    "complete",
  );
}

async function mapConcurrent<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }
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

function digest(domain: string, value: unknown): string {
  return createHash("sha256").update(domain).update("\0").update(stable(value)).digest("hex");
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code : undefined;
}

function failureState(error: unknown): RawQueryState {
  if (isAbortError(error)) return "cancelled";
  const code = errorCode(error);
  if (code === "ETIMEDOUT") return "timeout";
  if (code === "EACCES" || code === "EPERM") return "permission_denied";
  if (code === "ENOENT" || code === "ENOTSUP") return "capability_missing";
  return "parse_loss";
}

function exitState(exitCode: number): RawQueryState {
  if (exitCode === 0) return "complete";
  if (exitCode === 77 || exitCode === 126) return "permission_denied";
  if (exitCode === 127) return "capability_missing";
  return "parse_loss";
}

async function runCommand(
  commands: CommandRunner,
  executable: string,
  argv: readonly string[],
  signal: AbortSignal,
): Promise<CommandCapture> {
  try {
    const output = await commands.run(executable, argv, { signal });
    return { state: exitState(output.exitCode), stdout: output.stdout, stderr: output.stderr };
  } catch (error) {
    return { state: failureState(error), stdout: "", stderr: "" };
  }
}

function sourceCapture<T>(
  records: readonly T[],
  state: RawQueryState,
  coverageKind: ProductionSourceCapture<T>["coverageKind"],
  startedAt: string,
  now: () => string,
): ProductionSourceCapture<T> {
  return {
    state,
    coverageKind,
    startedAt,
    completedAt: state === "timeout" || state === "cancelled" ? null : now(),
    records,
  };
}

function snapshotMaterial<T>(capture: ProductionSourceCapture<T>) {
  return { state: capture.state, coverageKind: capture.coverageKind, records: capture.records };
}

async function fileIdentity(
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  path: string,
  signal: AbortSignal,
): Promise<Readonly<{ state: RawQueryState; identity: FileIdentity | null }>> {
  try {
    const canonicalPath = await filesystem.canonicalize(path, signal);
    const metadata = await filesystem.stat(canonicalPath, signal);
    const fingerprint = digest("cmc:macos:filesystem:v2", {
      device: metadata.device,
      inode: metadata.inode,
      fileType: metadata.fileType,
      uid: metadata.uid,
      gid: metadata.gid,
      size: metadata.size,
      modifiedAtMs: metadata.modifiedAtMs,
    });
    return {
      state: "complete",
      identity: {
        filesystem: { canonicalPath, ...metadata, fingerprint },
        executableFingerprint: digest("cmc:macos:executable:v2", { canonicalPath, fingerprint }),
      },
    };
  } catch (error) {
    return { state: failureState(error), identity: null };
  }
}

function parseJsonObject(value: string): Readonly<Record<string, unknown>> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Readonly<Record<string, unknown>> : null;
  } catch {
    return null;
  }
}

function metadataString(metadata: Readonly<Record<string, unknown>> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function signingFields(value: string): Readonly<{
  designatedRequirement: string;
  teamIdentifier: string;
}> | null {
  const requirement = value.match(/^designated =>\s*(.+)$/mu)?.[1]?.trim();
  const team = value.match(/^TeamIdentifier=(\S+)$/mu)?.[1]?.trim();
  return requirement && team ? { designatedRequirement: requirement, teamIdentifier: team } : null;
}

async function collectApp(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  path: string,
  packageIdentifier: string | undefined,
  packageRegisteredUninstaller: boolean,
  signal: AbortSignal,
): Promise<CollectedApp> {
  const bundleFile = await fileIdentity(filesystem, path, signal);
  if (bundleFile.identity === null) {
    return { record: { localId: digest("cmc:app-local:v2", path) }, state: bundleFile.state, executablePath: null, metadata: null, packageRegisteredUninstaller };
  }
  const plistPath = join(bundleFile.identity.filesystem.canonicalPath, "Contents", "Info.plist");
  const plist = await runCommand(commands, "/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath], signal);
  const metadata = plist.state === "complete" ? parseJsonObject(plist.stdout) : null;
  const metadataState = plist.state === "complete" && metadata === null ? "parse_loss" : plist.state;
  const bundleIdentifier = metadataString(metadata, "CFBundleIdentifier");
  const executableName = metadataString(metadata, "CFBundleExecutable");
  const executablePath = executableName === null ? null
    : join(bundleFile.identity.filesystem.canonicalPath, "Contents", "MacOS", executableName);
  const executable = executablePath === null
    ? { state: "parse_loss" as const, identity: null }
    : await fileIdentity(filesystem, executablePath, signal);
  const codesign = await runCommand(
    commands,
    "/usr/bin/codesign",
    ["-d", "-r-", "--verbose=4", bundleFile.identity.filesystem.canonicalPath],
    signal,
  );
  const signing = codesign.state === "complete" ? signingFields(`${codesign.stdout}\n${codesign.stderr}`) : null;
  const signingState = codesign.state === "complete" && signing === null ? "parse_loss" : codesign.state;
  const record: ProductionInstalledAppRecord = {
    localId: digest("cmc:app-local:v2", bundleFile.identity.filesystem.fingerprint),
    filesystem: bundleFile.identity.filesystem,
    owner: { uid: bundleFile.identity.filesystem.uid, gid: bundleFile.identity.filesystem.gid },
    ...(packageIdentifier === undefined ? {} : { packageIdentifier }),
    ...(bundleIdentifier === null ? {} : {
      bundle: { bundleIdentifier, metadataFingerprint: digest("cmc:bundle-metadata:v2", plist.stdout) },
    }),
    ...(executable.identity === null ? {} : { executableFingerprint: executable.identity.executableFingerprint }),
    ...(signing === null || executable.identity === null ? {} : {
      signing: { ...signing, executableFingerprint: executable.identity.executableFingerprint },
    }),
  };
  return {
    record,
    state: mergeState(bundleFile.state, metadataState, executable.state, signingState),
    executablePath: executable.identity?.filesystem.canonicalPath ?? null,
    metadata,
    packageRegisteredUninstaller,
  };
}

async function listRootApps(
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  root: string,
  optional: boolean,
  signal: AbortSignal,
): Promise<Readonly<{ state: RawQueryState; paths: readonly string[] }>> {
  const queue = [root];
  const paths: string[] = [];
  let state: RawQueryState = "complete";
  while (queue.length > 0 && paths.length < MAX_SOURCE_RECORDS) {
    const current = queue.shift()!;
    try {
      const entries = await filesystem.readDirectory(current, signal);
      for (const entry of entries) {
        if (entry.fileType === "bundle" && entry.path.endsWith(".app")) paths.push(entry.path);
        else if (entry.fileType === "directory") queue.push(entry.path);
      }
    } catch (error) {
      if (errorCode(error) !== "ENOENT") state = mergeState(state, failureState(error));
      else if (!optional) state = mergeState(state, "capability_missing");
    }
    if (queue.length + paths.length > MAX_SOURCE_RECORDS) state = mergeState(state, "truncated");
  }
  return { state, paths: [...new Set(paths)].sort() };
}

function packageAppPaths(stdout: string): readonly string[] | null {
  const lines = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => isAbsolute(line) || line.includes("\0"))) return null;
  const paths = lines
    .map((line) => line.match(/^(.+?\.app)(?:\/|$)/u)?.[1])
    .filter((value): value is string => value !== undefined);
  if (paths.some((path) => path.split("/").some((component) => component === "" || component === "." || component === ".."))) {
    return null;
  }
  return [...new Set(paths)].sort();
}

interface PackageInstallInfo {
  readonly volume: string;
  readonly location: string;
}

function packageInstallInfo(
  stdout: string,
  expectedPackageIdentifier: string,
): PackageInstallInfo | null {
  const fields = new Map<string, string[]>();
  for (const line of stdout.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)) {
    const match = line.match(/^([a-z-]+):\s*(.*)$/u);
    if (!match) return null;
    const values = fields.get(match[1]!) ?? [];
    values.push(match[2]!);
    fields.set(match[1]!, values);
  }
  const packageIds = fields.get("package-id") ?? [];
  const volumes = fields.get("volume") ?? [];
  const locations = fields.get("location") ?? [];
  if (
    packageIds.length !== 1 || packageIds[0] !== expectedPackageIdentifier ||
    volumes.length !== 1 || !isAbsolute(volumes[0]!) || volumes[0]!.includes("\0") ||
    locations.length !== 1 || locations[0]!.includes("\0")
  ) return null;
  const location = locations[0]!.replace(/^\/+|\/+$/gu, "");
  if (location.split("/").some((component) => component === "." || component === "..")) return null;
  return { volume: resolve(volumes[0]!), location };
}

function packagePayloadPath(
  info: PackageInstallInfo,
  relativePayloadPath: string,
): string | null {
  if (
    isAbsolute(relativePayloadPath) || relativePayloadPath.includes("\0") ||
    relativePayloadPath.split("/").some((component) => component === "" || component === "." || component === "..")
  ) return null;
  const target = resolve(info.volume, info.location, relativePayloadPath);
  const fromVolume = relative(info.volume, target);
  if (fromVolume === ".." || fromVolume.startsWith(`..${sep}`) || isAbsolute(fromVolume)) return null;
  return target;
}

async function collectInstalledApps(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  userHome: string,
  signal: AbortSignal,
  now: () => string,
): Promise<InstalledCapture> {
  const startedAt = now();
  const roots = [...APP_ROOTS, join(userHome, "Applications")];
  const rootInventories = await Promise.all(roots.map((root, index) =>
    listRootApps(filesystem, root, index === roots.length - 1, signal)
  ));
  let state = mergeState(...rootInventories.map((inventory) => inventory.state));
  const discovered = new Map<string, { packageIdentifier?: string; uninstaller: boolean }>();
  for (const path of rootInventories.flatMap(({ paths }) => paths)) discovered.set(path, { uninstaller: false });

  const packages = await runCommand(commands, "/usr/sbin/pkgutil", ["--pkgs"], signal);
  state = mergeState(state, packages.state);
  let packageInventoryState = packages.state;
  let packageIdentifiers: readonly string[] = [];
  if (packages.state === "complete") {
    const identifiers = [...new Set(packages.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean))].sort();
    if (identifiers.length > MAX_SOURCE_RECORDS) {
      state = mergeState(state, "truncated");
      packageInventoryState = "truncated";
    }
    packageIdentifiers = identifiers.slice(0, MAX_SOURCE_RECORDS);
    const packageQueries = await mapConcurrent(
      packageIdentifiers,
      MAX_COMMAND_CONCURRENCY,
      async (packageIdentifier) => {
        const [infoCommand, files] = await Promise.all([
          runCommand(commands, "/usr/sbin/pkgutil", ["--pkg-info", packageIdentifier], signal),
          runCommand(commands, "/usr/sbin/pkgutil", ["--files", packageIdentifier], signal),
        ] as const);
        return { packageIdentifier, infoCommand, files };
      },
    );
    for (const { packageIdentifier, infoCommand, files } of packageQueries) {
      state = mergeState(state, infoCommand.state, files.state);
      if (infoCommand.state !== "complete" || files.state !== "complete") continue;
      const info = packageInstallInfo(infoCommand.stdout, packageIdentifier);
      const relativeApps = packageAppPaths(files.stdout);
      if (info === null || relativeApps === null) {
        state = mergeState(state, "parse_loss");
        continue;
      }
      for (const relativeApp of relativeApps) {
        const payloadPath = packagePayloadPath(info, relativeApp);
        if (payloadPath === null) {
          state = mergeState(state, "parse_loss");
          continue;
        }
        try {
          const canonical = await filesystem.canonicalize(payloadPath, signal);
          const existing = discovered.get(canonical);
          if (
            existing?.packageIdentifier !== undefined &&
            existing.packageIdentifier !== packageIdentifier
          ) {
            state = mergeState(state, "partial_inventory");
            continue;
          }
          discovered.set(canonical, {
            packageIdentifier,
            uninstaller: /(?:uninstall|remove)/iu.test(basename(relativeApp)),
          });
        } catch (error) {
          state = mergeState(
            state,
            errorCode(error) === "ENOENT" ? "partial_inventory" : failureState(error),
          );
        }
      }
    }
  }
  if (discovered.size > MAX_SOURCE_RECORDS) state = mergeState(state, "truncated");
  const appEntries = [...discovered.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_SOURCE_RECORDS);
  const apps = await mapConcurrent(
    appEntries,
    MAX_COMMAND_CONCURRENCY,
    ([path, metadata]) =>
      collectApp(
        commands,
        filesystem,
        path,
        metadata.packageIdentifier,
        metadata.uninstaller,
        signal,
      ),
  );
  state = mergeState(state, ...apps.map((app) => app.state));
  return {
    capture: sourceCapture(apps.map(({ record }) => record), state, "canonical", startedAt, now),
    apps,
    packageInventory: {
      state: packageInventoryState,
      identifiers: packageIdentifiers,
    },
  };
}

async function collectProcesses(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  signal: AbortSignal,
  now: () => string,
): Promise<ProcessCapture> {
  const startedAt = now();
  const command = await runCommand(commands, "/bin/ps", ["-axo", "pid=,lstart=,comm="], signal);
  if (command.state !== "complete") {
    return { capture: sourceCapture([], command.state, "canonical", startedAt, now), records: [] };
  }
  const records: ProcessInternal[] = [];
  let state: RawQueryState = "complete";
  const lines = command.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, MAX_SOURCE_RECORDS)) {
    const match = line.match(/^(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/u);
    if (!match) { state = mergeState(state, "parse_loss"); continue; }
    const executable = await fileIdentity(filesystem, match[3]!, signal);
    state = mergeState(state, executable.state);
    if (executable.identity === null) continue;
    records.push({
      pid: match[1]!,
      record: {
        localId: digest("cmc:process-local:v2", line),
        executableFingerprint: executable.identity.executableFingerprint,
        pidGeneration: digest("cmc:pid-generation:v2", { pid: match[1], startedAt: match[2] }),
      },
    });
  }
  if (lines.length > MAX_SOURCE_RECORDS) state = mergeState(state, "truncated");
  return { capture: sourceCapture(records.map(({ record }) => record), state, "canonical", startedAt, now), records };
}

async function collectOpenFiles(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  signal: AbortSignal,
  now: () => string,
): Promise<OpenCapture> {
  const startedAt = now();
  const command = await runCommand(commands, "/usr/sbin/lsof", ["-nP", "-Fpcn", "-d", "cwd,txt"], signal);
  if (command.state !== "complete") {
    return { capture: sourceCapture([], command.state, "canonical", startedAt, now), records: [] };
  }
  const records: OpenInternal[] = [];
  let state: RawQueryState = "complete";
  let pid = "";
  let commandName = "";
  for (const line of command.stdout.split(/\r?\n/u)) {
    if (line.startsWith("p")) { pid = line.slice(1); continue; }
    if (line.startsWith("c")) { commandName = line.slice(1); continue; }
    if (!line.startsWith("n") || line.length === 1) continue;
    if (!/^\d+$/u.test(pid)) { state = mergeState(state, "parse_loss"); continue; }
    const target = await fileIdentity(filesystem, line.slice(1), signal);
    state = mergeState(state, target.state);
    if (target.identity === null) continue;
    records.push({
      pid,
      record: {
        localId: digest("cmc:open-local:v2", { pid, target: target.identity.filesystem.fingerprint }),
        targetFilesystemFingerprint: target.identity.filesystem.fingerprint,
        processGeneration: digest("cmc:open-process:v2", { pid, commandName }),
      },
    });
    if (records.length === MAX_SOURCE_RECORDS) { state = mergeState(state, "truncated"); break; }
  }
  return { capture: sourceCapture(records.map(({ record }) => record), state, "canonical", startedAt, now), records };
}

async function collectStartupTargets(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  userHome: string,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionStartupTargetRecord>> {
  const startedAt = now();
  const roots = ["/Library/LaunchAgents", "/Library/LaunchDaemons", join(userHome, "Library", "LaunchAgents")];
  const paths: string[] = [];
  let state: RawQueryState = "complete";
  for (const root of roots) {
    try {
      paths.push(...(await filesystem.readDirectory(root, signal))
        .filter((entry) => entry.fileType === "file" && extname(entry.path) === ".plist")
        .map(({ path }) => path));
    } catch (error) {
      if (errorCode(error) !== "ENOENT") state = mergeState(state, failureState(error));
    }
  }
  const records: ProductionStartupTargetRecord[] = [];
  for (const path of [...new Set(paths)].sort().slice(0, MAX_SOURCE_RECORDS)) {
    const plist = await runCommand(commands, "/usr/bin/plutil", ["-convert", "json", "-o", "-", path], signal);
    state = mergeState(state, plist.state);
    if (plist.state !== "complete") continue;
    const metadata = parseJsonObject(plist.stdout);
    const args = metadata?.ProgramArguments;
    const targetPath = metadataString(metadata, "Program") ??
      (Array.isArray(args) && typeof args[0] === "string" ? args[0] : null);
    if (targetPath === null) { state = mergeState(state, "parse_loss"); continue; }
    const executable = await fileIdentity(filesystem, targetPath, signal);
    state = mergeState(state, executable.state);
    if (executable.identity !== null) records.push({
      localId: digest("cmc:startup-local:v2", path),
      executableFingerprint: executable.identity.executableFingerprint,
    });
  }
  if (paths.length > MAX_SOURCE_RECORDS) state = mergeState(state, "truncated");
  return sourceCapture(records, state, "canonical", startedAt, now);
}

async function collectReceipts(
  commands: CommandRunner,
  candidate: ProductionCandidateIdentityRecord,
  inventory: InstalledCapture["packageInventory"],
  signal: AbortSignal,
  now: () => string,
): Promise<ReceiptCapture> {
  const startedAt = now();
  if (inventory.state !== "complete" && inventory.state !== "truncated") {
    return { capture: sourceCapture([], inventory.state, "candidate_specific", startedAt, now), packageIdentifiers: [] };
  }
  const fileInfo = await runCommand(commands, "/usr/sbin/pkgutil", ["--file-info", candidate.filesystem.canonicalPath], signal);
  if (fileInfo.state !== "complete") {
    return { capture: sourceCapture([], fileInfo.state, "candidate_specific", startedAt, now), packageIdentifiers: [] };
  }
  const canonicalPackages = new Set(inventory.identifiers);
  const parsed = fileInfo.stdout.split(/\r?\n/u)
    .map((line) => line.match(/^(?:package-id|pkgid):\s*(\S+)$/u)?.[1])
    .filter((value): value is string => value !== undefined);
  const packageIdentifiers = [...new Set(parsed)].filter((identifier) => canonicalPackages.has(identifier)).sort();
  const unrecognized = parsed.some((identifier) => !canonicalPackages.has(identifier));
  return {
    capture: sourceCapture(
      packageIdentifiers.map((packageIdentifier) => ({
        localId: digest("cmc:receipt-local:v2", packageIdentifier),
        packageIdentifier,
        targetFilesystemFingerprint: candidate.filesystem.fingerprint,
      })),
      mergeState(inventory.state, unrecognized && inventory.state === "complete" ? "parse_loss" : "complete"),
      "candidate_specific",
      startedAt,
      now,
    ),
    packageIdentifiers,
  };
}

function queryClaim(key: InstallationKey, claim: RawIdentityClaim): `hmac-sha256:v1:${string}` {
  return key.derive("cmc:correlation:query-claim:v2", claim.kind, stable(claim));
}

function appClaims(app: CollectedApp): readonly [RawIdentityClaim, RawIdentityClaim, RawIdentityClaim] | null {
  const bundle = app.record.bundle;
  const signing = app.record.signing;
  const executable = app.record.executableFingerprint;
  return bundle && signing && executable ? [
    { kind: "bundle", ...bundle },
    { kind: "signing", ...signing },
    { kind: "executable", executableFingerprint: executable },
  ] : null;
}

function historyMatchesApp(record: KeyedOwnerBindingHistoryRecord, app: CollectedApp, key: InstallationKey): boolean {
  const claims = appClaims(app);
  return claims !== null && record.keyId === key.keyId && record.derivationVersion === key.derivationVersion &&
    queryClaim(key, claims[0]) === record.ownerBundleDigest &&
    queryClaim(key, claims[1]) === record.ownerSigningDigest &&
    queryClaim(key, claims[2]) === record.ownerExecutableDigest;
}

function historyRecord(
  key: InstallationKey,
  candidate: ProductionCandidateIdentityRecord,
  parentFingerprint: string,
  ownerTypeFingerprint: string,
  app: CollectedApp,
  now: string,
): KeyedOwnerBindingHistoryRecord | null {
  const claims = appClaims(app);
  if (claims === null) return null;
  const material = {
    artifactDigest: key.derive("cmc:owner-history:v1", "artifact", candidate.filesystem.fingerprint),
    ownerTypeDigest: key.derive("cmc:owner-history:v1", "owner-type", ownerTypeFingerprint),
    rootDigest: key.derive("cmc:owner-history:v1", "root", parentFingerprint),
    ownerBundleDigest: queryClaim(key, claims[0]),
    ownerSigningDigest: queryClaim(key, claims[1]),
    ownerExecutableDigest: queryClaim(key, claims[2]),
  };
  return {
    keyId: key.keyId,
    derivationVersion: key.derivationVersion,
    ...material,
    bindingFingerprint: digest("cmc:owner-history-binding:v1", material),
    provenanceClass: "signed_process_open_file_history",
    lastValidatedAt: now,
  };
}

function bindingRecords(
  baselineHistory: readonly KeyedOwnerBindingHistoryRecord[],
  key: InstallationKey | undefined,
  candidate: ProductionCandidateIdentityRecord,
  receipt: ReceiptCapture,
  container: ProductionOwnerBindingRecord | null,
  parentFingerprint: string,
  ownerTypeFingerprint: string,
): readonly ProductionOwnerBindingRecord[] {
  const records: ProductionOwnerBindingRecord[] = [];
  for (const packageIdentifier of receipt.packageIdentifiers) records.push({
    localId: digest("cmc:receipt-binding:v2", packageIdentifier),
    sourceKind: "exact_receipt_payload",
    ownerKind: "package",
    packageIdentifier,
    receiptPayload: { packageIdentifier, targetFilesystemFingerprint: candidate.filesystem.fingerprint },
  });
  if (container !== null) records.push(container);
  if (key !== undefined) {
    const artifactDigest = key.derive("cmc:owner-history:v1", "artifact", candidate.filesystem.fingerprint);
    const ownerTypeDigest = key.derive("cmc:owner-history:v1", "owner-type", ownerTypeFingerprint);
    const rootDigest = key.derive("cmc:owner-history:v1", "root", parentFingerprint);
    for (const history of baselineHistory.filter((entry) =>
      entry.keyId === key.keyId && entry.derivationVersion === key.derivationVersion &&
      entry.artifactDigest === artifactDigest && entry.ownerTypeDigest === ownerTypeDigest && entry.rootDigest === rootDigest
    )) records.push({
      localId: digest("cmc:history-binding-local:v2", history.bindingFingerprint),
      sourceKind: "signed_process_open_file_history",
      ownerKind: "app_bundle",
      historicalBinding: {
        keyId: history.keyId,
        derivationVersion: history.derivationVersion,
        artifactDigest: history.artifactDigest,
        ownerTypeDigest: history.ownerTypeDigest,
        rootDigest: history.rootDigest,
        ownerBundleDigest: history.ownerBundleDigest,
        ownerSigningDigest: history.ownerSigningDigest,
        ownerExecutableDigest: history.ownerExecutableDigest,
        bindingFingerprint: history.bindingFingerprint,
      } satisfies ProductionHistoricalBindingRecord,
    });
  }
  return records;
}

async function containerBinding(
  commands: CommandRunner,
  candidate: ProductionCandidateIdentityRecord,
  category: CorrelationArtifactCategory,
  signal: AbortSignal,
): Promise<Readonly<{ state: RawQueryState; record: ProductionOwnerBindingRecord | null }>> {
  if (category !== "container") return { state: "complete", record: null };
  const metadataPath = join(candidate.filesystem.canonicalPath, ".com.apple.containermanagerd.metadata.plist");
  const command = await runCommand(commands, "/usr/bin/plutil", ["-convert", "json", "-o", "-", metadataPath], signal);
  if (command.state !== "complete") return { state: command.state, record: null };
  const metadata = parseJsonObject(command.stdout);
  const bundleIdentifier = metadataString(metadata, "MCMMetadataIdentifier");
  if (bundleIdentifier === null) return { state: "parse_loss", record: null };
  return {
    state: "complete",
    record: {
      localId: digest("cmc:container-binding:v2", bundleIdentifier),
      sourceKind: "os_container_metadata",
      ownerKind: "app_bundle",
      bundle: { bundleIdentifier, metadataFingerprint: digest("cmc:container-metadata:v2", command.stdout) },
      containerMetadata: {
        bundleIdentifier,
        targetFilesystemFingerprint: candidate.filesystem.fingerprint,
        individualContainer: true,
      },
    },
  };
}

function categoryFor(candidatePath: string, userHome: string): CorrelationArtifactCategory {
  const library = resolve(userHome, "Library");
  const candidate = resolve(candidatePath);
  const fromLibrary = relative(library, candidate);
  if (!fromLibrary || fromLibrary === ".." || fromLibrary.startsWith(`..${sep}`) || isAbsolute(fromLibrary)) return "unknown";
  const first = fromLibrary.split(sep)[0] ?? "";
  return first === "Caches" ? "cache"
    : first === "Logs" ? "log"
      : first === "Application Support" ? "application_support"
        : first === "Containers" ? "container"
          : first === "Group Containers" ? "group_container"
            : first === "Preferences" ? "preference"
              : first === "WebKit" ? "webkit"
                : first === "HTTPStorages" ? "http_storage"
                  : first === "Saved Application State" ? "saved_state" : "unknown";
}

function ownerAppsForBinding(
  bindings: readonly ProductionOwnerBindingRecord[],
  installed: InstalledCapture,
  key: InstallationKey | undefined,
): readonly CollectedApp[] {
  return installed.apps.filter((app) => bindings.some((binding) => {
    if (binding.sourceKind === "exact_receipt_payload") {
      return binding.packageIdentifier !== undefined && binding.packageIdentifier === app.record.packageIdentifier;
    }
    if (binding.sourceKind === "os_container_metadata") {
      return binding.bundle?.bundleIdentifier !== undefined &&
        binding.bundle.bundleIdentifier === app.record.bundle?.bundleIdentifier &&
        app.record.signing !== undefined && app.record.executableFingerprint !== undefined;
    }
    return key !== undefined && binding.historicalBinding !== undefined &&
      historyMatchesApp(binding.historicalBinding as KeyedOwnerBindingHistoryRecord, app, key);
  }));
}

async function collectGlobalCycle(
  dependencies: Readonly<{
    commands: CommandRunner;
    filesystem: MacOSCorrelationReadOnlyFileSystem;
    now: () => string;
  }>,
  userHome: string,
  signal: AbortSignal,
): Promise<GlobalCollectionCycle> {
  const [installed, processes, openFiles, startupTargets] = await Promise.all([
    collectInstalledApps(
      dependencies.commands,
      dependencies.filesystem,
      userHome,
      signal,
      dependencies.now,
    ),
    collectProcesses(
      dependencies.commands,
      dependencies.filesystem,
      signal,
      dependencies.now,
    ),
    collectOpenFiles(
      dependencies.commands,
      dependencies.filesystem,
      signal,
      dependencies.now,
    ),
    collectStartupTargets(
      dependencies.commands,
      dependencies.filesystem,
      userHome,
      signal,
      dependencies.now,
    ),
  ] as const);
  return { installed, processes, openFiles, startupTargets };
}

async function collectCycle(
  dependencies: Readonly<{
    commands: CommandRunner;
    candidates: MacOSCandidateRegistry;
    filesystem: MacOSCorrelationReadOnlyFileSystem;
    now: () => string;
    key?: InstallationKey;
  }>,
  baselineHistory: readonly KeyedOwnerBindingHistoryRecord[],
  global: GlobalCollectionCycle,
  candidateRef: string,
  signal: AbortSignal,
): Promise<CollectionCycle> {
  const location = await dependencies.candidates.resolve(candidateRef, signal);
  if (location === null) throw new CorrelationInputError("CORRELATION_MISSING");
  const candidateFile = await fileIdentity(dependencies.filesystem, location.candidatePath, signal);
  if (candidateFile.identity === null) {
    throw new CorrelationInputError(candidateFile.state === "permission_denied" ? "PERMISSION_DENIED" : "CORRELATION_MISSING");
  }
  const category = categoryFor(candidateFile.identity.filesystem.canonicalPath, location.userHome);
  const candidate: ProductionCandidateIdentityRecord = {
    localId: digest("cmc:library-artifact-local:v2", candidateRef),
    filesystem: candidateFile.identity.filesystem,
    owner: { uid: candidateFile.identity.filesystem.uid, gid: candidateFile.identity.filesystem.gid },
    category,
    privateNonExecutable: PRIVATE_ACTIONABLE_CATEGORIES.has(category) && candidateFile.identity.filesystem.fileType !== "bundle",
  };
  const parent = await fileIdentity(dependencies.filesystem, dirname(candidate.filesystem.canonicalPath), signal);
  if (parent.identity === null) throw new CorrelationInputError("CORRELATION_SNAPSHOT_STALE");
  const ownerTypeFingerprint = digest("cmc:owner-type:v2", {
    uid: candidate.filesystem.uid,
    gid: candidate.filesystem.gid,
    fileType: candidate.filesystem.fileType,
  });
  const { installed, processes, openFiles, startupTargets } = global;
  const [receipts, container] = await Promise.all([
    collectReceipts(
      dependencies.commands,
      candidate,
      installed.packageInventory,
      signal,
      dependencies.now,
    ),
    containerBinding(dependencies.commands, candidate, category, signal),
  ] as const);
  const bindings = bindingRecords(
    baselineHistory,
    dependencies.key,
    candidate,
    receipts,
    container.record,
    parent.identity.filesystem.fingerprint,
    ownerTypeFingerprint,
  );
  const bindingState = mergeState(receipts.capture.state, container.state);
  const ownerApps = ownerAppsForBinding(bindings, installed, dependencies.key);
  const ownerExecutables = sourceCapture<ProductionOwnerExecutableRecord>(
    ownerApps.flatMap((app) => app.record.executableFingerprint === undefined ? [] : [{
      localId: digest("cmc:owner-executable-local:v2", app.record.executableFingerprint),
      executableFingerprint: app.record.executableFingerprint,
    }]),
    installed.capture.state,
    "candidate_specific",
    dependencies.now(),
    dependencies.now,
  );
  const officialUninstallers = sourceCapture<ProductionOfficialUninstallerRecord>(
    ownerApps.flatMap((app) => {
      const claims = appClaims(app);
      if (!app.packageRegisteredUninstaller || claims === null) return [];
      const bundle = claims[0] as Extract<RawIdentityClaim, { kind: "bundle" }>;
      const signing = claims[1] as Extract<RawIdentityClaim, { kind: "signing" }>;
      const executable = claims[2] as Extract<RawIdentityClaim, { kind: "executable" }>;
      return [{
        localId: digest("cmc:uninstaller-local:v2", app.record.localId),
        bundleIdentifier: bundle.bundleIdentifier,
        designatedRequirement: signing.designatedRequirement,
        executableFingerprint: executable.executableFingerprint,
      }];
    }),
    installed.capture.state,
    "canonical",
    dependencies.now(),
    dependencies.now,
  );
  const dependency = sourceCapture<ProductionDependencyRecord>([], "complete", "candidate_specific", dependencies.now(), dependencies.now);

  const discoveredHistory: KeyedOwnerBindingHistoryRecord[] = [];
  if (dependencies.key !== undefined && processes.capture.state === "complete" && openFiles.capture.state === "complete" && installed.capture.state === "complete") {
    const openPids = new Set(openFiles.records
      .filter(({ record }) => record.targetFilesystemFingerprint === candidate.filesystem.fingerprint)
      .map(({ pid }) => pid));
    const executableFingerprints = new Set(processes.records
      .filter(({ pid }) => openPids.has(pid))
      .map(({ record }) => record.executableFingerprint));
    const owners = installed.apps.filter((app) =>
      app.record.executableFingerprint !== undefined && executableFingerprints.has(app.record.executableFingerprint) && appClaims(app) !== null
    );
    if (owners.length === 1) {
      const record = historyRecord(
        dependencies.key,
        candidate,
        parent.identity.filesystem.fingerprint,
        ownerTypeFingerprint,
        owners[0]!,
        dependencies.now(),
      );
      if (record !== null) discoveredHistory.push(record);
    }
  }
  const profileFingerprint = digest("cmc:requirement-profile:v2", {
    category,
    privateNonExecutable: candidate.privateNonExecutable,
    bindingCount: bindings.length,
  });
  const snapshot: ProductionCorrelationSnapshotRecord = {
    candidateFingerprint: candidate.filesystem.fingerprint,
    parentFingerprint: parent.identity.filesystem.fingerprint,
    ownerTypeFingerprint,
    ownerExecutableFingerprint: digest("cmc:owner-executable-snapshot:v2", snapshotMaterial(ownerExecutables)),
    processFingerprint: digest("cmc:process-snapshot:v2", snapshotMaterial(processes.capture)),
    openFileFingerprint: digest("cmc:open-snapshot:v2", snapshotMaterial(openFiles.capture)),
    receiptFingerprint: digest("cmc:receipt-snapshot:v2", snapshotMaterial(receipts.capture)),
    dependencyFingerprint: digest("cmc:dependency-snapshot:v2", snapshotMaterial(dependency)),
    ownerBindingFingerprint: digest("cmc:owner-binding-snapshot:v2", bindings),
    requirementProfileFingerprint: profileFingerprint,
  };
  return {
    candidate,
    ownerBindings: sourceCapture(bindings, bindingState, "candidate_specific", dependencies.now(), dependencies.now),
    installed: installed.capture,
    ownerExecutables,
    processes: processes.capture,
    openFiles: openFiles.capture,
    startupTargets,
    receipts: receipts.capture,
    officialUninstallers,
    dependencies: dependency,
    discoveredHistory,
    snapshot,
  };
}

function requireCycle(cycle: CollectionCycle | undefined): CollectionCycle {
  if (cycle === undefined) throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  return cycle;
}

/**
 * Concrete package-owned macOS composition seam. Caller передаёт fixed low-level
 * CommandRunner, opaque candidate registry и optional private state root.
 */
export function createMacOSProductionCorrelationAdapter(
  input: CreateMacOSProductionCorrelationAdapterInput,
): ProductionCorrelationAdapter {
  const commandTimeoutMs = input.commandTimeoutMs ?? 30_000;
  if (!Number.isSafeInteger(commandTimeoutMs) || commandTimeoutMs < 1) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  const history = input.ownerBindingHistory ??
    (input.stateRoot === undefined ? undefined : new KeyedOwnerBindingHistoryStore(input.stateRoot));
  const keyStore = input.stateRoot === undefined ? undefined : new InstallationKeyStore({ stateRoot: input.stateRoot });
  const dependencies = {
    commands: createCommandTimeoutRunner(input.commands, commandTimeoutMs),
    candidates: input.candidates,
    filesystem: input.filesystem ?? createNodeMacOSCorrelationReadOnlyFileSystem(),
    now: input.now ?? (() => new Date().toISOString()),
    ...(input.installationKey === undefined ? {} : { key: input.installationKey }),
  } as const;
  const globalCycles: Partial<
    Record<"A" | "B", Promise<GlobalCollectionCycle>>
  > = {};
  let baselineHistoryPromise = history === undefined
    ? Promise.resolve<readonly KeyedOwnerBindingHistoryRecord[]>([])
    : history.list();
  let historyWriteQueue = Promise.resolve();
  let globalUserHome: string | null = null;

  function historyIdentity(record: KeyedOwnerBindingHistoryRecord): string {
    return stable({
      keyId: record.keyId,
      derivationVersion: record.derivationVersion,
      artifactDigest: record.artifactDigest,
      ownerTypeDigest: record.ownerTypeDigest,
      rootDigest: record.rootDigest,
      ownerBundleDigest: record.ownerBundleDigest,
      ownerSigningDigest: record.ownerSigningDigest,
      ownerExecutableDigest: record.ownerExecutableDigest,
    });
  }

  async function persistDiscoveredHistory(
    discovered: readonly KeyedOwnerBindingHistoryRecord[],
  ): Promise<void> {
    if (history === undefined || discovered.length === 0) return;
    const operation = historyWriteQueue.then(async () => {
      const current = await history.list();
      const unique = [
        ...new Map(
          [...current, ...discovered].map(
            (record) => [historyIdentity(record), record] as const,
          ),
        ).values(),
      ];
      await history.replace(unique);
      return unique;
    });
    historyWriteQueue = operation.then(() => undefined, () => undefined);
    baselineHistoryPromise = operation.catch(() => history.list());
    await operation;
  }

  function globalCycle(
    phase: "A" | "B",
    userHome: string,
    signal: AbortSignal,
  ): Promise<GlobalCollectionCycle> {
    if (globalUserHome !== null && globalUserHome !== userHome) {
      return Promise.reject(
        new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED"),
      );
    }
    globalUserHome = userHome;
    const existing = globalCycles[phase];
    if (existing !== undefined) return existing;
    const created = collectGlobalCycle(dependencies, userHome, signal);
    globalCycles[phase] = created;
    return created;
  }

  return Object.freeze({
    async buildInput(
      buildInput: Parameters<ProductionCorrelationAdapter["buildInput"]>[0],
    ): Promise<EphemeralCorrelationInput> {
      const key = input.installationKey ?? (keyStore === undefined ? undefined : await keyStore.loadOrCreate());
      const buildDependencies = key === undefined ? dependencies : { ...dependencies, key };
      const baselineHistory = await baselineHistoryPromise;
      let phaseA: CollectionCycle | undefined;
      let phaseB: CollectionCycle | undefined;
      const commandBoundary: ProductionCorrelationCommandBoundary = {
        installedApps: async () => requireCycle(phaseA).installed,
        processes: async () => requireCycle(phaseA).processes,
        openFiles: async () => requireCycle(phaseA).openFiles,
      };
      const filesystemBoundary: ProductionCorrelationFilesystemBoundary = {
        async captureCandidate(candidateRef, phase, signal): Promise<ProductionCandidateCapture> {
          const location = await buildDependencies.candidates.resolve(
            candidateRef,
            signal,
          );
          if (location === null) {
            throw new CorrelationInputError("CORRELATION_MISSING");
          }
          const cycle = await collectCycle(
            buildDependencies,
            baselineHistory,
            await globalCycle(phase, location.userHome, signal),
            candidateRef,
            signal,
          );
          if (phase === "A") phaseA = cycle;
          else phaseB = cycle;
          return { candidate: cycle.candidate, snapshot: cycle.snapshot };
        },
        ownerBindings: async () => requireCycle(phaseA).ownerBindings,
        ownerExecutables: async () => requireCycle(phaseA).ownerExecutables,
        startupTargets: async () => requireCycle(phaseA).startupTargets,
        receipts: async () => requireCycle(phaseA).receipts,
        officialUninstallers: async () => requireCycle(phaseA).officialUninstallers,
        dependencies: async () => requireCycle(phaseA).dependencies,
      };
      const result = await buildProductionCorrelationInput({ ...buildInput, commandBoundary, filesystemBoundary });
      if (history !== undefined && phaseA !== undefined && phaseB !== undefined && stable(phaseA.snapshot) === stable(phaseB.snapshot)) {
        const discovered = [...phaseA.discoveredHistory, ...phaseB.discoveredHistory];
        await persistDiscoveredHistory(discovered);
      }
      return result;
    },
  });
}

import { createHash } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

import type { CommandRunner } from "./command-runner.js";
import {
  CorrelationInputError,
  type EphemeralCorrelationInput,
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
  type ProductionFilesystemIdentityRecord,
  type ProductionInstalledAppRecord,
  type ProductionOfficialUninstallerRecord,
  type ProductionOpenFileRecord,
  type ProductionProcessRecord,
  type ProductionReceiptRecord,
  type ProductionSourceCapture,
  type ProductionStartupTargetRecord,
  type ProductionTargetExecutableRecord,
} from "./production-correlation.js";
import { isAbortError } from "./types.js";

const INSTALLED_APPS_QUERY =
  "kMDItemContentType == 'com.apple.application-bundle'";
const MAX_SOURCE_RECORDS = 4_096;

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

/** Низкоуровневый read-only порт: identity и correlation records здесь отсутствуют. */
export interface MacOSCorrelationReadOnlyFileSystem {
  canonicalize(path: string, signal: AbortSignal): Promise<string>;
  stat(path: string, signal: AbortSignal): Promise<MacOSCorrelationFileStat>;
  readDirectory(
    path: string,
    signal: AbortSignal,
  ): Promise<readonly MacOSCorrelationDirectoryEntry[]>;
}

export interface MacOSCandidateLocation {
  readonly candidatePath: string;
  readonly userHome: string;
}

/** Registry связывает opaque server ref только с локальным path; claims он не строит. */
export interface MacOSCandidateRegistry {
  resolve(
    candidateRef: string,
    signal: AbortSignal,
  ): Promise<MacOSCandidateLocation | null>;
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
      return candidatePath === undefined
        ? null
        : { candidatePath, userHome: input.userHome };
    },
  });
}

export function createNodeMacOSCorrelationReadOnlyFileSystem():
MacOSCorrelationReadOnlyFileSystem {
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
        fileType: value.isDirectory()
          ? path.endsWith(".app") ? "bundle" : "directory"
          : "file",
        uid: value.uid,
        gid: value.gid,
        size: value.size,
        modifiedAtMs: value.mtimeMs,
      };
    },
    async readDirectory(path, signal) {
      signal.throwIfAborted();
      const entries = await readdir(path, { withFileTypes: true });
      return entries.map((entry) => {
        const entryPath = join(path, entry.name);
        return {
          path: entryPath,
          fileType: entry.isDirectory()
            ? entry.name.endsWith(".app") ? "bundle" : "directory"
            : "file",
        };
      });
    },
  };
  return Object.freeze(filesystem);
}

export interface CreateMacOSProductionCorrelationAdapterInput {
  readonly commands: CommandRunner;
  readonly candidates: MacOSCandidateRegistry;
  readonly filesystem?: MacOSCorrelationReadOnlyFileSystem;
  readonly now?: () => string;
  readonly commandTimeoutMs?: number;
}

interface CommandCapture {
  readonly state: RawQueryState;
  readonly stdout: string;
  readonly stderr: string;
}

interface FileIdentity {
  readonly filesystem: ProductionFilesystemIdentityRecord;
  readonly executableFingerprint: string;
}

interface CollectedApp {
  readonly record: ProductionInstalledAppRecord;
  readonly state: RawQueryState;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly executablePath: string | null;
}

interface InstalledCapture {
  readonly capture: ProductionSourceCapture<ProductionInstalledAppRecord>;
  readonly apps: readonly CollectedApp[];
}

interface ReceiptCapture {
  readonly capture: ProductionSourceCapture<ProductionReceiptRecord>;
  readonly packageIdentifiers: readonly string[];
}

interface CollectionCycle {
  readonly candidate: ProductionCandidateIdentityRecord;
  readonly installed: ProductionSourceCapture<ProductionInstalledAppRecord>;
  readonly processes: ProductionSourceCapture<ProductionProcessRecord>;
  readonly openFiles: ProductionSourceCapture<ProductionOpenFileRecord>;
  readonly startupTargets: ProductionSourceCapture<ProductionStartupTargetRecord>;
  readonly targetExecutables: ProductionSourceCapture<ProductionTargetExecutableRecord>;
  readonly receipts: ProductionSourceCapture<ProductionReceiptRecord>;
  readonly officialUninstallers: ProductionSourceCapture<ProductionOfficialUninstallerRecord>;
  readonly dependencies: ProductionSourceCapture<ProductionDependencyRecord>;
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
  return states.reduce((current, state) =>
    STATE_PRIORITY[state] > STATE_PRIORITY[current] ? state : current
  , "complete");
}

function digest(domain: string, value: unknown): string {
  return createHash("sha256")
    .update(domain)
    .update("\0")
    .update(JSON.stringify(value))
    .digest("hex");
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
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

function withCommandTimeout(
  commands: CommandRunner,
  timeoutMs: number,
): CommandRunner {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  const runner: CommandRunner = {
    async run(executable, argv, { signal }) {
      const controller = new AbortController();
      let timedOut = false;
      const abortFromCaller = (): void => controller.abort();
      if (signal.aborted) abortFromCaller();
      else signal.addEventListener("abort", abortFromCaller, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        return await commands.run(executable, argv, { signal: controller.signal });
      } catch (error) {
        if (timedOut) {
          throw Object.assign(new Error("COMMAND_TIMEOUT"), { code: "ETIMEDOUT" });
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abortFromCaller);
      }
    },
  };
  return Object.freeze(runner);
}

async function runCommand(
  commands: CommandRunner,
  executable: string,
  argv: readonly string[],
  signal: AbortSignal,
): Promise<CommandCapture> {
  try {
    const output = await commands.run(executable, argv, { signal });
    return {
      state: exitState(output.exitCode),
      stdout: output.stdout,
      stderr: output.stderr,
    };
  } catch (error) {
    return { state: failureState(error), stdout: "", stderr: "" };
  }
}

function completeAt(state: RawQueryState, now: () => string): string | null {
  return state === "timeout" || state === "cancelled" ? null : now();
}

function sourceCapture<T>(
  records: readonly T[],
  state: RawQueryState,
  startedAt: string,
  now: () => string,
): ProductionSourceCapture<T> {
  return {
    state,
    startedAt,
    completedAt: completeAt(state, now),
    records,
  };
}

function snapshotMaterial<T>(capture: ProductionSourceCapture<T>): Readonly<{
  state: RawQueryState;
  records: readonly T[];
}> {
  return { state: capture.state, records: capture.records };
}

async function fileIdentity(
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  path: string,
  signal: AbortSignal,
): Promise<Readonly<{ state: RawQueryState; identity: FileIdentity | null }>> {
  try {
    const canonicalPath = await filesystem.canonicalize(path, signal);
    const metadata = await filesystem.stat(canonicalPath, signal);
    const fingerprint = digest("cmc:macos:filesystem:v1", {
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
        filesystem: {
          canonicalPath,
          device: metadata.device,
          inode: metadata.inode,
          fileType: metadata.fileType,
          uid: metadata.uid,
          gid: metadata.gid,
          fingerprint,
        },
        executableFingerprint: digest("cmc:macos:executable:v1", {
          canonicalPath,
          fingerprint,
        }),
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
      ? parsed as Readonly<Record<string, unknown>>
      : null;
  } catch {
    return null;
  }
}

function metadataString(
  metadata: Readonly<Record<string, unknown>> | null,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function signingFields(value: string): Readonly<{
  designatedRequirement: string;
  teamIdentifier: string;
}> | null {
  const requirement = value.match(/^designated =>\s*(.+)$/mu)?.[1]?.trim();
  const team = value.match(/^TeamIdentifier=(\S+)$/mu)?.[1]?.trim();
  return requirement && team
    ? { designatedRequirement: requirement, teamIdentifier: team }
    : null;
}

async function collectApp(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  path: string,
  signal: AbortSignal,
): Promise<CollectedApp> {
  const bundleFile = await fileIdentity(filesystem, path, signal);
  if (bundleFile.identity === null) {
    return {
      record: { localId: digest("cmc:macos:app-local:v1", path) },
      state: bundleFile.state,
      metadata: null,
      executablePath: null,
    };
  }
  const plistPath = join(
    bundleFile.identity.filesystem.canonicalPath,
    "Contents",
    "Info.plist",
  );
  const plist = await runCommand(
    commands,
    "/usr/bin/plutil",
    ["-convert", "json", "-o", "-", plistPath],
    signal,
  );
  const metadata = plist.state === "complete" ? parseJsonObject(plist.stdout) : null;
  const metadataState = plist.state === "complete" && metadata === null
    ? "parse_loss"
    : plist.state;
  const bundleIdentifier = metadataString(metadata, "CFBundleIdentifier");
  const executableName = metadataString(metadata, "CFBundleExecutable");
  const executablePath = executableName === null
    ? null
    : join(bundleFile.identity.filesystem.canonicalPath, "Contents", "MacOS", executableName);
  const executableFile = executablePath === null
    ? { state: "parse_loss" as const, identity: null }
    : await fileIdentity(filesystem, executablePath, signal);
  const codesign = await runCommand(
    commands,
    "/usr/bin/codesign",
    ["-d", "-r-", "--verbose=4", bundleFile.identity.filesystem.canonicalPath],
    signal,
  );
  const signing = codesign.state === "complete"
    ? signingFields(`${codesign.stdout}\n${codesign.stderr}`)
    : null;
  const signingState = codesign.state === "complete" && signing === null
    ? "parse_loss"
    : codesign.state;
  const record: ProductionInstalledAppRecord = {
    localId: digest("cmc:macos:app-local:v1", {
      filesystem: bundleFile.identity.filesystem.fingerprint,
      bundleIdentifier,
    }),
    filesystem: bundleFile.identity.filesystem,
    owner: {
      uid: bundleFile.identity.filesystem.uid,
      gid: bundleFile.identity.filesystem.gid,
    },
    ...(bundleIdentifier === null
      ? {}
      : {
          bundle: {
            bundleIdentifier,
            metadataFingerprint: digest("cmc:macos:bundle-metadata:v1", plist.stdout),
          },
        }),
    ...(executableFile.identity === null
      ? {}
      : { executableFingerprint: executableFile.identity.executableFingerprint }),
    ...(signing === null || executableFile.identity === null
      ? {}
      : {
          signing: {
            ...signing,
            executableFingerprint: executableFile.identity.executableFingerprint,
          },
        }),
  };
  return {
    record,
    state: mergeState(
      bundleFile.state,
      metadataState,
      executableFile.state,
      signingState,
    ),
    metadata,
    executablePath: executableFile.identity?.filesystem.canonicalPath ?? null,
  };
}

async function collectInstalledApps(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  signal: AbortSignal,
  now: () => string,
): Promise<InstalledCapture> {
  const startedAt = now();
  const inventory = await runCommand(
    commands,
    "/usr/bin/mdfind",
    [INSTALLED_APPS_QUERY],
    signal,
  );
  if (inventory.state !== "complete") {
    return {
      capture: sourceCapture([], inventory.state, startedAt, now),
      apps: [],
    };
  }
  const paths = [...new Set(inventory.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean))].sort();
  const truncated = paths.length > MAX_SOURCE_RECORDS;
  const apps: CollectedApp[] = [];
  for (const path of paths.slice(0, MAX_SOURCE_RECORDS)) {
    apps.push(await collectApp(commands, filesystem, path, signal));
  }
  const state = mergeState(
    truncated ? "truncated" : "complete",
    ...apps.map(({ state: appState }) => appState),
  );
  return {
    capture: sourceCapture(
      apps.map(({ record }) => record),
      state,
      startedAt,
      now,
    ),
    apps,
  };
}

async function collectProcesses(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionProcessRecord>> {
  const startedAt = now();
  const command = await runCommand(
    commands,
    "/bin/ps",
    ["-axo", "pid=,lstart=,comm="],
    signal,
  );
  if (command.state !== "complete") {
    return sourceCapture([], command.state, startedAt, now);
  }
  const records: ProductionProcessRecord[] = [];
  let state: RawQueryState = "complete";
  const lines = command.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (const line of lines.slice(0, MAX_SOURCE_RECORDS)) {
    const match = line.match(
      /^(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$/u,
    );
    if (!match) {
      state = mergeState(state, "parse_loss");
      continue;
    }
    const executable = await fileIdentity(filesystem, match[3]!, signal);
    if (executable.identity === null) {
      state = mergeState(state, executable.state);
      continue;
    }
    records.push({
      localId: digest("cmc:macos:process-local:v1", line),
      executableFingerprint: executable.identity.executableFingerprint,
      pidGeneration: digest("cmc:macos:pid-generation:v1", {
        pid: match[1],
        startedAt: match[2],
      }),
    });
  }
  if (lines.length > MAX_SOURCE_RECORDS) state = mergeState(state, "truncated");
  return sourceCapture(records, state, startedAt, now);
}

async function collectOpenFiles(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionOpenFileRecord>> {
  const startedAt = now();
  const command = await runCommand(
    commands,
    "/usr/sbin/lsof",
    ["-nP", "-Fpcn", "-d", "cwd,txt"],
    signal,
  );
  if (command.state !== "complete") {
    return sourceCapture([], command.state, startedAt, now);
  }
  const records: ProductionOpenFileRecord[] = [];
  let state: RawQueryState = "complete";
  let pid = "";
  let commandName = "";
  for (const line of command.stdout.split(/\r?\n/u)) {
    if (line.startsWith("p")) {
      pid = line.slice(1);
      continue;
    }
    if (line.startsWith("c")) {
      commandName = line.slice(1);
      continue;
    }
    if (!line.startsWith("n") || line.length === 1) continue;
    if (!/^\d+$/u.test(pid)) {
      state = mergeState(state, "parse_loss");
      continue;
    }
    const target = await fileIdentity(filesystem, line.slice(1), signal);
    if (target.identity === null) {
      state = mergeState(state, target.state);
      continue;
    }
    records.push({
      localId: digest("cmc:macos:open-file-local:v1", {
        pid,
        target: target.identity.filesystem.fingerprint,
      }),
      targetFilesystemFingerprint: target.identity.filesystem.fingerprint,
      processGeneration: digest("cmc:macos:open-process:v1", { pid, commandName }),
    });
    if (records.length === MAX_SOURCE_RECORDS) {
      state = mergeState(state, "truncated");
      break;
    }
  }
  return sourceCapture(records, state, startedAt, now);
}

async function listStartupPlists(
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  userHome: string,
  signal: AbortSignal,
): Promise<Readonly<{ state: RawQueryState; paths: readonly string[] }>> {
  const roots = [
    "/Library/LaunchAgents",
    "/Library/LaunchDaemons",
    join(userHome, "Library", "LaunchAgents"),
  ];
  const paths: string[] = [];
  let state: RawQueryState = "complete";
  for (const root of roots) {
    try {
      const entries = await filesystem.readDirectory(root, signal);
      paths.push(...entries
        .filter((entry) => entry.fileType === "file" && extname(entry.path) === ".plist")
        .map(({ path }) => path));
    } catch (error) {
      if (errorCode(error) === "ENOENT") continue;
      state = mergeState(state, failureState(error));
    }
  }
  return { state, paths: [...new Set(paths)].sort() };
}

async function collectStartupTargets(
  commands: CommandRunner,
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  userHome: string,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionStartupTargetRecord>> {
  const startedAt = now();
  const inventory = await listStartupPlists(filesystem, userHome, signal);
  const records: ProductionStartupTargetRecord[] = [];
  let state = inventory.state;
  for (const path of inventory.paths.slice(0, MAX_SOURCE_RECORDS)) {
    const plist = await runCommand(
      commands,
      "/usr/bin/plutil",
      ["-convert", "json", "-o", "-", path],
      signal,
    );
    state = mergeState(state, plist.state);
    if (plist.state !== "complete") continue;
    const metadata = parseJsonObject(plist.stdout);
    const args = metadata?.ProgramArguments;
    const targetPath = metadataString(metadata, "Program") ??
      (Array.isArray(args) && typeof args[0] === "string" ? args[0] : null);
    if (targetPath === null) {
      state = mergeState(state, "parse_loss");
      continue;
    }
    const executable = await fileIdentity(filesystem, targetPath, signal);
    state = mergeState(state, executable.state);
    if (executable.identity === null) continue;
    records.push({
      localId: digest("cmc:macos:startup-local:v1", path),
      executableFingerprint: executable.identity.executableFingerprint,
    });
  }
  if (inventory.paths.length > MAX_SOURCE_RECORDS) {
    state = mergeState(state, "truncated");
  }
  return sourceCapture(records, state, startedAt, now);
}

async function collectReceipts(
  commands: CommandRunner,
  candidate: ProductionCandidateIdentityRecord,
  signal: AbortSignal,
  now: () => string,
): Promise<ReceiptCapture> {
  const startedAt = now();
  const command = await runCommand(
    commands,
    "/usr/sbin/pkgutil",
    ["--file-info", candidate.filesystem.canonicalPath],
    signal,
  );
  if (command.state !== "complete") {
    return {
      capture: sourceCapture([], command.state, startedAt, now),
      packageIdentifiers: [],
    };
  }
  const packageIdentifiers = [...new Set(command.stdout
    .split(/\r?\n/u)
    .map((line) => line.match(/^(?:package-id|pkgid):\s*(\S+)$/u)?.[1])
    .filter((value): value is string => value !== undefined))].sort();
  const records = packageIdentifiers.map((packageIdentifier) => ({
    localId: digest("cmc:macos:receipt-local:v1", packageIdentifier),
    packageIdentifier,
    targetFilesystemFingerprint: candidate.filesystem.fingerprint,
  }));
  return {
    capture: sourceCapture(
      records,
      packageIdentifiers.length === 0 ? "partial_inventory" : "complete",
      startedAt,
      now,
    ),
    packageIdentifiers,
  };
}

async function collectOfficialUninstallers(
  filesystem: MacOSCorrelationReadOnlyFileSystem,
  candidateApp: CollectedApp,
  candidate: ProductionCandidateIdentityRecord,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionOfficialUninstallerRecord>> {
  const startedAt = now();
  const declared = metadataString(
    candidateApp.metadata,
    "CodexMacCleanerOfficialUninstallerExecutable",
  );
  if (declared === null) {
    return sourceCapture([], "partial_inventory", startedAt, now);
  }
  const bundle = candidate.bundle;
  const signing = candidate.signing;
  const executablePath = declared.startsWith("/")
    ? declared
    : join(candidate.filesystem.canonicalPath, "Contents", "MacOS", declared);
  const executable = await fileIdentity(filesystem, executablePath, signal);
  if (bundle === undefined || signing === undefined || executable.identity === null) {
    return sourceCapture(
      [],
      mergeState("parse_loss", executable.state),
      startedAt,
      now,
    );
  }
  return sourceCapture([{
    localId: digest("cmc:macos:uninstaller-local:v1", executablePath),
    bundleIdentifier: bundle.bundleIdentifier,
    designatedRequirement: signing.designatedRequirement,
    executableFingerprint: executable.identity.executableFingerprint,
  }], "complete", startedAt, now);
}

function otoolDependencies(stdout: string): readonly string[] | null {
  const lines = stdout.split(/\r?\n/u).slice(1).map((line) => line.trim()).filter(Boolean);
  const values: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s+\(compatibility version /u);
    if (!match) return null;
    values.push(match[1]!);
  }
  return values;
}

async function collectDependencies(
  commands: CommandRunner,
  installed: InstalledCapture,
  candidateExecutablePath: string | null,
  candidateExecutableFingerprint: string | undefined,
  signal: AbortSignal,
  now: () => string,
): Promise<ProductionSourceCapture<ProductionDependencyRecord>> {
  const startedAt = now();
  if (installed.capture.state !== "complete") {
    return sourceCapture([], installed.capture.state, startedAt, now);
  }
  if (
    candidateExecutablePath === null ||
    candidateExecutableFingerprint === undefined
  ) {
    return sourceCapture([], "parse_loss", startedAt, now);
  }
  const records: ProductionDependencyRecord[] = [];
  let state: RawQueryState = "complete";
  for (const app of installed.apps) {
    if (app.executablePath === null || app.executablePath === candidateExecutablePath) {
      continue;
    }
    const command = await runCommand(
      commands,
      "/usr/bin/otool",
      ["-L", app.executablePath],
      signal,
    );
    state = mergeState(state, command.state);
    if (command.state !== "complete") continue;
    const dependencies = otoolDependencies(command.stdout);
    if (dependencies === null) {
      state = mergeState(state, "parse_loss");
      continue;
    }
    if (dependencies.includes(candidateExecutablePath)) {
      records.push({
        localId: digest("cmc:macos:dependency-local:v1", app.executablePath),
        dependeeExecutableFingerprint: candidateExecutableFingerprint,
        relationFingerprint: digest("cmc:macos:dependency-relation:v1", {
          dependent: app.executablePath,
          dependee: candidateExecutablePath,
        }),
      });
    }
  }
  return sourceCapture(
    records,
    records.length === 0 && state === "complete" ? "partial_inventory" : state,
    startedAt,
    now,
  );
}

async function collectCycle(
  dependencies: Required<Pick<
    CreateMacOSProductionCorrelationAdapterInput,
    "commands" | "candidates" | "filesystem" | "now"
  >>,
  candidateRef: string,
  signal: AbortSignal,
): Promise<CollectionCycle> {
  const location = await dependencies.candidates.resolve(candidateRef, signal);
  if (location === null) {
    throw new CorrelationInputError("CORRELATION_MISSING");
  }
  const candidateApp = await collectApp(
    dependencies.commands,
    dependencies.filesystem,
    location.candidatePath,
    signal,
  );
  const candidateFilesystem = candidateApp.record.filesystem;
  if (candidateFilesystem === undefined) {
    const error = candidateApp.state === "permission_denied"
      ? "PERMISSION_DENIED"
      : candidateApp.state === "capability_missing"
        ? "CORRELATION_MISSING"
        : "CORRELATION_SCHEMA_UNSUPPORTED";
    throw new CorrelationInputError(error);
  }
  const baseCandidate: ProductionCandidateIdentityRecord = {
    ...candidateApp.record,
    filesystem: candidateFilesystem,
  };
  const [installed, processes, openFiles, startupTargets, receiptResult] =
    await Promise.all([
      collectInstalledApps(
        dependencies.commands,
        dependencies.filesystem,
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
        location.userHome,
        signal,
        dependencies.now,
      ),
      collectReceipts(
        dependencies.commands,
        baseCandidate,
        signal,
        dependencies.now,
      ),
    ] as const);
  const candidate: ProductionCandidateIdentityRecord =
    receiptResult.packageIdentifiers.length === 1
      ? {
          ...baseCandidate,
          packageIdentifier: receiptResult.packageIdentifiers[0]!,
        }
      : baseCandidate;
  const targetExecutables = sourceCapture<ProductionTargetExecutableRecord>(
    candidate.executableFingerprint === undefined
      ? []
      : [{
          localId: digest("cmc:macos:target-executable-local:v1", candidateRef),
          executableFingerprint: candidate.executableFingerprint,
        }],
    candidate.executableFingerprint === undefined ? "parse_loss" : "complete",
    dependencies.now(),
    dependencies.now,
  );
  const [officialUninstallers, dependenciesCapture] = await Promise.all([
    collectOfficialUninstallers(
      dependencies.filesystem,
      candidateApp,
      candidate,
      signal,
      dependencies.now,
    ),
    collectDependencies(
      dependencies.commands,
      installed,
      candidateApp.executablePath,
      candidate.executableFingerprint,
      signal,
      dependencies.now,
    ),
  ] as const);
  const parent = await fileIdentity(
    dependencies.filesystem,
    dirname(candidate.filesystem.canonicalPath),
    signal,
  );
  if (parent.identity === null) {
    const error = parent.state === "permission_denied"
      ? "PERMISSION_DENIED"
      : "CORRELATION_SNAPSHOT_STALE";
    throw new CorrelationInputError(error);
  }
  const snapshot: ProductionCorrelationSnapshotRecord = {
    candidateFingerprint: candidate.filesystem.fingerprint,
    parentFingerprint: parent.identity.filesystem.fingerprint,
    ownerTypeFingerprint: digest("cmc:macos:owner-type:v1", {
      uid: candidate.filesystem.uid,
      gid: candidate.filesystem.gid,
      fileType: candidate.filesystem.fileType,
    }),
    executableFingerprint: candidate.executableFingerprint ??
      digest("cmc:macos:missing-executable:v1", candidate.filesystem.fingerprint),
    processFingerprint: digest(
      "cmc:macos:process-snapshot:v1",
      snapshotMaterial(processes),
    ),
    openFileFingerprint: digest(
      "cmc:macos:open-file-snapshot:v1",
      snapshotMaterial(openFiles),
    ),
    receiptFingerprint: digest(
      "cmc:macos:receipt-snapshot:v1",
      snapshotMaterial(receiptResult.capture),
    ),
    dependencyFingerprint: digest(
      "cmc:macos:dependency-snapshot:v1",
      snapshotMaterial(dependenciesCapture),
    ),
  };
  return {
    candidate,
    installed: installed.capture,
    processes,
    openFiles,
    startupTargets,
    targetExecutables,
    receipts: receiptResult.capture,
    officialUninstallers,
    dependencies: dependenciesCapture,
    snapshot,
  };
}

function requireCycle(value: CollectionCycle | undefined): CollectionCycle {
  if (value === undefined) {
    throw new CorrelationInputError("CORRELATION_SCHEMA_UNSUPPORTED");
  }
  return value;
}

/**
 * Concrete package-owned macOS collector. Caller передаёт только CommandRunner,
 * opaque candidate registry и, при необходимости, low-level read-only filesystem.
 */
export function createMacOSProductionCorrelationAdapter(
  input: CreateMacOSProductionCorrelationAdapterInput,
): ProductionCorrelationAdapter {
  const commandTimeoutMs = input.commandTimeoutMs ?? 30_000;
  const dependencies = {
    commands: withCommandTimeout(input.commands, commandTimeoutMs),
    candidates: input.candidates,
    filesystem: input.filesystem ?? createNodeMacOSCorrelationReadOnlyFileSystem(),
    now: input.now ?? (() => new Date().toISOString()),
  } as const;
  return Object.freeze({
    async buildInput(
      buildInput: Parameters<ProductionCorrelationAdapter["buildInput"]>[0],
    ): Promise<EphemeralCorrelationInput> {
      let phaseA: CollectionCycle | undefined;
      const commandBoundary: ProductionCorrelationCommandBoundary = {
        installedApps: async () => requireCycle(phaseA).installed,
        processes: async () => requireCycle(phaseA).processes,
        openFiles: async () => requireCycle(phaseA).openFiles,
      };
      const filesystemBoundary: ProductionCorrelationFilesystemBoundary = {
        async captureCandidate(candidateRef, phase, signal): Promise<ProductionCandidateCapture> {
          const cycle = await collectCycle(
            dependencies,
            candidateRef,
            signal,
          );
          if (phase === "A") phaseA = cycle;
          return { candidate: cycle.candidate, snapshot: cycle.snapshot };
        },
        startupTargets: async () => requireCycle(phaseA).startupTargets,
        targetExecutables: async () => requireCycle(phaseA).targetExecutables,
        receipts: async () => requireCycle(phaseA).receipts,
        officialUninstallers: async () => requireCycle(phaseA).officialUninstallers,
        dependencies: async () => requireCycle(phaseA).dependencies,
      };
      return buildProductionCorrelationInput({
        ...buildInput,
        commandBoundary,
        filesystemBoundary,
      });
    },
  });
}

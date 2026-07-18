import { lstat, open, rename } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import type { PathFileType, SnapshotFingerprint } from "@codex-mac-cleaner/policy";

import { QuarantineError } from "./errors.js";

export interface FileSystemOperations {
  rename(source: string, destination: string): Promise<void>;
}

export const nodeFileSystem: FileSystemOperations = { rename };

export interface InspectMoveSourceInput {
  readonly allowedRoot: string;
  readonly sourcePath: string;
}

export interface ObservedMoveState {
  readonly sourceFingerprint: SnapshotFingerprint;
  readonly sourceParentFingerprint: SnapshotFingerprint;
}

function fileTypeOf(stats: Awaited<ReturnType<typeof lstat>>): PathFileType {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  return "unknown";
}

export async function captureFingerprint(
  path: string,
): Promise<SnapshotFingerprint> {
  let stats: Awaited<ReturnType<typeof lstat>>;
  try {
    stats = await lstat(path, { bigint: true });
  } catch (error) {
    throw new QuarantineError("SOURCE_CHANGED", { cause: error });
  }
  const device = stats.dev.toString();
  return {
    device,
    inode: stats.ino.toString(),
    mode: Number(stats.mode),
    uid: Number(stats.uid),
    gid: Number(stats.gid),
    size: Number(stats.size),
    mtimeNs: stats.mtimeNs.toString(),
    ctimeNs: stats.ctimeNs.toString(),
    fileType: fileTypeOf(stats),
    mountId: `device:${device}`,
    symbolicLink: stats.isSymbolicLink(),
    linkCount: Number(stats.nlink),
  };
}

export function fingerprintsEqual(
  expected: SnapshotFingerprint,
  current: SnapshotFingerprint,
): boolean {
  return (
    expected.device === current.device &&
    expected.inode === current.inode &&
    expected.mode === current.mode &&
    expected.uid === current.uid &&
    expected.gid === current.gid &&
    expected.size === current.size &&
    expected.mtimeNs === current.mtimeNs &&
    expected.ctimeNs === current.ctimeNs &&
    expected.fileType === current.fileType &&
    expected.mountId === current.mountId &&
    expected.symbolicLink === current.symbolicLink &&
    expected.linkCount === current.linkCount
  );
}

function validateRawPath(path: string): void {
  const components = path.slice(1).split(sep);
  if (
    !isAbsolute(path) ||
    path.includes("\u0000") ||
    components.some(
      (component, index) =>
        component === "." ||
        component === ".." ||
        (component === "" && index < components.length - 1),
    )
  ) {
    throw new QuarantineError("PATH_OUTSIDE_ALLOWLIST");
  }
}

function ancestryPaths(root: string, source: string): string[] {
  const fromRoot = relative(root, source);
  if (
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new QuarantineError("PATH_OUTSIDE_ALLOWLIST");
  }
  const parts = fromRoot.split(sep).filter(Boolean);
  return [root, ...parts.map((_, index) => join(root, ...parts.slice(0, index + 1)))];
}

export async function inspectMoveSource(
  input: InspectMoveSourceInput,
): Promise<ObservedMoveState> {
  validateRawPath(input.allowedRoot);
  validateRawPath(input.sourcePath);
  const root = resolve(input.allowedRoot);
  const source = resolve(input.sourcePath);
  const ancestry = ancestryPaths(root, source);
  let rootDevice: string | undefined;

  for (const [index, path] of ancestry.entries()) {
    const fingerprint = await captureFingerprint(path);
    if (fingerprint.symbolicLink) {
      throw new QuarantineError("SYMLINK_BOUNDARY");
    }
    if (fingerprint.fileType === "unknown") {
      throw new QuarantineError("SOURCE_CHANGED");
    }
    if (index < ancestry.length - 1 && fingerprint.fileType !== "directory") {
      throw new QuarantineError("PATH_OUTSIDE_ALLOWLIST");
    }
    rootDevice ??= fingerprint.device;
    if (fingerprint.device !== rootDevice) {
      throw new QuarantineError("CROSS_VOLUME");
    }
    if (
      index === ancestry.length - 1 &&
      fingerprint.fileType === "file" &&
      fingerprint.linkCount > 1
    ) {
      throw new QuarantineError("SYMLINK_BOUNDARY");
    }
  }

  return {
    sourceFingerprint: await captureFingerprint(source),
    sourceParentFingerprint: await captureFingerprint(
      ancestry[ancestry.length - 2] as string,
    ),
  };
}

export async function pathExistsNoFollow(path: string): Promise<boolean> {
  return lstat(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw new QuarantineError("INTERNAL_ERROR", { cause: error });
    },
  );
}

export async function syncDirectory(path: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    throw new QuarantineError("INTERNAL_ERROR", { cause: error });
  } finally {
    await handle?.close();
  }
}

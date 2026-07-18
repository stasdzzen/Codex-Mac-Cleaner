import { posix } from "node:path";

import type {
  PathAncestryEntry,
  PathGuardInput,
  PathValidationResult,
} from "./types.js";

function hasTraversal(value: string): boolean {
  return value.split("/").some((component) => component === "..");
}

function hasEmptyIntermediateComponent(value: string): boolean {
  return value.slice(1).split("/").slice(0, -1).some((component) => component === "");
}

function expectedAncestry(root: string, candidate: string): string[] {
  const relative = posix.relative(root, candidate);
  const components = relative.split("/").filter(Boolean);
  return [
    root,
    ...components.map((_, index) =>
      posix.join(root, ...components.slice(0, index + 1)),
    ),
  ];
}

function validateEntry(
  entry: PathAncestryEntry,
  input: PathGuardInput,
  final: boolean,
): PathValidationResult | undefined {
  if (entry.symbolicLink) return { ok: false, errorCode: "SYMLINK_BOUNDARY" };
  if (entry.mountPoint) return { ok: false, errorCode: "MOUNT_POINT_DETECTED" };
  if (entry.uid !== input.expectedOwnerUid) {
    return { ok: false, errorCode: "PATH_OWNER_MISMATCH" };
  }
  if (
    entry.device !== input.expectedDevice ||
    entry.mountId !== input.expectedMountId
  ) {
    return { ok: false, errorCode: "CROSS_VOLUME" };
  }
  if (entry.gitMarker !== null) {
    return { ok: false, errorCode: "PROTECT_LOCAL_GIT_REPOSITORY" };
  }
  if (!final && entry.fileType !== "directory" && entry.fileType !== "bundle") {
    return { ok: false, errorCode: "PATH_ANCESTRY_NOT_DIRECTORY" };
  }
  if (
    final &&
    (entry.fileType === "unknown" || input.expectedFileType === "unknown")
  ) {
    return { ok: false, errorCode: "PATH_UNKNOWN_FILE_TYPE" };
  }
  if (final && entry.fileType !== input.expectedFileType) {
    return { ok: false, errorCode: "PATH_TYPE_MISMATCH" };
  }
  if (
    final &&
    (entry.fileType === "file" || entry.fileType === "plist") &&
    entry.linkCount > 1
  ) {
    return { ok: false, errorCode: "HARDLINK_ANOMALY" };
  }
  return undefined;
}

export function validateMutationPath(input: PathGuardInput): PathValidationResult {
  if (input.root.includes("\u0000") || input.candidate.includes("\u0000")) {
    return { ok: false, errorCode: "PATH_NUL" };
  }
  if (!posix.isAbsolute(input.root) || !posix.isAbsolute(input.candidate)) {
    return { ok: false, errorCode: "PATH_NOT_ABSOLUTE" };
  }
  if (hasTraversal(input.root) || hasTraversal(input.candidate)) {
    return { ok: false, errorCode: "PATH_TRAVERSAL" };
  }
  if (
    hasEmptyIntermediateComponent(input.root) ||
    hasEmptyIntermediateComponent(input.candidate)
  ) {
    return { ok: false, errorCode: "PATH_INVALID" };
  }

  const root = posix.normalize(input.root);
  const candidate = posix.normalize(input.candidate);
  const relative = posix.relative(root, candidate);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith("../") ||
    posix.isAbsolute(relative)
  ) {
    return { ok: false, errorCode: "PATH_OUTSIDE_ALLOWLIST" };
  }

  const expected = expectedAncestry(root, candidate);
  if (
    input.ancestry.length !== expected.length ||
    input.ancestry.some(
      (entry, index) => posix.normalize(entry.canonicalPath) !== expected[index],
    )
  ) {
    return { ok: false, errorCode: "PATH_ANCESTRY_INCOMPLETE" };
  }

  for (const [index, entry] of input.ancestry.entries()) {
    const failure = validateEntry(entry, input, index === input.ancestry.length - 1);
    if (failure !== undefined) return failure;
  }
  return { ok: true, canonicalPath: candidate };
}

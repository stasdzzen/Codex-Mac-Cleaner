import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type {
  AdapterFileEntry,
  FileSystemFacade,
  LibraryRoot,
  TargetedRecord,
} from "../src/index.js";

export class SyntheticFileSystem implements FileSystemFacade {
  readonly libraryCalls: LibraryRoot[] = [];
  readonly targetedCalls: string[] = [];

  constructor(
    private readonly roots: Readonly<Partial<Record<LibraryRoot, readonly AdapterFileEntry[]>>> = {},
    private readonly targeted: Readonly<Record<string, readonly TargetedRecord[]>> = {},
    private readonly deniedRoots: ReadonlySet<LibraryRoot> = new Set(),
  ) {}

  async listLibraryRoot(root: LibraryRoot, signal: AbortSignal): Promise<readonly AdapterFileEntry[]> {
    signal.throwIfAborted();
    this.libraryCalls.push(root);
    if (this.deniedRoots.has(root)) {
      throw Object.assign(new Error("Operation not permitted"), { code: "EACCES" });
    }
    return this.roots[root] ?? [];
  }

  async listTargetedSource(kind: string, signal: AbortSignal): Promise<readonly TargetedRecord[]> {
    signal.throwIfAborted();
    this.targetedCalls.push(kind);
    return this.targeted[kind] ?? [];
  }
}

export async function snapshotFixtureTree(root: string): Promise<Readonly<Record<string, string>>> {
  const result: Record<string, string> = {};
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      const metadata = await stat(path);
      const payload = await readFile(path);
      result[relative(root, path)] = createHash("sha256")
        .update(payload)
        .update(String(metadata.mode))
        .update(String(metadata.size))
        .update(String(metadata.mtimeMs))
        .digest("hex");
    }
  };
  await visit(root);
  return result;
}

import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  parse,
  relative,
  resolve,
  sep,
} from "node:path";

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export type JsonStoreErrorCode =
  | "PATH_OUTSIDE_STORE"
  | "SYMLINK_BOUNDARY"
  | "INVALID_JSON_VALUE"
  | "CORRUPT_STATE"
  | "STATE_UNAVAILABLE"
  | "STORE_IO_FAILURE";

export class JsonStoreError extends Error {
  readonly failClosed = true;

  constructor(readonly code: JsonStoreErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "JsonStoreError";
  }
}

function serializeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError("JSON value is undefined");
    return serialized;
  } catch (error) {
    throw new JsonStoreError("INVALID_JSON_VALUE", { cause: error });
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function isInside(parent: string, target: string): boolean {
  const fromParent = relative(parent, target);
  return (
    fromParent === "" ||
    (fromParent !== ".." &&
      !fromParent.startsWith(`..${sep}`) &&
      !isAbsolute(fromParent))
  );
}

function normalizeRoot(root: string): { readonly root: string; readonly anchor: string } {
  const absoluteRoot = resolve(root);
  const trustedPrefix = [resolve(homedir()), resolve(tmpdir())]
    .filter((candidate) => isInside(candidate, absoluteRoot))
    .sort((left, right) => right.length - left.length)[0];
  if (trustedPrefix === undefined) {
    return { root: absoluteRoot, anchor: parse(absoluteRoot).root };
  }
  const canonicalPrefix = realpathSync.native(trustedPrefix);
  return {
    root: resolve(canonicalPrefix, relative(trustedPrefix, absoluteRoot)),
    anchor: canonicalPrefix,
  };
}

export class JsonStore {
  readonly root: string;
  private readonly rootAnchor: string;

  constructor(root: string) {
    if (!isAbsolute(root)) {
      throw new JsonStoreError("PATH_OUTSIDE_STORE");
    }
    const normalized = normalizeRoot(root);
    this.root = normalized.root;
    this.rootAnchor = normalized.anchor;
  }

  private resolveRelative(relativePath: string): string {
    if (!relativePath || isAbsolute(relativePath)) {
      throw new JsonStoreError("PATH_OUTSIDE_STORE");
    }

    const target = resolve(this.root, relativePath);
    const fromRoot = relative(this.root, target);
    if (
      fromRoot === ".." ||
      fromRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromRoot)
    ) {
      throw new JsonStoreError("PATH_OUTSIDE_STORE");
    }
    return target;
  }

  private async assertNotSymlink(path: string): Promise<void> {
    try {
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) {
        throw new JsonStoreError("SYMLINK_BOUNDARY");
      }
    } catch (error) {
      if (error instanceof JsonStoreError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw new JsonStoreError("STORE_IO_FAILURE", { cause: error });
    }
  }

  private async assertSecureTarget(target: string): Promise<void> {
    await this.assertSecureRootPath();
    const fromRoot = relative(this.root, target);
    if (!fromRoot) return;
    let current = this.root;
    for (const component of fromRoot.split(sep)) {
      current = resolve(current, component);
      await this.assertNotSymlink(current);
    }
  }

  private async assertSecureRootPath(): Promise<void> {
    await this.assertNotSymlink(this.rootAnchor);
    const fromAnchor = relative(this.rootAnchor, this.root);
    let current = this.rootAnchor;
    for (const component of fromAnchor ? fromAnchor.split(sep) : []) {
      current = resolve(current, component);
      await this.assertNotSymlink(current);
    }
  }

  private async ensureRootDirectory(): Promise<void> {
    const fromAnchor = relative(this.rootAnchor, this.root);
    let current = this.rootAnchor;
    for (const component of fromAnchor ? fromAnchor.split(sep) : []) {
      current = resolve(current, component);
      let created = false;
      await this.assertNotSymlink(current);
      await mkdir(current, { mode: 0o700 })
        .then(() => {
          created = true;
        })
        .catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error;
        });
      await this.assertNotSymlink(current);
      if (created || current === this.root) await chmod(current, 0o700);
    }
  }

  async ensureDirectory(relativeDirectory = "."): Promise<string> {
    const directory = this.resolveRelative(relativeDirectory);
    try {
      await this.assertSecureRootPath();
      await this.ensureRootDirectory();

      const fromRoot = relative(this.root, directory);
      let current = this.root;
      for (const component of fromRoot ? fromRoot.split(sep) : []) {
        current = resolve(current, component);
        await this.assertNotSymlink(current);
        await mkdir(current, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "EEXIST") throw error;
        });
        await this.assertNotSymlink(current);
        await chmod(current, 0o700);
      }
      return directory;
    } catch (error) {
      if (error instanceof JsonStoreError) throw error;
      throw new JsonStoreError("STORE_IO_FAILURE", { cause: error });
    }
  }

  async writeJsonAtomic(relativePath: string, value: unknown): Promise<void> {
    const target = this.resolveRelative(relativePath);
    const parent = await this.ensureDirectory(relative(this.root, dirname(target)) || ".");
    const temporary = resolve(parent, `.${basename(target)}.tmp-${randomUUID()}`);
    const payload = `${serializeJson(value)}\n`;
    let temporaryExists = false;

    try {
      await this.assertSecureTarget(target);
      const handle = await open(temporary, "wx", 0o600);
      temporaryExists = true;
      try {
        await handle.writeFile(payload, { encoding: "utf8" });
        await handle.sync();
      } finally {
        await handle.close();
      }
      await chmod(temporary, 0o600);
      await rename(temporary, target);
      temporaryExists = false;
      await chmod(target, 0o600);
      await syncDirectory(parent);
    } catch (error) {
      if (temporaryExists) {
        await unlink(temporary).catch(() => undefined);
      }
      if (error instanceof JsonStoreError) throw error;
      throw new JsonStoreError("STORE_IO_FAILURE", { cause: error });
    }
  }

  async appendEvent(relativePath: string, event: unknown): Promise<void> {
    const target = this.resolveRelative(relativePath);
    await this.ensureDirectory(relative(this.root, dirname(target)) || ".");
    const line = `${serializeJson(event)}\n`;

    try {
      await this.assertSecureTarget(target);
      const handle = await open(target, "a", 0o600);
      try {
        await handle.chmod(0o600);
        await handle.writeFile(line, { encoding: "utf8" });
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error instanceof JsonStoreError) throw error;
      throw new JsonStoreError("STORE_IO_FAILURE", { cause: error });
    }
  }

  async readJson<T>(relativePath: string, schema: RuntimeSchema<T>): Promise<T> {
    const target = this.resolveRelative(relativePath);
    let payload: string;
    try {
      await this.assertSecureTarget(target);
      payload = await readFile(target, "utf8");
    } catch (error) {
      if (error instanceof JsonStoreError) throw error;
      throw new JsonStoreError("STATE_UNAVAILABLE", { cause: error });
    }

    try {
      return schema.parse(JSON.parse(payload));
    } catch (error) {
      throw new JsonStoreError("CORRUPT_STATE", { cause: error });
    }
  }

  async listTemporarySiblings(relativePath: string): Promise<string[]> {
    const target = this.resolveRelative(relativePath);
    const parent = dirname(target);
    const prefix = `.${basename(target)}.tmp-`;
    try {
      await this.assertSecureTarget(parent);
      return (await readdir(parent)).filter((entry) => entry.startsWith(prefix)).sort();
    } catch (error) {
      if (error instanceof JsonStoreError) throw error;
      throw new JsonStoreError("STATE_UNAVAILABLE", { cause: error });
    }
  }
}

import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export type JsonStoreErrorCode =
  | "PATH_OUTSIDE_STORE"
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

export class JsonStore {
  readonly root: string;

  constructor(root: string) {
    if (!isAbsolute(root)) {
      throw new JsonStoreError("PATH_OUTSIDE_STORE");
    }
    this.root = resolve(root);
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

  async ensureDirectory(relativeDirectory = "."): Promise<string> {
    const directory = this.resolveRelative(relativeDirectory);
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      let current = directory;
      while (current === this.root || current.startsWith(`${this.root}${sep}`)) {
        await chmod(current, 0o700);
        if (current === this.root) break;
        current = dirname(current);
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
      payload = await readFile(target, "utf8");
    } catch (error) {
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
      return (await readdir(parent)).filter((entry) => entry.startsWith(prefix)).sort();
    } catch (error) {
      throw new JsonStoreError("STATE_UNAVAILABLE", { cause: error });
    }
  }
}

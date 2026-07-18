import { createHash, createHmac, randomBytes } from "node:crypto";

import { JsonStore, JsonStoreError, type RuntimeSchema } from "./json-store.js";

const KEY_PATH = "keys/exclusion-hmac-key.json";
const BASE64_PATTERN = /^[A-Za-z0-9+/]{43}=$/u;
const keyMaterial = new WeakMap<InstallationKey, Buffer>();

interface InstallationKeyFile {
  readonly schemaVersion: 1;
  readonly algorithm: "HMAC-SHA-256";
  readonly keyId: string;
  readonly encodedKey: string;
}

const InstallationKeyFileSchema: RuntimeSchema<InstallationKeyFile> = {
  parse(value: unknown): InstallationKeyFile {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).sort().join("\u0000") !==
        ["algorithm", "encodedKey", "keyId", "schemaVersion"].join("\u0000") ||
      Reflect.get(value, "schemaVersion") !== 1 ||
      Reflect.get(value, "algorithm") !== "HMAC-SHA-256" ||
      typeof Reflect.get(value, "keyId") !== "string" ||
      !/^key-[a-f0-9]{24}$/u.test(Reflect.get(value, "keyId") as string) ||
      typeof Reflect.get(value, "encodedKey") !== "string" ||
      !BASE64_PATTERN.test(Reflect.get(value, "encodedKey") as string)
    ) {
      throw new TypeError("Invalid installation key file");
    }
    const parsed = value as unknown as InstallationKeyFile;
    const key = Buffer.from(parsed.encodedKey, "base64");
    if (key.byteLength !== 32 || key.toString("base64") !== parsed.encodedKey) {
      throw new TypeError("Installation key должен содержать 256 bits");
    }
    const expectedKeyId = `key-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    if (parsed.keyId !== expectedKeyId) {
      throw new TypeError("Installation key ID mismatch");
    }
    return parsed;
  },
};

export type InstallationKeyErrorCode =
  | "CORRELATION_KEY_UNAVAILABLE"
  | "CORRELATION_SCHEMA_UNSUPPORTED";

export class InstallationKeyError extends Error {
  readonly failClosed = true;

  constructor(readonly code: InstallationKeyErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "InstallationKeyError";
  }
}

function framed(parts: readonly string[]): string {
  return parts.map((part) => `${Buffer.byteLength(part, "utf8")}:${part}`).join("|");
}

export class InstallationKey {
  readonly derivationVersion = 1;
  readonly keyId: string;

  constructor(key: Uint8Array) {
    if (key.byteLength !== 32) {
      throw new TypeError("Installation key должен содержать 256 bits");
    }
    const material = Buffer.from(key);
    keyMaterial.set(this, material);
    this.keyId = `key-${createHash("sha256")
      .update(material)
      .digest("hex")
      .slice(0, 24)}`;
    Object.freeze(this);
  }

  derive(
    domain: string,
    kind: string,
    normalizedValue: string,
  ): `hmac-sha256:v1:${string}` {
    if (!domain || !kind || !normalizedValue) {
      throw new TypeError("HMAC derivation требует domain, kind и value");
    }
    const material = framed([
      "codex-mac-cleaner",
      `derivation-v${this.derivationVersion}`,
      "normalization-v1",
      domain,
      kind,
      normalizedValue.normalize("NFC"),
    ]);
    return `hmac-sha256:v1:${createHmac("sha256", keyMaterial.get(this)!)
      .update(material)
      .digest("hex")}`;
  }

  toJSON(): never {
    throw new TypeError("Installation key нельзя сериализовать");
  }

  toString(): string {
    return "[InstallationKey redacted]";
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString();
  }

}

export interface InstallationKeyStoreOptions {
  readonly stateRoot: string;
  readonly randomKey?: () => Uint8Array;
}

function missingState(error: JsonStoreError): boolean {
  return error.code === "STATE_UNAVAILABLE" &&
    (error.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

export class InstallationKeyStore {
  private readonly store: JsonStore;
  private readonly randomKey: () => Uint8Array;

  constructor(options: InstallationKeyStoreOptions) {
    this.store = new JsonStore(options.stateRoot);
    this.randomKey = options.randomKey ?? (() => randomBytes(32));
  }

  private async writeNew(material: Uint8Array = this.randomKey()): Promise<InstallationKey> {
    const key = new InstallationKey(material);
    await this.store.writeJsonAtomic(KEY_PATH, {
      schemaVersion: 1,
      algorithm: "HMAC-SHA-256",
      keyId: key.keyId,
      encodedKey: keyMaterial.get(key)!.toString("base64"),
    } satisfies InstallationKeyFile);
    return key;
  }

  async loadExisting(): Promise<InstallationKey> {
    let file: InstallationKeyFile;
    try {
      file = await this.store.readJson(KEY_PATH, InstallationKeyFileSchema);
    } catch (error) {
      if (error instanceof JsonStoreError && missingState(error)) {
        throw new InstallationKeyError("CORRELATION_KEY_UNAVAILABLE", {
          cause: error,
        });
      }
      throw new InstallationKeyError("CORRELATION_SCHEMA_UNSUPPORTED", {
        cause: error,
      });
    }
    return new InstallationKey(Buffer.from(file.encodedKey, "base64"));
  }

  async loadOrCreate(): Promise<InstallationKey> {
    try {
      return await this.loadExisting();
    } catch (error) {
      if (
        error instanceof InstallationKeyError &&
        error.code === "CORRELATION_KEY_UNAVAILABLE"
      ) {
        return this.writeNew();
      }
      throw error;
    }
  }

  async rotate(): Promise<InstallationKey> {
    return this.writeNew();
  }

  async restoreFromBackup(material: Uint8Array): Promise<InstallationKey> {
    return this.writeNew(material);
  }
}

import { JsonStore, JsonStoreError, type RuntimeSchema } from "./json-store.js";

const HISTORY_PATH = "correlation/owner-binding-history.json";
const DIGEST = /^hmac-sha256:v1:[a-f0-9]{64}$/u;

export interface KeyedOwnerBindingHistoryRecord {
  readonly keyId: string;
  readonly derivationVersion: number;
  readonly artifactDigest: `hmac-sha256:v1:${string}`;
  readonly ownerTypeDigest: `hmac-sha256:v1:${string}`;
  readonly rootDigest: `hmac-sha256:v1:${string}`;
  readonly ownerBundleDigest: `hmac-sha256:v1:${string}`;
  readonly ownerSigningDigest: `hmac-sha256:v1:${string}`;
  readonly ownerExecutableDigest: `hmac-sha256:v1:${string}`;
  readonly bindingFingerprint: string;
  readonly provenanceClass: "signed_process_open_file_history";
  readonly lastValidatedAt: string;
}

interface HistoryFile {
  readonly schemaVersion: 1;
  readonly records: readonly KeyedOwnerBindingHistoryRecord[];
}

function validRecord(value: unknown): value is KeyedOwnerBindingHistoryRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Partial<KeyedOwnerBindingHistoryRecord>;
  return typeof record.keyId === "string" &&
    Number.isSafeInteger(record.derivationVersion) &&
    [
      record.artifactDigest,
      record.ownerTypeDigest,
      record.rootDigest,
      record.ownerBundleDigest,
      record.ownerSigningDigest,
      record.ownerExecutableDigest,
    ].every((digest) => typeof digest === "string" && DIGEST.test(digest)) &&
    typeof record.bindingFingerprint === "string" && record.bindingFingerprint.length > 0 &&
    record.provenanceClass === "signed_process_open_file_history" &&
    typeof record.lastValidatedAt === "string" && Number.isFinite(Date.parse(record.lastValidatedAt));
}

const HistorySchema: RuntimeSchema<HistoryFile> = {
  parse(value: unknown): HistoryFile {
    if (
      typeof value !== "object" || value === null || Array.isArray(value) ||
      Reflect.get(value, "schemaVersion") !== 1 ||
      !Array.isArray(Reflect.get(value, "records")) ||
      !(Reflect.get(value, "records") as readonly unknown[]).every(validRecord)
    ) {
      throw new TypeError("Invalid owner binding history");
    }
    return value as HistoryFile;
  },
};

function missing(error: JsonStoreError): boolean {
  return error.code === "STATE_UNAVAILABLE" &&
    (error.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

export class KeyedOwnerBindingHistoryStore {
  private readonly store: JsonStore;

  constructor(stateRoot: string) {
    this.store = new JsonStore(stateRoot);
  }

  async list(): Promise<readonly KeyedOwnerBindingHistoryRecord[]> {
    try {
      return (await this.store.readJson(HISTORY_PATH, HistorySchema)).records;
    } catch (error) {
      if (error instanceof JsonStoreError && missing(error)) return [];
      throw error;
    }
  }

  async replace(records: readonly KeyedOwnerBindingHistoryRecord[]): Promise<void> {
    if (!records.every(validRecord)) throw new TypeError("Invalid owner binding history record");
    const unique = [...new Map(records.map((record) => [record.bindingFingerprint, record] as const)).values()]
      .sort((left, right) => left.bindingFingerprint.localeCompare(right.bindingFingerprint));
    await this.store.writeJsonAtomic(HISTORY_PATH, { schemaVersion: 1, records: unique } satisfies HistoryFile);
  }
}

import type { JsonStore, RuntimeSchema } from "./json-store.js";

export type VersionedStateErrorCode =
  | "INVALID_VERSIONED_STATE"
  | "UNKNOWN_SCHEMA_VERSION"
  | "MIGRATION_UNAVAILABLE"
  | "MIGRATION_FAILED";

export class VersionedStateError extends Error {
  readonly failClosed = true;

  constructor(readonly code: VersionedStateErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "VersionedStateError";
  }
}

export interface VersionMigration {
  readonly toVersion: number;
  readonly migrate: (value: Record<string, unknown>) => unknown;
}

export interface VersionedStateContract<TCurrent> {
  readonly currentVersion: number;
  readonly schemas: Readonly<Record<number, RuntimeSchema<unknown>>>;
  readonly migrations: Readonly<Record<number, VersionMigration>>;
}

function readVersion(value: unknown): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VersionedStateError("INVALID_VERSIONED_STATE");
  }
  const version = Reflect.get(value, "schemaVersion");
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new VersionedStateError("UNKNOWN_SCHEMA_VERSION");
  }
  return version as number;
}

function parseVersion(
  value: unknown,
  version: number,
  schemas: VersionedStateContract<unknown>["schemas"],
): Record<string, unknown> {
  const schema = schemas[version];
  if (!schema) throw new VersionedStateError("UNKNOWN_SCHEMA_VERSION");
  try {
    const parsed = schema.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new TypeError("Versioned state schema must return an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof VersionedStateError) throw error;
    throw new VersionedStateError("INVALID_VERSIONED_STATE", { cause: error });
  }
}

export function migrateVersionedState<TCurrent>(
  value: unknown,
  contract: VersionedStateContract<TCurrent>,
): TCurrent {
  if (
    !Number.isSafeInteger(contract.currentVersion) ||
    contract.currentVersion < 1 ||
    !contract.schemas[contract.currentVersion]
  ) {
    throw new VersionedStateError("MIGRATION_UNAVAILABLE");
  }

  let version = readVersion(value);
  if (version > contract.currentVersion || !contract.schemas[version]) {
    throw new VersionedStateError("UNKNOWN_SCHEMA_VERSION");
  }
  let current = parseVersion(value, version, contract.schemas);

  while (version < contract.currentVersion) {
    const migration = contract.migrations[version];
    if (!migration || migration.toVersion !== version + 1) {
      throw new VersionedStateError("MIGRATION_UNAVAILABLE");
    }
    try {
      current = parseVersion(migration.migrate(current), migration.toVersion, contract.schemas);
    } catch (error) {
      if (error instanceof VersionedStateError) throw error;
      throw new VersionedStateError("MIGRATION_FAILED", { cause: error });
    }
    version = migration.toVersion;
  }

  return current as TCurrent;
}

const UnknownSchema: RuntimeSchema<unknown> = { parse: (value) => value };

export class VersionedStateStore<TCurrent> {
  constructor(
    private readonly store: JsonStore,
    private readonly relativePath: string,
    private readonly contract: VersionedStateContract<TCurrent>,
  ) {}

  async read(): Promise<TCurrent> {
    const value = await this.store.readJson(this.relativePath, UnknownSchema);
    return migrateVersionedState(value, this.contract);
  }

  async write(value: TCurrent): Promise<void> {
    const parsed = parseVersion(
      value,
      this.contract.currentVersion,
      this.contract.schemas,
    ) as TCurrent;
    await this.store.writeJsonAtomic(this.relativePath, parsed);
  }
}

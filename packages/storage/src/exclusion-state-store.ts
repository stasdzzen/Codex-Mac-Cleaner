import { homedir } from "node:os";
import { join } from "node:path";

import { JsonStore, JsonStoreError, type RuntimeSchema } from "./json-store.js";
import {
  VersionedStateError,
  VersionedStateStore,
  type VersionedStateContract,
} from "./versioned-state.js";

const IDENTITY_PATTERN = /^(?:target|signing|owner-type):v1:[a-f0-9]{64}$/u;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const BUNDLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/u;
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

const ARTIFACT_KINDS = new Set([
  "file",
  "directory",
  "bundle",
  "plist",
  "launch_item",
  "receipt",
  "unknown",
]);
const REASON_CATEGORIES = new Set([
  "user_choice",
  "false_positive",
  "keep_data",
  "other",
]);

export interface StoredUserExclusion {
  readonly schemaVersion: 1;
  readonly exclusionId: string;
  readonly ruleId: string;
  readonly artifactKind:
    | "file"
    | "directory"
    | "bundle"
    | "plist"
    | "launch_item"
    | "receipt"
    | "unknown";
  readonly normalizedTargetIdentity: string;
  readonly bundleId?: string | null;
  readonly packageId?: string | null;
  readonly signingIdentity?: string | null;
  readonly ownerTypeFingerprint: string;
  readonly createdAt: string;
  readonly reasonCategory:
    | "user_choice"
    | "false_positive"
    | "keep_data"
    | "other";
}

export interface ExclusionState<TExclusion> {
  readonly schemaVersion: 2;
  readonly stateVersion: number;
  readonly updatedAt: string;
  readonly exclusions: readonly TExclusion[];
}

export type ExclusionResetResult<TExclusion> =
  | Readonly<{
      status: "reset";
      state: ExclusionState<TExclusion>;
      removedCount: number;
    }>
  | Readonly<{ status: "stale"; stateVersion: number }>;

export type ExclusionStateStoreErrorCode =
  | "EXCLUSION_STATE_INVALID"
  | "EXCLUSION_NOT_FOUND";

export class ExclusionStateStoreError extends Error {
  readonly failClosed = true;

  constructor(readonly code: ExclusionStateStoreErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "ExclusionStateStoreError";
  }
}

export interface ExclusionStateStoreOptions<TExclusion> {
  readonly stateRoot?: string;
  readonly homeDirectory?: string;
  readonly now?: () => Date;
  readonly exclusionSchema?: RuntimeSchema<TExclusion>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isOpaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    OPAQUE_ID_PATTERN.test(value)
  );
}

const StoredUserExclusionSchema: RuntimeSchema<StoredUserExclusion> = {
  parse(value: unknown): StoredUserExclusion {
    if (
      !isRecord(value) ||
      !hasOnlyKeys(value, [
        "schemaVersion",
        "exclusionId",
        "ruleId",
        "artifactKind",
        "normalizedTargetIdentity",
        "bundleId",
        "packageId",
        "signingIdentity",
        "ownerTypeFingerprint",
        "createdAt",
        "reasonCategory",
      ]) ||
      value.schemaVersion !== 1 ||
      !isOpaqueId(value.exclusionId) ||
      !isOpaqueId(value.ruleId) ||
      typeof value.artifactKind !== "string" ||
      !ARTIFACT_KINDS.has(value.artifactKind) ||
      typeof value.normalizedTargetIdentity !== "string" ||
      !value.normalizedTargetIdentity.startsWith("target:v1:") ||
      !IDENTITY_PATTERN.test(value.normalizedTargetIdentity) ||
      (value.bundleId !== undefined &&
        value.bundleId !== null &&
        (typeof value.bundleId !== "string" ||
          value.bundleId.length === 0 ||
          value.bundleId.length > 255 ||
          !BUNDLE_ID_PATTERN.test(value.bundleId))) ||
      (value.packageId !== undefined && value.packageId !== null && !isOpaqueId(value.packageId)) ||
      (value.signingIdentity !== undefined &&
        value.signingIdentity !== null &&
        (typeof value.signingIdentity !== "string" ||
          !value.signingIdentity.startsWith("signing:v1:") ||
          !IDENTITY_PATTERN.test(value.signingIdentity))) ||
      typeof value.ownerTypeFingerprint !== "string" ||
      !value.ownerTypeFingerprint.startsWith("owner-type:v1:") ||
      !IDENTITY_PATTERN.test(value.ownerTypeFingerprint) ||
      typeof value.createdAt !== "string" ||
      !ISO_DATE_PATTERN.test(value.createdAt) ||
      typeof value.reasonCategory !== "string" ||
      !REASON_CATEGORIES.has(value.reasonCategory)
    ) {
      throw new TypeError("Invalid UserExclusion");
    }
    return value as unknown as StoredUserExclusion;
  },
};

function stateSchemas<TExclusion>(exclusionSchema: RuntimeSchema<TExclusion>) {
  const v1: RuntimeSchema<{ schemaVersion: 1; exclusions: readonly TExclusion[] }> = {
    parse(value: unknown) {
      if (
        !isRecord(value) ||
        !hasOnlyKeys(value, ["schemaVersion", "exclusions"]) ||
        value.schemaVersion !== 1 ||
        !Array.isArray(value.exclusions)
      ) {
        throw new TypeError("Invalid exclusion state v1");
      }
      return {
        schemaVersion: 1,
        exclusions: value.exclusions.map((entry) => exclusionSchema.parse(entry)),
      };
    },
  };
  const v2: RuntimeSchema<ExclusionState<TExclusion>> = {
    parse(value: unknown) {
      if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
          "schemaVersion",
          "stateVersion",
          "updatedAt",
          "exclusions",
        ]) ||
        value.schemaVersion !== 2 ||
        !Number.isSafeInteger(value.stateVersion) ||
        (value.stateVersion as number) < 0 ||
        typeof value.updatedAt !== "string" ||
        !ISO_DATE_PATTERN.test(value.updatedAt) ||
        !Array.isArray(value.exclusions)
      ) {
        throw new TypeError("Invalid exclusion state v2");
      }
      return {
        schemaVersion: 2,
        stateVersion: value.stateVersion as number,
        updatedAt: value.updatedAt,
        exclusions: value.exclusions.map((entry) => exclusionSchema.parse(entry)),
      };
    },
  };
  return { v1, v2 };
}

function migrationTimestamp(exclusions: readonly unknown[]): string {
  const timestamps = exclusions
    .filter(isRecord)
    .map((entry) => entry.createdAt)
    .filter((value): value is string => typeof value === "string" && ISO_DATE_PATTERN.test(value))
    .sort();
  return timestamps.at(-1) ?? "1970-01-01T00:00:00.000Z";
}

function buildContract<TExclusion>(
  exclusionSchema: RuntimeSchema<TExclusion>,
): VersionedStateContract<ExclusionState<TExclusion>> {
  const schemas = stateSchemas(exclusionSchema);
  return {
    currentVersion: 2,
    schemas: { 1: schemas.v1, 2: schemas.v2 },
    migrations: {
      1: {
        toVersion: 2,
        migrate: (value) => {
          const exclusions = value.exclusions as readonly unknown[];
          return {
            schemaVersion: 2,
            stateVersion: exclusions.length > 0 ? 1 : 0,
            updatedAt: migrationTimestamp(exclusions),
            exclusions,
          };
        },
      },
    },
  };
}

function isMissingState(error: JsonStoreError): boolean {
  return (
    error.code === "STATE_UNAVAILABLE" &&
    (error.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
  );
}

export function defaultExclusionStateRoot(
  homeDirectory: string = homedir(),
): string {
  return join(
    homeDirectory,
    "Library",
    "Application Support",
    "Codex Mac Cleaner",
    "state",
  );
}

export class ExclusionStateStore<
  TExclusion extends StoredUserExclusion = StoredUserExclusion,
> {
  readonly stateRoot: string;
  private readonly now: () => Date;
  private readonly versionedStore: VersionedStateStore<ExclusionState<TExclusion>>;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: ExclusionStateStoreOptions<TExclusion> = {}) {
    this.stateRoot =
      options.stateRoot ?? defaultExclusionStateRoot(options.homeDirectory);
    this.now = options.now ?? (() => new Date());
    const store = new JsonStore(this.stateRoot);
    const exclusionSchema =
      options.exclusionSchema ??
      (StoredUserExclusionSchema as unknown as RuntimeSchema<TExclusion>);
    this.versionedStore = new VersionedStateStore(
      store,
      "exclusions.json",
      buildContract(exclusionSchema),
    );
  }

  private freshState(): ExclusionState<TExclusion> {
    return {
      schemaVersion: 2,
      stateVersion: 0,
      updatedAt: this.now().toISOString(),
      exclusions: [],
    };
  }

  private async load(): Promise<ExclusionState<TExclusion>> {
    try {
      return await this.versionedStore.read();
    } catch (error) {
      if (error instanceof JsonStoreError && isMissingState(error)) {
        return this.freshState();
      }
      if (error instanceof JsonStoreError && error.code === "SYMLINK_BOUNDARY") {
        throw error;
      }
      if (error instanceof JsonStoreError || error instanceof VersionedStateError) {
        throw new ExclusionStateStoreError("EXCLUSION_STATE_INVALID", {
          cause: error,
        });
      }
      throw error;
    }
  }

  async list(): Promise<ExclusionState<TExclusion>> {
    return this.load();
  }

  async readForAudit(): Promise<
    | Readonly<{ status: "ready"; exclusions: readonly TExclusion[] }>
    | Readonly<{
        status: "invalid";
        errorCode: "EXCLUSION_STATE_INVALID";
        tokenIssuance: "blocked";
      }>
  > {
    try {
      const state = await this.load();
      return { status: "ready", exclusions: state.exclusions };
    } catch {
      return {
        status: "invalid",
        errorCode: "EXCLUSION_STATE_INVALID",
        tokenIssuance: "blocked",
      };
    }
  }

  private async serialize<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const run = this.mutationQueue.then(operation);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async mutate<TResult>(
    mutation: (state: ExclusionState<TExclusion>) => {
      readonly exclusions: readonly TExclusion[];
      readonly result: TResult;
    },
  ): Promise<{ readonly state: ExclusionState<TExclusion>; readonly result: TResult }> {
    return this.serialize(async () => {
      const current = await this.load();
      const changed = mutation(current);
      const next: ExclusionState<TExclusion> = {
        schemaVersion: 2,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        exclusions: changed.exclusions,
      };
      await this.versionedStore.write(next);
      return { state: next, result: changed.result };
    });
  }

  async create(exclusion: TExclusion): Promise<ExclusionState<TExclusion>> {
    const { state } = await this.mutate((current) => {
      const withoutSameId = current.exclusions.filter(
        (entry) => entry.exclusionId !== exclusion.exclusionId,
      );
      return {
        exclusions: [...withoutSameId, exclusion],
        result: undefined,
      };
    });
    return state;
  }

  async remove(exclusionId: string): Promise<ExclusionState<TExclusion>> {
    const { state } = await this.mutate((current) => {
      const exclusions = current.exclusions.filter(
        (entry) => entry.exclusionId !== exclusionId,
      );
      if (exclusions.length === current.exclusions.length) {
        throw new ExclusionStateStoreError("EXCLUSION_NOT_FOUND");
      }
      return { exclusions, result: undefined };
    });
    return state;
  }

  async reset(expectedStateVersion: number): Promise<ExclusionResetResult<TExclusion>> {
    return this.serialize(async () => {
      const current = await this.load();
      if (current.stateVersion !== expectedStateVersion) {
        return { status: "stale", stateVersion: current.stateVersion };
      }
      const next: ExclusionState<TExclusion> = {
        schemaVersion: 2,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        exclusions: [],
      };
      await this.versionedStore.write(next);
      return {
        status: "reset",
        state: next,
        removedCount: current.exclusions.length,
      };
    });
  }
}

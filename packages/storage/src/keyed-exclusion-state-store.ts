import {
  KeyedUserExclusionSchema,
  KeyedUserExclusionStateSchema,
  UserExclusionStateSchema,
  UserExclusionStateV1Schema,
  type ExclusionClaimKind,
  type KeyedUserExclusion,
  type KeyedUserExclusionState,
  type UserExclusion,
} from "@codex-mac-cleaner/contracts";

import {
  InstallationKeyError,
  InstallationKeyStore,
  type InstallationKey,
} from "./installation-key.js";
import { JsonStore, JsonStoreError, type RuntimeSchema } from "./json-store.js";

const STATE_PATH = "exclusions.json";
const UnknownSchema: RuntimeSchema<unknown> = { parse: (value) => value };

export interface RawUserExclusionIdentity {
  readonly targetIdentity: string;
  readonly bundleIdentifier?: string | null;
  readonly packageIdentifier?: string | null;
  readonly signingRequirement?: string | null;
  readonly ownerTypeFingerprint: string;
}

export interface KeyedExclusionMetadata {
  readonly exclusionId: string;
  readonly ruleId: string;
  readonly artifactKind: KeyedUserExclusion["artifactKind"];
  readonly createdAt: string;
  readonly reasonCategory: KeyedUserExclusion["reasonCategory"];
}

export type KeyedExclusionStoreErrorCode =
  | "CORRELATION_KEY_UNAVAILABLE"
  | "CORRELATION_SCHEMA_UNSUPPORTED"
  | "CORRELATION_MIGRATION_REQUIRED"
  | "EXCLUSION_NOT_FOUND";

export class KeyedExclusionStoreError extends Error {
  readonly failClosed = true;

  constructor(readonly code: KeyedExclusionStoreErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "KeyedExclusionStoreError";
  }
}

export interface KeyedExclusionStateStoreOptions {
  readonly stateRoot: string;
  readonly now?: () => Date;
  readonly keyStore?: InstallationKeyStore;
  readonly jsonStore?: JsonStore;
}

function stableClaims(identity: RawUserExclusionIdentity): readonly Readonly<{
  kind: ExclusionClaimKind;
  value: string;
}>[] {
  const claims: { kind: ExclusionClaimKind; value: string }[] = [
    { kind: "target", value: identity.targetIdentity },
    { kind: "owner_type", value: identity.ownerTypeFingerprint },
  ];
  if (identity.bundleIdentifier) {
    claims.push({ kind: "bundle", value: identity.bundleIdentifier });
  }
  if (identity.packageIdentifier) {
    claims.push({ kind: "package", value: identity.packageIdentifier });
  }
  if (identity.signingRequirement) {
    claims.push({ kind: "signing", value: identity.signingRequirement });
  }
  if (claims.some(({ value }) => !value.trim())) {
    throw new KeyedExclusionStoreError("CORRELATION_MIGRATION_REQUIRED");
  }
  return claims.sort((left, right) => left.kind.localeCompare(right.kind));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function deriveKeyedUserExclusion(
  key: InstallationKey,
  metadata: KeyedExclusionMetadata,
  identity: RawUserExclusionIdentity,
): KeyedUserExclusion {
  const claims = stableClaims(identity);
  const claimDigests = claims.map(({ kind, value }) => ({
    kind,
    digest: key.derive("cmc:user-exclusion:claim:v1", kind, value),
  }));
  return KeyedUserExclusionSchema.parse({
    schemaVersion: 2,
    ...metadata,
    keyId: key.keyId,
    derivationVersion: key.derivationVersion,
    subjectDigest: key.derive(
      "cmc:user-exclusion:subject:v1",
      metadata.artifactKind,
      stable({
        ruleId: metadata.ruleId,
        artifactKind: metadata.artifactKind,
        claims,
      }),
    ),
    claimDigests,
  });
}

function legacyIdentity(exclusion: UserExclusion): RawUserExclusionIdentity {
  return {
    targetIdentity: exclusion.normalizedTargetIdentity,
    ownerTypeFingerprint: exclusion.ownerTypeFingerprint,
    ...(exclusion.bundleId !== undefined
      ? { bundleIdentifier: exclusion.bundleId }
      : {}),
    ...(exclusion.packageId !== undefined
      ? { packageIdentifier: exclusion.packageId }
      : {}),
    ...(exclusion.signingIdentity !== undefined
      ? { signingRequirement: exclusion.signingIdentity }
      : {}),
  };
}

function legacyMetadata(exclusion: UserExclusion): KeyedExclusionMetadata {
  return {
    exclusionId: exclusion.exclusionId,
    ruleId: exclusion.ruleId,
    artifactKind: exclusion.artifactKind,
    createdAt: exclusion.createdAt,
    reasonCategory: exclusion.reasonCategory,
  };
}

function isMissingState(error: JsonStoreError): boolean {
  return error.code === "STATE_UNAVAILABLE" &&
    (error.cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

export class KeyedExclusionStateStore {
  private readonly store: JsonStore;
  private readonly keyStore: InstallationKeyStore;
  private readonly now: () => Date;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: KeyedExclusionStateStoreOptions) {
    this.store = options.jsonStore ?? new JsonStore(options.stateRoot);
    this.keyStore = options.keyStore ?? new InstallationKeyStore({
      stateRoot: options.stateRoot,
    });
    this.now = options.now ?? (() => new Date());
  }

  private freshState(key: InstallationKey): KeyedUserExclusionState {
    return {
      schemaVersion: 3,
      stateVersion: 0,
      updatedAt: this.now().toISOString(),
      keyId: key.keyId,
      derivationVersion: key.derivationVersion,
      exclusions: [],
    };
  }

  private async writeAndVerify(
    state: KeyedUserExclusionState,
  ): Promise<KeyedUserExclusionState> {
    const parsed = KeyedUserExclusionStateSchema.parse(state);
    await this.store.writeJsonAtomic(STATE_PATH, parsed);
    const reread = await this.store.readJson(STATE_PATH, {
      parse: (value) => KeyedUserExclusionStateSchema.parse(value),
    });
    if (stable(reread) !== stable(parsed)) {
      throw new KeyedExclusionStoreError("CORRELATION_MIGRATION_REQUIRED");
    }
    return reread;
  }

  private async migrateLegacy(raw: unknown): Promise<KeyedUserExclusionState> {
    let exclusions: readonly UserExclusion[];
    let stateVersion: number;
    try {
      if (Reflect.get(raw as object, "schemaVersion") === 1) {
        const parsed = UserExclusionStateV1Schema.parse(raw);
        exclusions = parsed.exclusions;
        stateVersion = exclusions.length > 0 ? 1 : 0;
      } else {
        const parsed = UserExclusionStateSchema.parse(raw);
        exclusions = parsed.exclusions;
        stateVersion = parsed.stateVersion;
      }
    } catch (error) {
      throw new KeyedExclusionStoreError("CORRELATION_MIGRATION_REQUIRED", {
        cause: error,
      });
    }
    const key = await this.keyStore.loadOrCreate();
    const migrated = exclusions.map((exclusion) =>
      deriveKeyedUserExclusion(
        key,
        legacyMetadata(exclusion),
        legacyIdentity(exclusion),
      ),
    );
    return this.writeAndVerify({
      schemaVersion: 3,
      stateVersion,
      updatedAt: this.now().toISOString(),
      keyId: key.keyId,
      derivationVersion: key.derivationVersion,
      exclusions: migrated,
    });
  }

  private async load(): Promise<KeyedUserExclusionState> {
    let raw: unknown;
    try {
      raw = await this.store.readJson(STATE_PATH, UnknownSchema);
    } catch (error) {
      if (error instanceof JsonStoreError && isMissingState(error)) {
        const key = await this.keyStore.loadOrCreate();
        return this.freshState(key);
      }
      throw new KeyedExclusionStoreError("CORRELATION_SCHEMA_UNSUPPORTED", {
        cause: error,
      });
    }
    const version = typeof raw === "object" && raw !== null
      ? Reflect.get(raw, "schemaVersion")
      : undefined;
    if (version === 1 || version === 2) return this.migrateLegacy(raw);
    if (version !== 3) {
      throw new KeyedExclusionStoreError("CORRELATION_SCHEMA_UNSUPPORTED");
    }
    let state: KeyedUserExclusionState;
    try {
      state = KeyedUserExclusionStateSchema.parse(raw);
    } catch (error) {
      throw new KeyedExclusionStoreError("CORRELATION_SCHEMA_UNSUPPORTED", {
        cause: error,
      });
    }
    let key: InstallationKey;
    try {
      key = await this.keyStore.loadExisting();
    } catch (error) {
      const code = error instanceof InstallationKeyError &&
        error.code === "CORRELATION_KEY_UNAVAILABLE"
        ? "CORRELATION_KEY_UNAVAILABLE"
        : "CORRELATION_SCHEMA_UNSUPPORTED";
      throw new KeyedExclusionStoreError(code, { cause: error });
    }
    if (
      state.keyId !== key.keyId ||
      state.derivationVersion !== key.derivationVersion
    ) {
      throw new KeyedExclusionStoreError("CORRELATION_KEY_UNAVAILABLE");
    }
    return state;
  }

  private async serialize<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const run = this.mutationQueue.then(operation);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async list(): Promise<KeyedUserExclusionState> {
    return this.load();
  }

  async readForAudit(): Promise<
    | Readonly<{
        status: "ready";
        stateVersion: number;
        exclusions: readonly KeyedUserExclusion[];
        tokenIssuance: "allowed";
      }>
    | Readonly<{
        status: "invalid";
        errorCode: KeyedExclusionStoreErrorCode;
        findingsVisibility: "visible";
        tokenIssuance: "blocked";
      }>
  > {
    try {
      const state = await this.load();
      return {
        status: "ready",
        stateVersion: state.stateVersion,
        exclusions: state.exclusions,
        tokenIssuance: "allowed",
      };
    } catch (error) {
      return {
        status: "invalid",
        errorCode: error instanceof KeyedExclusionStoreError
          ? error.code
          : "CORRELATION_SCHEMA_UNSUPPORTED",
        findingsVisibility: "visible",
        tokenIssuance: "blocked",
      };
    }
  }

  async createFromIdentity(
    metadata: KeyedExclusionMetadata,
    identity: RawUserExclusionIdentity,
  ): Promise<KeyedUserExclusion> {
    return this.serialize(async () => {
      const current = await this.load();
      const key = await this.keyStore.loadExisting();
      const exclusion = deriveKeyedUserExclusion(key, metadata, identity);
      const exclusions = [
        ...current.exclusions.filter(
          (entry) => entry.exclusionId !== exclusion.exclusionId,
        ),
        exclusion,
      ].sort((left, right) => left.exclusionId.localeCompare(right.exclusionId));
      await this.writeAndVerify({
        ...current,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        exclusions,
      });
      return exclusion;
    });
  }

  async remove(exclusionId: string): Promise<KeyedUserExclusionState> {
    return this.serialize(async () => {
      const current = await this.load();
      if (!current.exclusions.some((entry) => entry.exclusionId === exclusionId)) {
        throw new KeyedExclusionStoreError("EXCLUSION_NOT_FOUND");
      }
      return this.writeAndVerify({
        ...current,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        exclusions: current.exclusions.filter(
          (entry) => entry.exclusionId !== exclusionId,
        ),
      });
    });
  }

  async reset(expectedStateVersion: number): Promise<
    | Readonly<{
        status: "reset";
        state: KeyedUserExclusionState;
        removedCount: number;
      }>
    | Readonly<{ status: "stale"; stateVersion: number }>
  > {
    return this.serialize(async () => {
      const current = await this.load();
      if (current.stateVersion !== expectedStateVersion) {
        return { status: "stale", stateVersion: current.stateVersion };
      }
      const removedCount = current.exclusions.length;
      const state = await this.writeAndVerify({
        ...current,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        exclusions: [],
      });
      return { status: "reset", state, removedCount };
    });
  }

  async rekey(
    records: readonly Readonly<{
      exclusionId: string;
      identity: RawUserExclusionIdentity;
    }>[],
  ): Promise<KeyedUserExclusionState> {
    return this.serialize(async () => {
      const current = await this.load();
      const byId = new Map(records.map((record) => [record.exclusionId, record]));
      if (
        byId.size !== current.exclusions.length ||
        current.exclusions.some((entry) => !byId.has(entry.exclusionId))
      ) {
        throw new KeyedExclusionStoreError("CORRELATION_MIGRATION_REQUIRED");
      }
      const key = await this.keyStore.rotate();
      const exclusions = current.exclusions.map((entry) =>
        deriveKeyedUserExclusion(
          key,
          {
            exclusionId: entry.exclusionId,
            ruleId: entry.ruleId,
            artifactKind: entry.artifactKind,
            createdAt: entry.createdAt,
            reasonCategory: entry.reasonCategory,
          },
          byId.get(entry.exclusionId)!.identity,
        ),
      );
      return this.writeAndVerify({
        schemaVersion: 3,
        stateVersion: current.stateVersion + 1,
        updatedAt: this.now().toISOString(),
        keyId: key.keyId,
        derivationVersion: key.derivationVersion,
        exclusions,
      });
    });
  }
}

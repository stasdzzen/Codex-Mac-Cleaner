import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { SnapshotFingerprint } from "@codex-mac-cleaner/policy";

import { QuarantineError } from "./errors.js";
import { fingerprintsEqual } from "./filesystem.js";

export const PREVIEW_TTL_MS = 5 * 60 * 1_000;

export type PreviewAction = "move" | "restore" | "purge";

export interface PreviewClaims {
  readonly action: PreviewAction;
  readonly subjectId: string;
  readonly uiSessionId: string;
  readonly fingerprint: SnapshotFingerprint;
}

export interface PreviewToken {
  readonly tokenId: string;
  readonly secret: string;
  readonly expiresAt: string;
}

export interface StoredPreviewToken extends PreviewClaims {
  readonly tokenId: string;
  readonly digest: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumed: boolean;
}

interface MutableStoredPreviewToken extends StoredPreviewToken {
  consumed: boolean;
  readonly expiresAtMs: number;
}

export interface PreviewTokenVaultOptions {
  readonly now?: () => number;
}

function digestSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function equalDigest(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function copyFingerprint(
  fingerprint: SnapshotFingerprint,
): SnapshotFingerprint {
  return Object.freeze({ ...fingerprint });
}

export class PreviewTokenVault {
  private readonly records = new Map<string, MutableStoredPreviewToken>();
  private readonly tokenIdByDigest = new Map<string, string>();
  private readonly now: () => number;

  constructor(options: PreviewTokenVaultOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  issue(claims: PreviewClaims): PreviewToken {
    const issuedAtMs = this.now();
    const expiresAtMs = issuedAtMs + PREVIEW_TTL_MS;
    const secret = randomBytes(32).toString("base64url");
    const digest = digestSecret(secret);
    const tokenId = randomUUID();
    const record: MutableStoredPreviewToken = {
      tokenId,
      digest,
      action: claims.action,
      subjectId: claims.subjectId,
      uiSessionId: claims.uiSessionId,
      fingerprint: copyFingerprint(claims.fingerprint),
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      consumed: false,
    };
    this.records.set(tokenId, record);
    this.tokenIdByDigest.set(digest, tokenId);
    return { tokenId, secret, expiresAt: record.expiresAt };
  }

  inspect(tokenId: string): StoredPreviewToken | undefined {
    const record = this.records.get(tokenId);
    if (record === undefined) return undefined;
    return {
      tokenId: record.tokenId,
      digest: record.digest,
      action: record.action,
      subjectId: record.subjectId,
      uiSessionId: record.uiSessionId,
      fingerprint: copyFingerprint(record.fingerprint),
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      consumed: record.consumed,
    };
  }

  resolve(secret: string): StoredPreviewToken {
    const digest = digestSecret(secret);
    const tokenId = this.tokenIdByDigest.get(digest);
    const record = tokenId === undefined ? undefined : this.records.get(tokenId);
    if (record === undefined || !equalDigest(record.digest, digest)) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    return this.inspect(record.tokenId) as StoredPreviewToken;
  }

  consume(secret: string, expected: PreviewClaims): StoredPreviewToken {
    const resolved = this.resolve(secret);
    const record = this.records.get(resolved.tokenId);
    if (record === undefined) throw new QuarantineError("OPERATION_CONFLICT");
    if (record.consumed) throw new QuarantineError("OPERATION_CONFLICT");
    if (this.now() >= record.expiresAtMs) {
      throw new QuarantineError("PREVIEW_EXPIRED");
    }

    record.consumed = true;
    if (
      record.action !== expected.action ||
      record.subjectId !== expected.subjectId ||
      record.uiSessionId !== expected.uiSessionId ||
      !fingerprintsEqual(record.fingerprint, expected.fingerprint)
    ) {
      throw new QuarantineError("OPERATION_CONFLICT");
    }
    return this.inspect(record.tokenId) as StoredPreviewToken;
  }
}

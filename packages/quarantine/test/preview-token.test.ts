import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  PREVIEW_TTL_MS,
  PreviewTokenVault,
  QuarantineError,
} from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

describe("одноразовый preview token", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("использует 256-bit secret, server-side digest и TTL ровно пять минут", async () => {
    harness = await createSyntheticHarness();
    let now = Date.parse("2026-07-18T00:00:00.000Z");
    const vault = new PreviewTokenVault({ now: () => now });
    const token = vault.issue({
      action: "move",
      subjectId: harness.subject.findingId,
      uiSessionId: "ui-session-a",
      fingerprint: harness.subject.sourceFingerprint,
    });

    expect(Buffer.from(token.secret, "base64url")).toHaveLength(32);
    expect(Date.parse(token.expiresAt) - now).toBe(PREVIEW_TTL_MS);
    expect(PREVIEW_TTL_MS).toBe(5 * 60 * 1_000);

    const stored = vault.inspect(token.tokenId);
    expect(stored).toMatchObject({
      tokenId: token.tokenId,
      action: "move",
      subjectId: harness.subject.findingId,
      uiSessionId: "ui-session-a",
      consumed: false,
    });
    expect(stored?.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(stored)).not.toContain(token.secret);

    now += PREVIEW_TTL_MS - 1;
    expect(() =>
      vault.consume(token.secret, {
        action: "move",
        subjectId: harness?.subject.findingId ?? "",
        uiSessionId: "ui-session-a",
        fingerprint: harness?.subject.sourceFingerprint ?? randomFingerprint(),
      }),
    ).not.toThrow();
  });

  it("истекает точно на границе пяти минут", async () => {
    harness = await createSyntheticHarness();
    let now = 10_000;
    const vault = new PreviewTokenVault({ now: () => now });
    const token = vault.issue({
      action: "move",
      subjectId: harness.subject.findingId,
      uiSessionId: "ui-session-a",
      fingerprint: harness.subject.sourceFingerprint,
    });

    now += PREVIEW_TTL_MS;
    expect(() =>
      vault.consume(token.secret, {
        action: "move",
        subjectId: harness?.subject.findingId ?? "",
        uiSessionId: "ui-session-a",
        fingerprint: harness?.subject.sourceFingerprint ?? randomFingerprint(),
      }),
    ).toThrowError(expect.objectContaining({ code: "PREVIEW_EXPIRED" }));
  });

  it("привязывает token к action, subject, UI session и fingerprint и использует один раз", async () => {
    harness = await createSyntheticHarness();
    const vault = new PreviewTokenVault();
    const claims = {
      action: "move" as const,
      subjectId: harness.subject.findingId,
      uiSessionId: "ui-session-a",
      fingerprint: harness.subject.sourceFingerprint,
    };

    for (const mismatch of [
      { ...claims, action: "restore" as const },
      { ...claims, subjectId: "finding-other" },
      { ...claims, uiSessionId: "ui-session-other" },
      {
        ...claims,
        fingerprint: { ...claims.fingerprint, inode: "changed-inode" },
      },
    ]) {
      const token = vault.issue(claims);
      expect(() => vault.consume(token.secret, mismatch)).toThrowError(
        expect.objectContaining({ code: "OPERATION_CONFLICT" }),
      );
    }

    const token = vault.issue(claims);
    expect(vault.consume(token.secret, claims).consumed).toBe(true);
    expect(() => vault.consume(token.secret, claims)).toThrowError(
      expect.objectContaining({ code: "OPERATION_CONFLICT" }),
    );
  });

  it("не принимает случайный невыданный secret", () => {
    const vault = new PreviewTokenVault();
    expect(() =>
      vault.consume(randomBytes(32).toString("base64url"), {
        action: "move",
        subjectId: "finding-a",
        uiSessionId: "ui-a",
        fingerprint: randomFingerprint(),
      }),
    ).toThrowError(QuarantineError);
  });
});

function randomFingerprint() {
  return {
    device: "synthetic-device",
    inode: "synthetic-inode",
    mode: 0o100600,
    uid: 501,
    gid: 20,
    size: 1,
    mtimeNs: "1",
    ctimeNs: "1",
    fileType: "file" as const,
    mountId: "synthetic-mount",
    symbolicLink: false,
    linkCount: 1,
  };
}

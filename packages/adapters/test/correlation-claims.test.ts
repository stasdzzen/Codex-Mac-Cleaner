import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSyntheticCorrelationInput,
  consumeEphemeralCorrelationInput,
} from "../src/index.js";

describe("ephemeral raw correlation boundary", () => {
  it("не сериализуется, редактирует inspect и потребляется ровно один раз", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "cmc-correlation-boundary-"));
    const boundary = buildSyntheticCorrelationInput({
      seed: "boundary-seed",
      tempRoot,
    });
    const descriptor = boundary.describe();

    expect(() => JSON.stringify(boundary)).toThrowError(
      "Raw correlation input нельзя сериализовать",
    );
    expect(String(boundary)).toBe("[EphemeralCorrelationInput redacted]");
    expect(descriptor).toMatchObject({
      schemaVersion: 1,
      queryCount: 8,
      snapshotId: "snapshot-synthetic",
    });
    expect(JSON.stringify(descriptor)).not.toMatch(
      /path|bundle|package|signing|inventory|token|secret|personal/i,
    );

    const rawClaimCount = consumeEphemeralCorrelationInput(
      boundary,
      ({ candidate, queries }) =>
        candidate.claims.length + queries.flatMap((query) => query.subjects).length,
    );
    expect(rawClaimCount).toBeGreaterThan(0);
    expect(() =>
      consumeEphemeralCorrelationInput(boundary, () => undefined),
    ).toThrowError("Raw correlation input уже потреблён");
  });
});

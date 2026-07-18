import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseSafeMetadata } from "../src/index.js";
import { snapshotFixtureTree } from "./helpers.js";

describe("Synthetic public fixtures", () => {
  it("остаются byte-for-byte read-only после parsing", async () => {
    const fixtureRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));
    const before = await snapshotFixtureTree(fixtureRoot);
    for (const name of Object.keys(before)) {
      const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
      parseSafeMetadata({ raw, name, modifiedAt: "2026-01-01T00:00:00.000Z" });
    }
    const after = await snapshotFixtureTree(fixtureRoot);

    expect(after).toEqual(before);
    expect(dirname(fixtureRoot)).not.toBe("");
  });
});

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createSafeMetadataObservation,
  parseSafeMetadata,
} from "../src/index.js";

const fixtureUrl = (name: string): URL => new URL(`./fixtures/${name}`, import.meta.url);

describe("SafeMetadata", () => {
  it.each([
    ["correct.json", "json", "parsed"],
    ["empty.json", "json", "parsed"],
    ["unicode.yaml", "yaml", "parsed"],
    ["secret-like.plist", "plist", "parsed"],
    ["corrupt.json", "json", "malformed"],
  ] as const)("сводит %s к безопасным агрегатам", async (name, format, parseStatus) => {
    const raw = await readFile(fixtureUrl(name), "utf8");
    const modifiedAt = "2026-01-01T00:00:00.000Z";
    const result = parseSafeMetadata({ raw, name, modifiedAt });

    expect(result).toMatchObject({ format, parseStatus, modifiedAt });
    expect(result.byteLength).toBe(Buffer.byteLength(raw));
    expect(Object.keys(result).sort()).toEqual([
      "byteLength",
      "declaredOwnerDisplayName",
      "format",
      "modifiedAt",
      "parseStatus",
      "sensitivityFlags",
    ]);
  });

  it("удаляет raw keys, values, full paths и secret-like данные до persistence", async () => {
    const raw = await readFile(fixtureUrl("secret-like.plist"), "utf8");
    const result = parseSafeMetadata({
      raw,
      name: "secret-like.plist",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(result.sensitivityFlags).toEqual(expect.arrayContaining(["tokens", "subscription_url"]));
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("synthetic-secret-marker-42");
    expect(serialized).not.toContain("invalid.example");
    expect(serialized).not.toContain(fileURLToPath(fixtureUrl("secret-like.plist")));
  });

  it("создаёт persistence-ready observation только после SafeMetadata filter", async () => {
    const raw = await readFile(fixtureUrl("secret-like.plist"), "utf8");
    const observation = createSafeMetadataObservation({
      raw,
      name: "secret-like.plist",
      modifiedAt: "2026-01-01T00:00:00.000Z",
      ref: "safe-config",
      displayName: "Synthetic Config",
      fingerprint: "safe-config-fingerprint",
    });
    const serialized = JSON.stringify(observation);

    expect(observation.safeMetadata?.sensitivityFlags).toEqual(
      expect.arrayContaining(["tokens", "subscription_url"]),
    );
    expect(observation.allowedActions).toEqual([]);
    expect(serialized).not.toContain("accessToken");
    expect(serialized).not.toContain("synthetic-secret-marker-42");
    expect(serialized).not.toContain("invalid.example");
  });
});

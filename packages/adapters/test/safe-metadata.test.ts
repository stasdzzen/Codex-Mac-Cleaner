import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createSafeMetadataObservation,
  parseSafeMetadata,
} from "../src/index.js";

const fixtureUrl = (name: string): URL => new URL(`./fixtures/${name}`, import.meta.url);

describe("SafeMetadata", () => {
  it("разбирает adversarial YAML за ограниченное линейное время без утечки raw input", () => {
    const parseAdversarialYaml = (spaces: number): Readonly<{
      elapsedMs: number;
      parseStatus: string;
      serialized: string;
    }> => {
      const raw = `9:${" ".repeat(spaces)}\rsynthetic-raw-marker\rend`;
      const startedAt = performance.now();
      const result = parseSafeMetadata({
        raw,
        name: "adversarial.yaml",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      });
      return {
        elapsedMs: performance.now() - startedAt,
        parseStatus: result.parseStatus,
        serialized: JSON.stringify(result),
      };
    };

    const shortInput = parseAdversarialYaml(5_000);
    const longInput = parseAdversarialYaml(30_000);

    expect(longInput.elapsedMs).toBeLessThan(250);
    expect(longInput.elapsedMs).toBeLessThan(shortInput.elapsedMs * 12 + 25);
    expect(longInput.parseStatus).toBe("malformed");
    expect(longInput.serialized).not.toContain("synthetic-raw-marker");
    expect(longInput.serialized).not.toContain("9:");
  });

  it("сохраняет credential redaction для camelCase apiKey без raw value", () => {
    const result = parseSafeMetadata({
      raw: JSON.stringify({ apiKey: "synthetic-credential-value" }),
      name: "credential.json",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(result.sensitivityFlags).toContain("credentials");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("synthetic-credential-value");
  });

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

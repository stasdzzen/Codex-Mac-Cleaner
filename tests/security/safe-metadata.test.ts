import { describe, expect, it } from "vitest";

import { parseSafeMetadata } from "../../packages/adapters/src/index.js";
import {
  ModelSafeMetadataSchema,
  SafeMetadataSchema,
} from "../../packages/contracts/src/index.js";

describe("CMC-10: SafeMetadata privacy", () => {
  it("сохраняет только safe aggregates для secret-like config", () => {
    const raw = JSON.stringify({
      privateKey: "synthetic-private-key-value",
      clientSecret: "synthetic-client-secret-value",
      subscriptionUrl: "https://subscription.invalid/synthetic-value",
      projectPath: "/private/cmc-synthetic-home/project",
      displayName: "Generated Config",
    });
    const metadata = parseSafeMetadata({
      raw,
      name: "generated-config.json",
      modifiedAt: "2026-07-20T00:00:00.000Z",
    });
    const serialized = JSON.stringify(metadata);

    expect(metadata.sensitivityFlags).toEqual(
      expect.arrayContaining(["credentials", "subscription_url", "local_project"]),
    );
    expect(Object.keys(metadata).sort()).toEqual([
      "byteLength",
      "declaredOwnerDisplayName",
      "format",
      "modifiedAt",
      "parseStatus",
      "sensitivityFlags",
    ]);
    for (const forbidden of [
      "privateKey",
      "clientSecret",
      "synthetic-private-key-value",
      "subscription.invalid",
      "/private/cmc-synthetic-home",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("model projection удаляет declared owner и отклоняет raw поля", () => {
    const safe = SafeMetadataSchema.parse({
      format: "json",
      parseStatus: "parsed",
      byteLength: 42,
      modifiedAt: "2026-07-20T00:00:00.000Z",
      sensitivityFlags: ["credentials"],
      declaredOwnerDisplayName: "Generated Owner",
    });
    const model = ModelSafeMetadataSchema.parse({
      format: safe.format,
      parseStatus: safe.parseStatus,
      byteLength: safe.byteLength,
      modifiedAt: safe.modifiedAt,
      sensitivityFlags: safe.sensitivityFlags,
    });

    expect(model).not.toHaveProperty("declaredOwnerDisplayName");
    expect(() => ModelSafeMetadataSchema.parse({ ...model, rawValue: "synthetic" }))
      .toThrow();
  });
});

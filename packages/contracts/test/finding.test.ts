import { describe, expect, it } from "vitest";

import {
  FindingFactsSchema,
  FindingSchema,
  ReclaimEstimateSchema,
  SafeMetadataSchema,
} from "../src/index.js";
import { findingFixture } from "./fixtures.js";

describe("Finding model/widget views", () => {
  it("оставляет полный путь только в widget view", () => {
    const finding = FindingSchema.parse(findingFixture);

    expect(finding.model).not.toHaveProperty("canonicalPath");
    expect(finding.model).not.toHaveProperty("componentDisplayName");
    expect(finding.model.safeMetadata).not.toHaveProperty("declaredOwnerDisplayName");
    expect(finding.widget.canonicalPath).toBe(
      "/synthetic/Library/Caches/org.example.old",
    );
  });

  it.each(["analysis_only", "unsupported_manual"] as const)(
    "%s не получает filesystem mutation actions",
    (supportLevel) => {
      expect(() =>
        FindingSchema.parse({
          ...findingFixture,
          model: {
            ...findingFixture.model,
            supportLevel,
            allowedActions: ["inspect", "exclude", "prepare_move"],
          },
        }),
      ).toThrow();
      expect(
        FindingSchema.parse({
          ...findingFixture,
          model: {
            ...findingFixture.model,
            supportLevel,
            allowedActions: ["inspect", "exclude"],
          },
        }).model.allowedActions,
      ).toEqual(["inspect", "exclude"]);
    },
  );

  it.each(
    ["credentials", "tokens", "subscription_url", "personal_data", "database", "local_project"].flatMap(
      (sensitivityFlag) =>
        ["prepare_move", "prepare_restore", "prepare_purge"].map(
          (mutationAction) => [sensitivityFlag, mutationAction] as const,
        ),
    ),
  )(
    "sensitivity flag %s запрещает %s",
    (sensitivityFlag, mutationAction) => {
      expect(() =>
        FindingSchema.parse({
          ...findingFixture,
          model: {
            ...findingFixture.model,
            allowedActions: ["inspect", "exclude", mutationAction],
            safeMetadata: {
              ...findingFixture.model.safeMetadata,
              sensitivityFlags: [sensitivityFlag],
            },
          },
        }),
      ).toThrow();
    },
  );

  it("sensitive finding сохраняет только inspect/exclude", () => {
    expect(
      FindingSchema.parse({
        ...findingFixture,
        model: {
          ...findingFixture.model,
          allowedActions: ["inspect", "exclude"],
          safeMetadata: {
            ...findingFixture.model.safeMetadata,
            sensitivityFlags: [
              "credentials",
              "tokens",
              "subscription_url",
              "personal_data",
              "database",
              "local_project",
            ],
          },
        },
      }).model.allowedActions,
    ).toEqual(["inspect", "exclude"]);
  });

  it("фиксирует трёхзначные facts и честную reclaim-оценку", () => {
    expect(
      FindingFactsSchema.parse(findingFixture.widget.findingFacts).receiptState,
    ).toBe("unknown");
    expect(
      ReclaimEstimateSchema.parse(findingFixture.widget.reclaimEstimate)
        .estimatedPhysicalBytes,
    ).toBe(42);
    expect(() =>
      FindingFactsSchema.parse({
        ...findingFixture.widget.findingFacts,
        openFileState: "not_found",
      }),
    ).toThrow();
  });

  it("SafeMetadata отклоняет raw config, path и secret-like поля", () => {
    const metadata = {
      format: "plist",
      parseStatus: "parsed",
      byteLength: 128,
      modifiedAt: "2026-07-17T00:00:00.000Z",
      declaredOwnerDisplayName: "Synthetic App",
      sensitivityFlags: ["tokens"],
    };

    expect(SafeMetadataSchema.parse(metadata).sensitivityFlags).toEqual(["tokens"]);
    expect(() => SafeMetadataSchema.parse({ ...metadata, rawValue: "synthetic" })).toThrow();
    expect(() => SafeMetadataSchema.parse({ ...metadata, path: "/synthetic/private" })).toThrow();
    expect(() => SafeMetadataSchema.parse({ ...metadata, secret: "synthetic" })).toThrow();
  });
});

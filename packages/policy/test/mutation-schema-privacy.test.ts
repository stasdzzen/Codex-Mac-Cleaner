import { describe, expect, it } from "vitest";

import {
  PrepareMoveRequestSchema,
  evaluatePolicy,
} from "../src/index.js";
import { safeFinding } from "./fixtures.js";

describe("mutation-facing schema и privacy", () => {
  const valid = {
    findingId: "finding-a",
    auditRevision: 1,
    requestId: "request-a",
  };

  it.each(["path", "destination", "glob", "shellCommand", "bypass"])(
    "не принимает поле %s",
    (field) => {
      expect(() =>
        PrepareMoveRequestSchema.parse({ ...valid, [field]: "synthetic-value" }),
      ).toThrow();
    },
  );

  it("принимает только opaque ids и revision", () => {
    expect(PrepareMoveRequestSchema.parse(valid)).toEqual(valid);
  });

  it("PolicyDecision не содержит path, destination, shell или bypass", () => {
    const serialized = JSON.stringify(evaluatePolicy(safeFinding));

    for (const forbidden of [
      "/synthetic/",
      "canonicalPath",
      "destination",
      "shellCommand",
      "bypass",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

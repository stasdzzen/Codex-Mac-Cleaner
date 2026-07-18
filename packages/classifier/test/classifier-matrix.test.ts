import { describe, expect, it } from "vitest";

import { classifyEvidence } from "../src/index.js";
import {
  completeOrphanEvidence,
  nameOnlyEvidence,
  withOutcome,
} from "./fixtures.js";

const requiredForNameResistance = [
  "owner_identity",
  "installed_state",
  "activity",
  "open_file_state",
  "target_existence",
  "receipt",
  "dependency",
  "temporal",
  "data_kind",
];

describe("classifier evidence matrix", () => {
  it("возвращает unknown для одного совпадения имени", () => {
    const result = classifyEvidence(nameOnlyEvidence);

    expect(result.label).toBe("unknown");
    expect(result.confidence).toBe("low");
    expect(result.ruleIds).toEqual(["CLASSIFIER_V1_UNKNOWN_INCOMPLETE_EVIDENCE"]);
    expect(result.missingEvidence).toEqual(requiredForNameResistance);
  });

  it.each([
    ["owner_identity", "unknown"],
    ["installed_state", "unknown"],
    ["activity", "unknown"],
    ["open_file_state", "unknown"],
    ["target_existence", "unknown"],
    ["receipt", "unknown"],
    ["dependency", "unknown"],
    ["temporal", "unknown"],
    ["data_kind", "unknown"],
  ] as const)("не создаёт orphaned при неполном %s", (input, outcome) => {
    const result = classifyEvidence(withOutcome(completeOrphanEvidence, input, outcome));

    expect(result.label).toBe("unknown");
    expect(result.missingEvidence).toContain(input);
  });

  it.each([
    ["owner_identity", "contradicted"],
    ["target_existence", "contradicted"],
    ["temporal", "contradicted"],
    ["data_kind", "contradicted"],
  ] as const)("учитывает counter-evidence %s", (input, outcome) => {
    const result = classifyEvidence(withOutcome(completeOrphanEvidence, input, outcome));

    expect(result.label).toBe("unknown");
    expect(result.counterEvidence).toContain(input);
  });

  it("не использует hidden score или display name", () => {
    const serialized = JSON.stringify(classifyEvidence(completeOrphanEvidence));

    expect(serialized).not.toContain("score");
    expect(serialized).not.toContain("displayName");
  });
});

import { describe, expect, it } from "vitest";

import { classifyEvidence } from "../../src/index.js";
import { completeOrphanEvidence, withOutcome } from "../fixtures.js";

describe("golden outputs именованных classifier rules v1", () => {
  it("CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE", () => {
    expect(classifyEvidence(completeOrphanEvidence)).toEqual({
      label: "orphaned",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE"],
      explanation: "Полный независимый набор доказательств указывает на остаток",
      counterEvidence: [],
      missingEvidence: [],
    });
  });

  it("CLASSIFIER_V1_IDLE_REPRODUCIBLE", () => {
    const installed = withOutcome(
      completeOrphanEvidence,
      "installed_state",
      "confirmed",
    );

    expect(classifyEvidence(installed)).toEqual({
      label: "idle_reproducible",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_IDLE_REPRODUCIBLE"],
      explanation: "Владелец установлен, а воспроизводимые данные сейчас не активны",
      counterEvidence: [],
      missingEvidence: [],
    });
  });

  it("CLASSIFIER_V1_ACTIVE_OR_OPEN", () => {
    const active = withOutcome(completeOrphanEvidence, "open_file_state", "confirmed");

    expect(classifyEvidence(active)).toEqual({
      label: "active_required",
      confidence: "high",
      ruleIds: ["CLASSIFIER_V1_ACTIVE_OR_OPEN"],
      explanation: "Активность или открытый файл требуют сохранения объекта",
      counterEvidence: ["open_file_state"],
      missingEvidence: [],
    });
  });
});

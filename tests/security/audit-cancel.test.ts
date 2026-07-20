import { describe, expect, it } from "vitest";

import {
  createJsonAuditWriter,
  runAdapters,
  type Observation,
  type SourceAdapter,
} from "../../packages/adapters/src/index.js";

const observation: Observation = {
  observationId: "observation-cmc-10",
  targetRef: "target-cmc-10",
  source: "user_library_artifacts",
  evidenceKind: "library_artifact",
  displayName: "Generated Cache",
  supportLevel: "candidate",
  allowedActions: ["inspect"],
  staleDuringAudit: false,
  observedAt: "2026-07-20T00:00:00.000Z",
  fingerprint: "fingerprint-cmc-10",
  logicalSize: 1,
  physicalSize: 1,
  sensitivityFlags: [],
  safeExplanation: "Generated observation",
};

function adapter(id: string, scan: SourceAdapter["scan"]): SourceAdapter {
  return { id, source: "user_library_artifacts", scan };
}

describe("CMC-10: audit cancellation races", () => {
  it("закрывает writer и создаёт ровно один cancelled terminal state", async () => {
    const controller = new AbortController();
    const transitions: string[] = [];
    const persisted: unknown[] = [];
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const writer = createJsonAuditWriter(
      {
        writeJsonAtomic: async (_path, value) => {
          persisted.push(value);
        },
      },
      "audits/generated-partial.json",
    );
    const running = runAdapters(
      [
        adapter("fast", async () => ({ observations: [observation], warnings: [] })),
        adapter("slow", async ({ signal }) => {
          markStarted?.();
          await new Promise<void>((resolve) =>
            signal.addEventListener("abort", () => resolve(), { once: true }),
          );
          signal.throwIfAborted();
          return { observations: [], warnings: [] };
        }),
      ],
      {
        signal: controller.signal,
        writer,
        onStateChange: (state) => transitions.push(state),
      },
    );
    await started;
    controller.abort();
    controller.abort();
    const result = await running;

    expect(result.state).toBe("cancelled");
    expect(transitions.filter((state) => state === "cancelling")).toHaveLength(1);
    expect(transitions.filter((state) => state === "cancelled")).toHaveLength(1);
    expect(result.observations.every((item) => item.allowedActions.length === 0)).toBe(true);
    expect(result.writersClosed).toBe(true);
    expect(persisted).toEqual([
      expect.objectContaining({
        state: "cancelled",
        observations: [expect.objectContaining({ allowedActions: [] })],
      }),
    ]);
  });

  it("отмена после completed не создаёт второй terminal transition", async () => {
    const controller = new AbortController();
    const result = await runAdapters(
      [adapter("fast", async () => ({ observations: [observation], warnings: [] }))],
      { signal: controller.signal },
    );
    controller.abort();
    expect(result.state).toBe("completed");
    expect(result.stateTransitions.filter((state) => state === "completed")).toHaveLength(1);
    expect(result.stateTransitions).not.toContain("cancelled");
  });
});

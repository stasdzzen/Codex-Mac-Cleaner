import { describe, expect, it } from "vitest";

import {
  createJsonAuditWriter,
  runAdapters,
  type Observation,
  type SnapshotProvider,
  type SourceAdapter,
} from "../src/index.js";

const baseObservation = (overrides: Partial<Observation> = {}): Observation => ({
  observationId: "observation-synthetic",
  targetRef: "target-synthetic",
  source: "user_library_artifacts",
  evidenceKind: "library_artifact",
  displayName: "Synthetic Artifact",
  supportLevel: "candidate",
  allowedActions: ["inspect"],
  staleDuringAudit: false,
  observedAt: "2026-01-01T00:00:00.000Z",
  fingerprint: "fingerprint-a",
  logicalSize: 1,
  physicalSize: 1,
  sensitivityFlags: [],
  safeExplanation: "Наблюдение доступно для анализа",
  ...overrides,
});

const adapter = (id: string, scan: SourceAdapter["scan"]): SourceAdapter => ({
  id,
  source: "user_library_artifacts",
  scan,
});

describe("Audit coordinator", () => {
  it("Operation not permitted одного source превращает в coverage gap и completed_with_warnings", async () => {
    const okAdapter = adapter("ok", async () => ({ observations: [baseObservation()], warnings: [] }));
    const deniedAdapter = adapter("denied", async () => {
      throw new Error("Operation not permitted");
    });
    const result = await runAdapters([okAdapter, deniedAdapter]);

    expect(result.observations).toHaveLength(1);
    expect(result.capabilityReport.gaps).toEqual([
      expect.objectContaining({ source: "user_library_artifacts", errorCode: "PERMISSION_DENIED" }),
    ]);
    expect(result.capabilityReport.unavailableSources).toEqual([
      { source: "user_library_artifacts", errorCode: "PERMISSION_DENIED" },
    ]);
    expect(result.coverage).toMatchObject({
      checkedSourceCount: 1,
      skippedSourceCount: 1,
      gaps: [expect.objectContaining({ errorCode: "PERMISSION_DENIED" })],
    });
    expect(result.state).toBe("completed_with_warnings");
  });

  it("Snapshot A/B помечает изменившийся объект stale и обнуляет actions", async () => {
    const snapshots: SnapshotProvider = {
      capture: async (phase) => new Map([["target-synthetic", phase === "A" ? "fingerprint-a" : "fingerprint-b"]]),
    };
    const result = await runAdapters([
      adapter("changing", async () => ({ observations: [baseObservation()], warnings: [] })),
    ], { snapshots });

    expect(result.observations[0]).toMatchObject({ staleDuringAudit: true, allowedActions: [] });
  });

  it("проходит cancelling ровно в один cancelled, закрывает writer и сохраняет read-only partial report", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const persisted: unknown[] = [];
    let closeCount = 0;
    let markSlowStarted: (() => void) | undefined;
    const slowStarted = new Promise<void>((resolve) => {
      markSlowStarted = resolve;
    });
    const writer = createJsonAuditWriter({
      writeJsonAtomic: async (_relativePath, value) => { persisted.push(value); },
    }, "audits/synthetic-partial.json", () => { closeCount += 1; });
    const slowAdapter = adapter("slow", async ({ signal }) => {
      markSlowStarted?.();
      await new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
      signal.throwIfAborted();
      return { observations: [baseObservation()], warnings: [] };
    });

    const fastAdapter = adapter("fast", async () => ({
      observations: [baseObservation()],
      warnings: [],
    }));
    const running = runAdapters([fastAdapter, slowAdapter], {
      signal: controller.signal,
      writer,
      onStateChange: (state) => events.push(state),
    });
    await slowStarted;
    controller.abort();
    controller.abort();
    const result = await running;

    expect(events.filter((state) => state === "cancelling")).toHaveLength(1);
    expect(events.filter((state) => state === "cancelled")).toHaveLength(1);
    expect(result.state).toBe("cancelled");
    expect(result.observations).toHaveLength(1);
    expect(result.observations.every(({ allowedActions }) => allowedActions.length === 0)).toBe(true);
    expect(result.writersClosed).toBe(true);
    expect(closeCount).toBe(1);
    expect(persisted).toHaveLength(1);
    expect(persisted).toEqual([
      expect.objectContaining({
        state: "cancelled",
        observations: [expect.objectContaining({ allowedActions: [] })],
      }),
    ]);
  });

  it("гонка отмены с terminal state идемпотентно сохраняет completed", async () => {
    const controller = new AbortController();
    const result = await runAdapters([
      adapter("fast", async () => ({ observations: [baseObservation()], warnings: [] })),
    ], { signal: controller.signal });
    controller.abort();

    expect(result.state).toBe("completed");
    expect(result.stateTransitions.at(-1)).toBe("completed");
  });
});

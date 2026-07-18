import type { JsonStore } from "@codex-mac-cleaner/storage";
import {
  AuditCoverageSchema,
  CapabilityReportSchema,
} from "@codex-mac-cleaner/contracts";

import type {
  AdapterWarning,
  AuditReportWriter,
  AuditRunState,
  CoordinatorResult,
  Observation,
  SnapshotProvider,
  SourceAdapter,
} from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

const TERMINAL_STATES = new Set<AuditRunState>([
  "cancelled",
  "completed",
  "completed_with_warnings",
  "failed",
]);

const EMPTY_SNAPSHOTS: SnapshotProvider = {
  capture: async () => new Map(),
};

export interface RunAdaptersOptions {
  readonly signal?: AbortSignal;
  readonly snapshots?: SnapshotProvider;
  readonly writer?: AuditReportWriter;
  readonly onStateChange?: (state: AuditRunState) => void;
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

function withoutActions(observation: Observation): Observation {
  return { ...observation, allowedActions: [] };
}

function markStale(
  observations: readonly Observation[],
  snapshotA: ReadonlyMap<string, string>,
  snapshotB: ReadonlyMap<string, string>,
): Observation[] {
  return observations.map((observation) => {
    const before = snapshotA.get(observation.targetRef);
    const after = snapshotB.get(observation.targetRef);
    if (before === undefined || after === undefined || before === after) return observation;
    return { ...observation, staleDuringAudit: true, allowedActions: [] };
  });
}

export async function runAdapters(
  adapters: readonly SourceAdapter[],
  options: RunAdaptersOptions = {},
): Promise<CoordinatorResult> {
  const signal = options.signal ?? new AbortController().signal;
  const snapshots = options.snapshots ?? EMPTY_SNAPSHOTS;
  const observations: Observation[] = [];
  const warnings: AdapterWarning[] = [];
  const supportedSources = new Set<Observation["source"]>();
  const stateTransitions: AuditRunState[] = ["queued"];
  let state: AuditRunState = "queued";

  const transition = (next: AuditRunState): void => {
    if (state === next || TERMINAL_STATES.has(state)) return;
    state = next;
    stateTransitions.push(next);
    options.onStateChange?.(next);
  };
  const requestCancellation = (): void => transition("cancelling");
  signal.addEventListener("abort", requestCancellation);
  if (signal.aborted) requestCancellation();
  else transition("running");

  let finalObservations: Observation[] = [];
  let finalState: CoordinatorResult["state"] = "failed";
  try {
    signal.throwIfAborted();
    const snapshotA = await snapshots.capture("A", signal);
    for (const adapter of adapters) {
      signal.throwIfAborted();
      try {
        const result = await adapter.scan({ signal });
        observations.push(...result.observations);
        warnings.push(...result.warnings);
        supportedSources.add(adapter.source);
        for (const observation of result.observations) supportedSources.add(observation.source);
      } catch (error) {
        if (isAbortError(error) || signal.aborted) throw error;
        warnings.push(toAdapterWarning(error, adapter.source, adapter.id));
      }
    }
    const snapshotB = await snapshots.capture("B", signal);
    finalObservations = markStale(observations, snapshotA, snapshotB);
    finalState = warnings.length === 0 ? "completed" : "completed_with_warnings";
    transition(finalState);
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      transition("cancelling");
      finalObservations = observations.map(withoutActions);
      finalState = "cancelled";
      transition("cancelled");
    } else {
      warnings.push(toAdapterWarning(error, "filesystem_metadata", "audit-coordinator"));
      finalObservations = observations.map(withoutActions);
      finalState = "failed";
      transition("failed");
    }
  } finally {
    signal.removeEventListener("abort", requestCancellation);
  }

  const canonicalSupportedSources = uniqueSorted(supportedSources);
  const unavailableSources = warnings.map(({ source, errorCode }) => ({ source, errorCode }));
  CapabilityReportSchema.parse({
    supportedSources: canonicalSupportedSources,
    unavailableSources,
  });
  const coverageCounts = AuditCoverageSchema.parse({
    checkedSourceCount: canonicalSupportedSources.length,
    skippedSourceCount: warnings.length,
  });

  const result: CoordinatorResult = {
    state: finalState,
    stateTransitions,
    observations: finalState === "cancelled" || finalState === "failed"
      ? finalObservations.map(withoutActions)
      : finalObservations,
    capabilityReport: {
      supportedSources: canonicalSupportedSources,
      unavailableSources,
      gaps: warnings,
    },
    coverage: { ...coverageCounts, gaps: warnings },
    writersClosed: true,
  };

  if (options.writer !== undefined) {
    try {
      await options.writer.write(result);
    } finally {
      await options.writer.close();
    }
  }
  return result;
}

type JsonStoreWriter = Pick<JsonStore, "writeJsonAtomic">;

export function createJsonAuditWriter(
  store: JsonStoreWriter,
  relativePath: string,
  onClose: () => void = () => undefined,
): AuditReportWriter {
  let closed = false;
  return {
    async write(result) {
      if (closed) return;
      await store.writeJsonAtomic(relativePath, result);
    },
    async close() {
      if (closed) return;
      closed = true;
      onClose();
    },
  };
}

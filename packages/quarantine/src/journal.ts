import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { JsonStore } from "@codex-mac-cleaner/storage";

import {
  isQuarantineErrorCode,
  QuarantineError,
} from "./errors.js";
import { syncDirectory } from "./filesystem.js";
import {
  isOperationId,
  isQuarantineState,
  type QuarantineManifest,
} from "./manifest.js";

export interface JournalEvent {
  readonly schemaVersion: 1;
  readonly operationId: string;
  readonly action: "move";
  readonly state: QuarantineManifest["state"];
  readonly eventSequence: number;
  readonly occurredAt: string;
  readonly lastErrorCode: QuarantineManifest["lastErrorCode"];
}

const JOURNAL_EVENT_FIELDS = new Set([
  "schemaVersion",
  "operationId",
  "action",
  "state",
  "eventSequence",
  "occurredAt",
  "lastErrorCode",
]);
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function parseJournalEvent(value: unknown): JournalEvent {
  if (typeof value !== "object" || value === null) {
    throw new QuarantineError("MANIFEST_INCONSISTENT");
  }
  const event = value as Record<string, unknown>;
  const keys = Object.keys(event);
  if (
    keys.length !== JOURNAL_EVENT_FIELDS.size ||
    keys.some((key) => !JOURNAL_EVENT_FIELDS.has(key)) ||
    event.schemaVersion !== 1 ||
    event.action !== "move" ||
    !isOperationId(event.operationId) ||
    !isQuarantineState(event.state) ||
    !Number.isSafeInteger(event.eventSequence) ||
    typeof event.eventSequence !== "number" ||
    event.eventSequence < 1 ||
    typeof event.occurredAt !== "string" ||
    !ISO_DATE_TIME.test(event.occurredAt) ||
    !Number.isFinite(Date.parse(event.occurredAt)) ||
    !(
      event.lastErrorCode === null ||
      isQuarantineErrorCode(event.lastErrorCode)
    )
  ) {
    throw new QuarantineError("MANIFEST_INCONSISTENT");
  }
  return event as unknown as JournalEvent;
}

export class OperationJournal {
  private initialized = false;
  private nextSequence = 1;
  private tail: Promise<void> = Promise.resolve();
  private readonly eventsBySequence = new Map<number, JournalEvent>();
  private readonly jsonStore: JsonStore;

  constructor(private readonly storeRoot: string) {
    this.jsonStore = new JsonStore(storeRoot);
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    const journalPath = join(this.storeRoot, "journal", "operations.ndjson");
    const payload = await readFile(journalPath, "utf8").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "";
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      },
    );
    let previous = 0;
    for (const line of payload.split("\n").filter(Boolean)) {
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch (error) {
        throw new QuarantineError("MANIFEST_INCONSISTENT", { cause: error });
      }
      const parsed = parseJournalEvent(event);
      if (parsed.eventSequence <= previous) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      if (this.eventsBySequence.has(parsed.eventSequence)) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      this.eventsBySequence.set(parsed.eventSequence, parsed);
      previous = parsed.eventSequence;
    }
    this.nextSequence = previous + 1;
    this.initialized = true;
  }

  async hasEvent(manifest: QuarantineManifest): Promise<boolean> {
    await this.initialize();
    const event = this.eventsBySequence.get(manifest.eventSequence);
    if (event === undefined) return false;
    if (
      event.schemaVersion !== manifest.schemaVersion ||
      event.operationId !== manifest.operationId ||
      event.action !== manifest.action ||
      event.state !== manifest.state ||
      event.eventSequence !== manifest.eventSequence ||
      event.lastErrorCode !== manifest.lastErrorCode
    ) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    return true;
  }

  async withNextSequence<T>(
    reserveAtLeast: number,
    task: (sequence: number) => Promise<T>,
  ): Promise<T> {
    const previous = this.tail;
    let release = (): void => undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await this.initialize();
      this.nextSequence = Math.max(this.nextSequence, reserveAtLeast + 1);
      const sequence = this.nextSequence;
      this.nextSequence += 1;
      return await task(sequence);
    } finally {
      release();
    }
  }

  async append(manifest: QuarantineManifest, occurredAt: string): Promise<void> {
    const event: JournalEvent = {
      schemaVersion: 1,
      operationId: manifest.operationId,
      action: manifest.action,
      state: manifest.state,
      eventSequence: manifest.eventSequence,
      occurredAt,
      lastErrorCode: manifest.lastErrorCode,
    };
    const parsed = parseJournalEvent(event);
    if (this.eventsBySequence.has(parsed.eventSequence)) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    await this.jsonStore.appendEvent("journal/operations.ndjson", parsed);
    await syncDirectory(join(this.storeRoot, "journal"));
    this.eventsBySequence.set(parsed.eventSequence, parsed);
  }
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { JsonStore } from "@codex-mac-cleaner/storage";

import { QuarantineError } from "./errors.js";
import { syncDirectory } from "./filesystem.js";
import type { QuarantineManifest } from "./manifest.js";

export interface JournalEvent {
  readonly schemaVersion: 1;
  readonly operationId: string;
  readonly action: "move";
  readonly state: QuarantineManifest["state"];
  readonly eventSequence: number;
  readonly occurredAt: string;
  readonly lastErrorCode: QuarantineManifest["lastErrorCode"];
}

export class OperationJournal {
  private initialized = false;
  private nextSequence = 1;
  private tail: Promise<void> = Promise.resolve();
  private readonly eventKeys = new Set<string>();
  private readonly jsonStore: JsonStore;

  constructor(private readonly storeRoot: string) {
    this.jsonStore = new JsonStore(storeRoot);
  }

  private eventKey(
    operationId: string,
    state: QuarantineManifest["state"],
    eventSequence: number,
  ): string {
    return `${operationId}\u0000${state}\u0000${eventSequence}`;
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
      const candidate = event as {
        eventSequence?: unknown;
        operationId?: unknown;
        state?: unknown;
      };
      const sequence = candidate.eventSequence;
      if (
        !Number.isSafeInteger(sequence) ||
        typeof sequence !== "number" ||
        sequence <= previous ||
        typeof candidate.operationId !== "string" ||
        typeof candidate.state !== "string"
      ) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      this.eventKeys.add(
        this.eventKey(
          candidate.operationId,
          candidate.state as QuarantineManifest["state"],
          sequence,
        ),
      );
      previous = sequence;
    }
    this.nextSequence = previous + 1;
    this.initialized = true;
  }

  async hasEvent(manifest: QuarantineManifest): Promise<boolean> {
    await this.initialize();
    return this.eventKeys.has(
      this.eventKey(
        manifest.operationId,
        manifest.state,
        manifest.eventSequence,
      ),
    );
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
    await this.jsonStore.appendEvent("journal/operations.ndjson", event);
    await syncDirectory(join(this.storeRoot, "journal"));
    this.eventKeys.add(
      this.eventKey(
        manifest.operationId,
        manifest.state,
        manifest.eventSequence,
      ),
    );
  }
}

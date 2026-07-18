import { pathExistsNoFollow } from "./filesystem.js";
import { OperationJournal } from "./journal.js";
import { ManifestRepository, type QuarantineManifest } from "./manifest.js";
import { QuarantineError } from "./errors.js";

export interface CandidateStorage {
  readonly candidateLogicalBytes: number;
  readonly candidatePhysicalBytes: number;
}

export interface StorageSummary extends CandidateStorage {
  readonly quarantinePhysicalBytes: number;
  readonly purgedPhysicalBytes: number;
  readonly stateVersion: number;
}

export interface ReadStorageSummaryOptions {
  readonly storeRoot: string;
  readonly candidateStorage?: () => Promise<CandidateStorage>;
}

function assertBytes(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new QuarantineError("MANIFEST_INCONSISTENT");
  }
}

function addBytes(total: number, value: number): number {
  assertBytes(value);
  const next = total + value;
  assertBytes(next);
  return next;
}

export async function readStorageSummary(
  options: ReadStorageSummaryOptions,
): Promise<StorageSummary> {
  const manifests = new ManifestRepository(options.storeRoot);
  const journal = new OperationJournal(options.storeRoot);
  const candidate = await (
    options.candidateStorage ??
    (async () => ({
      candidateLogicalBytes: 0,
      candidatePhysicalBytes: 0,
    }))
  )();
  assertBytes(candidate.candidateLogicalBytes);
  assertBytes(candidate.candidatePhysicalBytes);

  let quarantinePhysicalBytes = 0;
  let purgedPhysicalBytes = 0;
  let stateVersion = 0;
  for (const manifest of await manifests.list()) {
    if (!(await journal.hasEvent(manifest))) {
      throw new QuarantineError("MANIFEST_INCONSISTENT");
    }
    stateVersion = Math.max(stateVersion, manifest.eventSequence);
    if (manifest.state === "moved") {
      if (!(await pathExistsNoFollow(manifest.payloadPath))) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      quarantinePhysicalBytes = addBytes(
        quarantinePhysicalBytes,
        manifest.physicalSize,
      );
    }
    if (manifest.state === "purged") {
      if (await pathExistsNoFollow(manifest.payloadPath)) {
        throw new QuarantineError("MANIFEST_INCONSISTENT");
      }
      purgedPhysicalBytes = addBytes(purgedPhysicalBytes, manifest.physicalSize);
    }
  }

  return {
    candidateLogicalBytes: candidate.candidateLogicalBytes,
    candidatePhysicalBytes: candidate.candidatePhysicalBytes,
    quarantinePhysicalBytes,
    purgedPhysicalBytes,
    stateVersion,
  };
}

export interface QuarantineActionResult extends QuarantineManifest {
  readonly summary: StorageSummary;
  readonly stateVersion: number;
  readonly diskObservation: import("./disk-observation.js").DiskObservation;
}

import { statfs as nodeStatfs } from "node:fs/promises";

import { QuarantineError } from "./errors.js";

export interface DiskObservation {
  readonly availableBytes: number;
  readonly totalBytes: number;
  readonly observedAt: string;
  readonly source: "statfs";
}

export interface StatfsSnapshot {
  readonly bavail: bigint | number;
  readonly blocks: bigint | number;
  readonly bsize: bigint | number;
}

export interface ObserveDiskOptions {
  readonly now?: () => number;
  readonly statfs?: (path: string) => Promise<StatfsSnapshot>;
}

function toSafeBytes(blocks: bigint | number, blockSize: bigint | number): number {
  const bytes = BigInt(blocks) * BigInt(blockSize);
  if (bytes < 0n || bytes > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new QuarantineError("INTERNAL_ERROR");
  }
  return Number(bytes);
}

async function statfsBigInt(path: string): Promise<StatfsSnapshot> {
  return nodeStatfs(path, { bigint: true });
}

export async function observeDisk(
  path: string,
  options: ObserveDiskOptions = {},
): Promise<DiskObservation> {
  let snapshot: StatfsSnapshot;
  try {
    snapshot = await (options.statfs ?? statfsBigInt)(path);
  } catch (error) {
    if (error instanceof QuarantineError) throw error;
    throw new QuarantineError("INTERNAL_ERROR", { cause: error });
  }
  const availableBytes = toSafeBytes(snapshot.bavail, snapshot.bsize);
  const totalBytes = toSafeBytes(snapshot.blocks, snapshot.bsize);
  if (availableBytes > totalBytes) {
    throw new QuarantineError("INTERNAL_ERROR");
  }
  return {
    availableBytes,
    totalBytes,
    observedAt: new Date((options.now ?? Date.now)()).toISOString(),
    source: "statfs",
  };
}

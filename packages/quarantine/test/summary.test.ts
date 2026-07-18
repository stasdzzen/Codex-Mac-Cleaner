import { access } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { observeDisk } from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

describe("server-owned StorageSummary и DiskObservation", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("разделяет logical/physical/quarantine/purged и повышает stateVersion", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController({
      candidateStorage: async () => ({
        candidateLogicalBytes: 12345,
        candidatePhysicalBytes: 4096,
      }),
    });
    const initial = await controller.readStorageSummary();
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-summary-move",
    });
    const moved = await controller.moveToQuarantine({
      token: preview.secret,
      operationId: "op-summary-move",
      uiSessionId: "ui-summary-move",
    });

    expect(initial).toEqual({
      candidateLogicalBytes: 12345,
      candidatePhysicalBytes: 4096,
      quarantinePhysicalBytes: 0,
      purgedPhysicalBytes: 0,
      stateVersion: 0,
    });
    expect(moved.summary).toMatchObject({
      candidateLogicalBytes: 12345,
      candidatePhysicalBytes: 4096,
      quarantinePhysicalBytes: harness.subject.physicalSize,
      purgedPhysicalBytes: 0,
    });
    expect(moved.stateVersion).toBe(moved.summary.stateVersion);
    expect(moved.stateVersion).toBeGreaterThan(initial.stateVersion);
    expect(moved.diskObservation).toMatchObject({ source: "statfs" });
    expect(moved.diskObservation).not.toHaveProperty("freedBytesDelta");
    expect(moved.diskObservation).not.toHaveProperty("causalDelta");

    const purgePreview = await controller.preparePurge({
      operationId: "op-summary-move",
      uiSessionId: "ui-summary-purge",
    });
    const purged = await controller.purgeQuarantineEntry({
      token: purgePreview.secret,
      operationId: "op-summary-move",
      uiSessionId: "ui-summary-purge",
    });

    expect(purged.summary.quarantinePhysicalBytes).toBe(0);
    expect(purged.summary.purgedPhysicalBytes).toBe(harness.subject.physicalSize);
    expect(purged.stateVersion).toBeGreaterThan(moved.stateVersion);
    expect(await exists(harness.sourcePath)).toBe(false);
  });

  it("возвращает свежий statfs snapshot без причинного delta", async () => {
    harness = await createSyntheticHarness();
    const observedAt = "2026-07-17T00:00:00.000Z";
    const observation = await observeDisk(harness.temporaryRoot, {
      now: () => Date.parse(observedAt),
      statfs: async () => ({
        bavail: 2n,
        bsize: 512n,
        blocks: 8n,
      }),
    });

    expect(observation).toEqual({
      availableBytes: 1024,
      totalBytes: 4096,
      observedAt,
      source: "statfs",
    });
    expect(Object.keys(observation).sort()).toEqual([
      "availableBytes",
      "observedAt",
      "source",
      "totalBytes",
    ]);
  });

  it("failed purge сохраняет purgedPhysicalBytes и stateVersion", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController({
      fileSystem: {
        unlink: async () => {
          throw Object.assign(new Error("synthetic EIO"), { code: "EIO" });
        },
      },
    });
    const movePreview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-summary-failure-move",
    });
    await controller.moveToQuarantine({
      token: movePreview.secret,
      operationId: "op-summary-failure",
      uiSessionId: "ui-summary-failure-move",
    });
    const purgePreview = await controller.preparePurge({
      operationId: "op-summary-failure",
      uiSessionId: "ui-summary-failure-purge",
    });
    const before = await controller.readStorageSummary();

    await expect(
      controller.purgeQuarantineEntry({
        token: purgePreview.secret,
        operationId: "op-summary-failure",
        uiSessionId: "ui-summary-failure-purge",
      }),
    ).rejects.toMatchObject({ code: "PURGE_FAILED" });

    expect(await controller.readStorageSummary()).toEqual(before);
  });
});

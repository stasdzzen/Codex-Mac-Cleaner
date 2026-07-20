import { access } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSyntheticHarness,
  type SyntheticHarness,
} from "../../packages/quarantine/test/helpers.js";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

describe("CMC-10: quarantine summary and purge failure", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("failed purge сохраняет payload, manifest и server-owned metrics", async () => {
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
      uiSessionId: "ui-cmc-10-move",
    });
    await controller.moveToQuarantine({
      token: movePreview.secret,
      operationId: "operation-cmc-10",
      uiSessionId: "ui-cmc-10-move",
    });
    const purgePreview = await controller.preparePurge({
      operationId: "operation-cmc-10",
      uiSessionId: "ui-cmc-10-purge",
    });
    const before = await controller.readStorageSummary();

    await expect(
      controller.purgeQuarantineEntry({
        token: purgePreview.secret,
        operationId: "operation-cmc-10",
        uiSessionId: "ui-cmc-10-purge",
      }),
    ).rejects.toMatchObject({ code: "PURGE_FAILED" });

    expect(await controller.readStorageSummary()).toEqual(before);
    expect(before.purgedPhysicalBytes).toBe(0);
    expect(before.quarantinePhysicalBytes).toBe(harness.subject.physicalSize);
    expect(await exists(harness.sourcePath)).toBe(false);
    expect(await harness.readManifest("operation-cmc-10")).toMatchObject({
      operationId: "operation-cmc-10",
      state: "moved",
      lastErrorCode: null,
    });
  });
});

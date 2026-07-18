import {
  access,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  PREVIEW_TTL_MS,
  InjectedFault,
  inspectMoveSource,
  type FileSystemOperations,
} from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function payloadPath(harness: SyntheticHarness, operationId: string): string {
  return join(
    harness.storeRoot,
    "quarantine",
    operationId,
    "payload",
    "object",
  );
}

async function move(harness: SyntheticHarness, operationId: string, options = {}) {
  const controller = harness.createController(options);
  const preview = await controller.prepareMove({
    findingId: harness.subject.findingId,
    auditRevision: harness.subject.auditRevision,
    uiSessionId: `ui-move-${operationId}`,
  });
  await controller.moveToQuarantine({
    token: preview.secret,
    operationId,
    uiSessionId: `ui-move-${operationId}`,
  });
  return controller;
}

describe("ручной purge ровно одной quarantine entry", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("удаляет symlink как ссылку и сохраняет внешний target", async () => {
    harness = await createSyntheticHarness();
    const externalTarget = join(harness.temporaryRoot, "external-target");
    await writeFile(externalTarget, "synthetic-external-data");
    await rm(harness.sourcePath);
    await mkdir(harness.sourcePath);
    await writeFile(join(harness.sourcePath, "inside"), "synthetic-inside-data");
    await symlink(externalTarget, join(harness.sourcePath, "external-link"));
    const refreshed = await inspectMoveSource({
      allowedRoot: harness.allowedRoot,
      sourcePath: harness.sourcePath,
    });
    Object.assign(harness.subject, refreshed, {
      artifactKind: "directory",
      physicalSize: 8192,
    });
    const controller = await move(harness, "op-purge-symlink");
    const preview = await controller.preparePurge({
      operationId: "op-purge-symlink",
      uiSessionId: "ui-purge-symlink",
    });

    const result = await controller.purgeQuarantineEntry({
      token: preview.secret,
      operationId: "op-purge-symlink",
      uiSessionId: "ui-purge-symlink",
    });

    expect(result.state).toBe("purged");
    expect(await exists(payloadPath(harness, "op-purge-symlink"))).toBe(false);
    expect(await readFile(externalTarget, "utf8")).toBe(
      "synthetic-external-data",
    );
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });

  it("purge одной entry не затрагивает второй payload", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-purge-one-a");
    await writeFile(harness.sourcePath, "synthetic-object-a-second");
    const refreshed = await inspectMoveSource({
      allowedRoot: harness.allowedRoot,
      sourcePath: harness.sourcePath,
    });
    Object.assign(harness.subject, refreshed, {
      findingId: "finding-synthetic-second",
      physicalSize: refreshed.sourceFingerprint.size,
    });
    const secondPreview = await controller.prepareMove({
      findingId: "finding-synthetic-second",
      auditRevision: harness.subject.auditRevision,
      uiSessionId: "ui-move-second",
    });
    await controller.moveToQuarantine({
      token: secondPreview.secret,
      operationId: "op-purge-one-b",
      uiSessionId: "ui-move-second",
    });
    const purgePreview = await controller.preparePurge({
      operationId: "op-purge-one-a",
      uiSessionId: "ui-purge-one",
    });

    await controller.purgeQuarantineEntry({
      token: purgePreview.secret,
      operationId: "op-purge-one-a",
      uiSessionId: "ui-purge-one",
    });

    expect(await exists(payloadPath(harness, "op-purge-one-a"))).toBe(false);
    expect(await readFile(payloadPath(harness, "op-purge-one-b"), "utf8")).toBe(
      "synthetic-object-a-second",
    );
  });

  it("отклоняет wrong action, expired и невыданный token", async () => {
    harness = await createSyntheticHarness();
    let now = Date.parse("2026-07-18T00:00:00.000Z");
    const controller = await move(harness, "op-purge-token", { now: () => now });
    const restorePreview = await controller.prepareRestore({
      operationId: "op-purge-token",
      uiSessionId: "ui-purge-token",
    });
    const purgePreview = await controller.preparePurge({
      operationId: "op-purge-token",
      uiSessionId: "ui-purge-token",
    });

    await expect(
      controller.purgeQuarantineEntry({
        token: restorePreview.secret,
        operationId: "op-purge-token",
        uiSessionId: "ui-purge-token",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
    await expect(
      controller.purgeQuarantineEntry({
        token: "synthetic-not-issued-token",
        operationId: "op-purge-token",
        uiSessionId: "ui-purge-token",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });

    now += PREVIEW_TTL_MS;
    await expect(
      controller.purgeQuarantineEntry({
        token: purgePreview.secret,
        operationId: "op-purge-token",
        uiSessionId: "ui-purge-token",
      }),
    ).rejects.toMatchObject({ code: "PREVIEW_EXPIRED" });
    expect(await exists(payloadPath(harness, "op-purge-token"))).toBe(true);
  });

  it("idempotent replay возвращает прежний result без второй mutation", async () => {
    harness = await createSyntheticHarness();
    let unlinkCount = 0;
    const fileSystem: Partial<FileSystemOperations> = {
      unlink: async (path) => {
        unlinkCount += 1;
        await (await import("node:fs/promises")).unlink(path);
      },
    };
    const controller = await move(harness, "op-purge-replay", { fileSystem });
    const preview = await controller.preparePurge({
      operationId: "op-purge-replay",
      uiSessionId: "ui-purge-replay",
    });
    const input = {
      token: preview.secret,
      operationId: "op-purge-replay",
      uiSessionId: "ui-purge-replay",
    };

    const first = await controller.purgeQuarantineEntry(input);
    const second = await controller.purgeQuarantineEntry(input);

    expect(second).toEqual(first);
    expect(unlinkCount).toBe(1);
  });

  it("блокирует подмену payload identity после preview", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-purge-stale-payload");
    const preview = await controller.preparePurge({
      operationId: "op-purge-stale-payload",
      uiSessionId: "ui-purge-stale-payload",
    });
    const payload = payloadPath(harness, "op-purge-stale-payload");
    await rm(payload);
    await writeFile(payload, "synthetic-object-a");

    await expect(
      controller.purgeQuarantineEntry({
        token: preview.secret,
        operationId: "op-purge-stale-payload",
        uiSessionId: "ui-purge-stale-payload",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(await readFile(payload, "utf8")).toBe("synthetic-object-a");
  });

  it("fail closed отклоняет manifest с alternate payloadPath", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-purge-tampered-path");
    const externalTarget = join(harness.temporaryRoot, "external-never-purge");
    await writeFile(externalTarget, "synthetic-external-data");
    const manifestPath = join(
      harness.storeRoot,
      "quarantine",
      "op-purge-tampered-path",
      "manifest.json",
    );
    const manifest = await harness.readManifest("op-purge-tampered-path");
    await writeFile(
      manifestPath,
      `${JSON.stringify({ ...manifest, payloadPath: externalTarget })}\n`,
    );

    await expect(
      controller.preparePurge({
        operationId: "op-purge-tampered-path",
        uiSessionId: "ui-purge-tampered-path",
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
    expect(await readFile(externalTarget, "utf8")).toBe(
      "synthetic-external-data",
    );
  });

  it("failed purge не скрывает entry и не меняет manifest или summary", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-purge-failed", {
      fileSystem: {
        unlink: async () => {
          throw Object.assign(new Error("synthetic EACCES"), { code: "EACCES" });
        },
      } satisfies Partial<FileSystemOperations>,
    });
    const preview = await controller.preparePurge({
      operationId: "op-purge-failed",
      uiSessionId: "ui-purge-failed",
    });
    const beforeManifest = await harness.readManifest("op-purge-failed");
    const beforeSummary = await controller.readStorageSummary();

    await expect(
      controller.purgeQuarantineEntry({
        token: preview.secret,
        operationId: "op-purge-failed",
        uiSessionId: "ui-purge-failed",
      }),
    ).rejects.toMatchObject({ code: "PURGE_FAILED" });

    expect(await exists(payloadPath(harness, "op-purge-failed"))).toBe(true);
    expect(await harness.readManifest("op-purge-failed")).toEqual(beforeManifest);
    expect(await controller.readStorageSummary()).toEqual(beforeSummary);
  });

  it("после удаления payload и сбоя journal блокирует противоречивый contour", async () => {
    harness = await createSyntheticHarness();
    let armed = false;
    const controller = harness.createController({
      faultInjector: (point) => {
        if (armed && point === "beforeJournalAppend") {
          throw new InjectedFault(point);
        }
      },
    });
    const movePreview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-purge-fault-move",
    });
    await controller.moveToQuarantine({
      token: movePreview.secret,
      operationId: "op-purge-fault",
      uiSessionId: "ui-purge-fault-move",
    });
    const purgePreview = await controller.preparePurge({
      operationId: "op-purge-fault",
      uiSessionId: "ui-purge-fault",
    });
    armed = true;

    await expect(
      controller.purgeQuarantineEntry({
        token: purgePreview.secret,
        operationId: "op-purge-fault",
        uiSessionId: "ui-purge-fault",
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });

    expect(controller.isMutationBlocked()).toBe(true);
    expect(await exists(payloadPath(harness, "op-purge-fault"))).toBe(false);
    await expect(
      harness.createController().recoverPreparedOperations(),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
  });
});

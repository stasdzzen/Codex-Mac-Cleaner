import { execFile } from "node:child_process";
import {
  access,
  chmod,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  inspectMoveSource,
  InjectedFault,
  nodeFileSystem,
  prepareRestore,
  restoreFromQuarantine,
  type FileSystemOperations,
} from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

const execFileAsync = promisify(execFile);

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

async function move(
  harness: SyntheticHarness,
  operationId: string,
  fileSystem?: Partial<FileSystemOperations>,
) {
  const controller = harness.createController(
    fileSystem === undefined ? {} : { fileSystem },
  );
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

describe("restore только в исходный свободный путь", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("не перезаписывает занятый source при prepare", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-occupied-prepare");
    await writeFile(harness.sourcePath, "synthetic-new-owner-data");

    await expect(
      prepareRestore(controller, {
        operationId: "op-restore-occupied-prepare",
        uiSessionId: "ui-restore-occupied-prepare",
      }),
    ).rejects.toMatchObject({ code: "RESTORE_PATH_OCCUPIED" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe(
      "synthetic-new-owner-data",
    );
    expect(await readFile(payloadPath(harness, "op-restore-occupied-prepare"), "utf8")).toBe(
      "synthetic-object-a",
    );
  });

  it("не перезаписывает source, занятый между preview и rename", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-occupied-race");
    const preview = await controller.prepareRestore({
      operationId: "op-restore-occupied-race",
      uiSessionId: "ui-restore-occupied-race",
    });
    await writeFile(harness.sourcePath, "synthetic-racing-data");

    await expect(
      restoreFromQuarantine(controller, {
        token: preview.secret,
        operationId: "op-restore-occupied-race",
        uiSessionId: "ui-restore-occupied-race",
      }),
    ).rejects.toMatchObject({ code: "RESTORE_PATH_OCCUPIED" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe(
      "synthetic-racing-data",
    );
    expect(await exists(payloadPath(harness, "op-restore-occupied-race"))).toBe(
      true,
    );
  });

  it("не создаёт отсутствующий исходный parent", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-parent-missing");
    await rm(harness.allowedRoot, { recursive: true });

    await expect(
      controller.prepareRestore({
        operationId: "op-restore-parent-missing",
        uiSessionId: "ui-restore-parent-missing",
      }),
    ).rejects.toMatchObject({ code: "RESTORE_PARENT_CHANGED" });
    expect(await exists(harness.allowedRoot)).toBe(false);
    expect(await exists(payloadPath(harness, "op-restore-parent-missing"))).toBe(
      true,
    );
  });

  it("блокирует заменённый parent и link boundary", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-parent-link");
    const oldParent = `${harness.allowedRoot}-old`;
    await rename(harness.allowedRoot, oldParent);
    await (await import("node:fs/promises")).symlink(oldParent, harness.allowedRoot);

    await expect(
      controller.prepareRestore({
        operationId: "op-restore-parent-link",
        uiSessionId: "ui-restore-parent-link",
      }),
    ).rejects.toMatchObject({ code: "SYMLINK_BOUNDARY" });
    expect(await exists(payloadPath(harness, "op-restore-parent-link"))).toBe(
      true,
    );
  });

  it("блокирует изменение parent fingerprint после preview", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-stale");
    const preview = await controller.prepareRestore({
      operationId: "op-restore-stale",
      uiSessionId: "ui-restore-stale",
    });
    await chmod(harness.allowedRoot, 0o711);

    await expect(
      controller.restoreFromQuarantine({
        token: preview.secret,
        operationId: "op-restore-stale",
        uiSessionId: "ui-restore-stale",
      }),
    ).rejects.toMatchObject({ code: "RESTORE_PARENT_CHANGED" });
    expect(await exists(payloadPath(harness, "op-restore-stale"))).toBe(true);
  });

  it("блокирует stale payload fingerprint после preview", async () => {
    harness = await createSyntheticHarness();
    const controller = await move(harness, "op-restore-stale-payload");
    const preview = await controller.prepareRestore({
      operationId: "op-restore-stale-payload",
      uiSessionId: "ui-restore-stale-payload",
    });
    await writeFile(
      payloadPath(harness, "op-restore-stale-payload"),
      "synthetic-stale-payload",
    );

    await expect(
      controller.restoreFromQuarantine({
        token: preview.secret,
        operationId: "op-restore-stale-payload",
        uiSessionId: "ui-restore-stale-payload",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(await exists(payloadPath(harness, "op-restore-stale-payload"))).toBe(
      true,
    );
    expect(await exists(harness.sourcePath)).toBe(false);
  });

  it("преобразует EXDEV restore в CROSS_VOLUME без copy-delete", async () => {
    harness = await createSyntheticHarness();
    let renameCount = 0;
    const controller = await move(harness, "op-restore-exdev", {
      rename: async (source, destination) => {
        renameCount += 1;
        if (renameCount === 2) {
          throw Object.assign(new Error("synthetic EXDEV"), { code: "EXDEV" });
        }
        await nodeFileSystem.rename(source, destination);
      },
    });
    const preview = await controller.prepareRestore({
      operationId: "op-restore-exdev",
      uiSessionId: "ui-restore-exdev",
    });

    await expect(
      controller.restoreFromQuarantine({
        token: preview.secret,
        operationId: "op-restore-exdev",
        uiSessionId: "ui-restore-exdev",
      }),
    ).rejects.toMatchObject({ code: "CROSS_VOLUME" });
    expect(renameCount).toBe(2);
    expect(await exists(harness.sourcePath)).toBe(false);
    expect(await exists(payloadPath(harness, "op-restore-exdev"))).toBe(true);
  });

  it("сохраняет mode, mtime, birthtime и synthetic xattr", async () => {
    harness = await createSyntheticHarness();
    const fixedTime = new Date("2026-07-17T01:02:03.000Z");
    await chmod(harness.sourcePath, 0o640);
    await utimes(harness.sourcePath, fixedTime, fixedTime);
    await execFileAsync("/usr/bin/xattr", [
      "-w",
      "com.codex-mac-cleaner.synthetic",
      "synthetic-xattr-value",
      harness.sourcePath,
    ]);
    const refreshed = await inspectMoveSource({
      allowedRoot: harness.allowedRoot,
      sourcePath: harness.sourcePath,
    });
    Object.assign(harness.subject, refreshed);
    const before = await stat(harness.sourcePath, { bigint: true });
    const controller = await move(harness, "op-restore-metadata");
    const beforeRestore = await controller.readStorageSummary();
    const preview = await controller.prepareRestore({
      operationId: "op-restore-metadata",
      uiSessionId: "ui-restore-metadata",
    });

    const result = await controller.restoreFromQuarantine({
      token: preview.secret,
      operationId: "op-restore-metadata",
      uiSessionId: "ui-restore-metadata",
    });
    const after = await stat(harness.sourcePath, { bigint: true });
    const xattr = await execFileAsync("/usr/bin/xattr", [
      "-p",
      "com.codex-mac-cleaner.synthetic",
      harness.sourcePath,
    ]);

    expect(result.state).toBe("restored");
    expect(result.stateVersion).toBeGreaterThan(beforeRestore.stateVersion);
    expect(result.summary).toMatchObject({
      quarantinePhysicalBytes: 0,
      purgedPhysicalBytes: 0,
      stateVersion: result.stateVersion,
    });
    expect(Object.keys(result.diskObservation).sort()).toEqual([
      "availableBytes",
      "observedAt",
      "source",
      "totalBytes",
    ]);
    expect(await exists(payloadPath(harness, "op-restore-metadata"))).toBe(false);
    expect(Number(after.mode & 0o777n)).toBe(Number(before.mode & 0o777n));
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.birthtimeNs).toBe(before.birthtimeNs);
    expect(xattr.stdout.trim()).toBe("synthetic-xattr-value");
  });

  it("idempotent restore replay не выполняет второй rename", async () => {
    harness = await createSyntheticHarness();
    let renameCount = 0;
    const controller = await move(harness, "op-restore-replay", {
      rename: async (source, destination) => {
        renameCount += 1;
        await nodeFileSystem.rename(source, destination);
      },
    });
    const preview = await controller.prepareRestore({
      operationId: "op-restore-replay",
      uiSessionId: "ui-restore-replay",
    });
    const input = {
      token: preview.secret,
      operationId: "op-restore-replay",
      uiSessionId: "ui-restore-replay",
    };

    const first = await controller.restoreFromQuarantine(input);
    const second = await controller.restoreFromQuarantine(input);

    expect(second).toEqual(first);
    expect(renameCount).toBe(2);
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
  });

  it("после restore rename и сбоя journal блокирует противоречивый contour", async () => {
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
      uiSessionId: "ui-restore-fault-move",
    });
    await controller.moveToQuarantine({
      token: movePreview.secret,
      operationId: "op-restore-fault",
      uiSessionId: "ui-restore-fault-move",
    });
    const restorePreview = await controller.prepareRestore({
      operationId: "op-restore-fault",
      uiSessionId: "ui-restore-fault",
    });
    armed = true;

    await expect(
      controller.restoreFromQuarantine({
        token: restorePreview.secret,
        operationId: "op-restore-fault",
        uiSessionId: "ui-restore-fault",
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });

    expect(controller.isMutationBlocked()).toBe(true);
    expect(await exists(harness.sourcePath)).toBe(true);
    expect(await exists(payloadPath(harness, "op-restore-fault"))).toBe(false);
    await expect(
      harness.createController().recoverPreparedOperations(),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
  });
});

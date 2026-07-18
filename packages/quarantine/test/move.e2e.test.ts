import { access, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  nodeFileSystem,
  prepareMove,
  moveToQuarantine,
  captureFingerprint,
  type FileSystemOperations,
} from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

describe("quarantine transaction одного объекта", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("пишет durable prepared до rename и завершает moved в фиксированном destination", async () => {
    harness = await createSyntheticHarness();
    let preparedAtRename: unknown;
    let renameCount = 0;
    const fileSystem: Partial<FileSystemOperations> = {
      rename: async (source, destination) => {
        renameCount += 1;
        preparedAtRename = (await harness?.readManifest("op-e2e"))?.state;
        await nodeFileSystem.rename(source, destination);
      },
    };
    const controller = harness.createController({ fileSystem });
    const token = await prepareMove(controller, {
      findingId: harness.subject.findingId,
      auditRevision: harness.subject.auditRevision,
      uiSessionId: "ui-session-e2e",
    });

    const result = await moveToQuarantine(controller, {
      token: token.secret,
      operationId: "op-e2e",
      uiSessionId: "ui-session-e2e",
    });
    const payloadPath = join(
      harness.storeRoot,
      "quarantine",
      "op-e2e",
      "payload",
      "object",
    );

    expect(preparedAtRename).toBe("prepared");
    expect(renameCount).toBe(1);
    expect(result.state).toBe("moved");
    expect(result.payloadPath).toBe(payloadPath);
    expect(result.sourcePath).toBe(harness.sourcePath);
    expect(result.sourceFingerprint).toEqual(harness.subject.sourceFingerprint);
    expect(result.sourceParentFingerprint).toEqual(
      await captureFingerprint(harness.allowedRoot),
    );
    expect(await exists(harness.sourcePath)).toBe(false);
    expect(await readFile(payloadPath, "utf8")).toBe("synthetic-object-a");
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
    expect(await exists(join(harness.storeRoot, "quarantine", "artifact-a"))).toBe(
      false,
    );

    const manifestMode = (await stat(
      join(harness.storeRoot, "quarantine", "op-e2e", "manifest.json"),
    )).mode & 0o777;
    const operationDirectoryMode = (await stat(
      join(harness.storeRoot, "quarantine", "op-e2e"),
    )).mode & 0o777;
    expect(manifestMode).toBe(0o600);
    expect(operationDirectoryMode).toBe(0o700);

    const journal = await harness.readJournal();
    const sequences = journal.map((event) => event.eventSequence as number);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);
    expect(journal.at(-1)).toMatchObject({
      operationId: "op-e2e",
      state: "moved",
    });
    expect(JSON.stringify(await harness.readManifest("op-e2e"))).not.toContain(
      token.secret,
    );
  });

  it("повтор operationId возвращает прежний результат без второго rename", async () => {
    harness = await createSyntheticHarness();
    let renameCount = 0;
    const controller = harness.createController({
      fileSystem: {
        rename: async (source, destination) => {
          renameCount += 1;
          await nodeFileSystem.rename(source, destination);
        },
      },
    });
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-idempotent",
    });
    const input = {
      token: preview.secret,
      operationId: "op-idempotent",
      uiSessionId: "ui-idempotent",
    };

    const first = await controller.moveToQuarantine(input);
    const second = await controller.moveToQuarantine(input);

    expect(second).toEqual(first);
    expect(renameCount).toBe(1);
  });

  it("не считает replay валидным для другого token или UI session", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController();
    const original = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-original",
    });
    const other = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-other",
    });
    await controller.moveToQuarantine({
      token: original.secret,
      operationId: "op-replay-binding",
      uiSessionId: "ui-original",
    });

    await expect(
      controller.moveToQuarantine({
        token: original.secret,
        operationId: "op-replay-binding",
        uiSessionId: "ui-other",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
    await expect(
      controller.moveToQuarantine({
        token: other.secret,
        operationId: "op-replay-binding",
        uiSessionId: "ui-other",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
  });

  it("отклоняет operationId, способный изменить fixed destination", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController();
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-operation-path",
    });

    await expect(
      controller.moveToQuarantine({
        token: preview.secret,
        operationId: "../outside",
        uiSessionId: "ui-operation-path",
      }),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
  });

  it("object lock не допускает два rename одного top-level объекта", async () => {
    harness = await createSyntheticHarness();
    let renameCount = 0;
    const controller = harness.createController({
      fileSystem: {
        rename: async (source, destination) => {
          renameCount += 1;
          await nodeFileSystem.rename(source, destination);
        },
      },
    });
    const [previewA, previewB] = await Promise.all([
      controller.prepareMove({
        findingId: harness.subject.findingId,
        auditRevision: 1,
        uiSessionId: "ui-lock-a",
      }),
      controller.prepareMove({
        findingId: harness.subject.findingId,
        auditRevision: 1,
        uiSessionId: "ui-lock-b",
      }),
    ]);

    const results = await Promise.allSettled([
      controller.moveToQuarantine({
        token: previewA.secret,
        operationId: "op-lock-a",
        uiSessionId: "ui-lock-a",
      }),
      controller.moveToQuarantine({
        token: previewB.secret,
        operationId: "op-lock-b",
        uiSessionId: "ui-lock-b",
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(renameCount).toBe(1);
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });

  it("преобразует EXDEV в CROSS_VOLUME и не использует copy-delete", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController({
      fileSystem: {
        rename: async () => {
          throw Object.assign(new Error("synthetic EXDEV"), { code: "EXDEV" });
        },
      },
    });
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-exdev",
    });

    await expect(
      controller.moveToQuarantine({
        token: preview.secret,
        operationId: "op-exdev",
        uiSessionId: "ui-exdev",
      }),
    ).rejects.toMatchObject({ code: "CROSS_VOLUME" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });
});

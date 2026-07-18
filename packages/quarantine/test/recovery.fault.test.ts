import { access, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  InjectedFault,
  type FaultPoint,
  type QuarantineManifest,
} from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function moveWithFault(
  harness: SyntheticHarness,
  operationId: string,
  point: FaultPoint,
): Promise<void> {
  const controller = harness.createController({
    faultInjector: (current) => {
      if (current === point) throw new InjectedFault(point);
    },
  });
  const preview = await controller.prepareMove({
    findingId: harness.subject.findingId,
    auditRevision: 1,
    uiSessionId: `ui-${operationId}`,
  });
  await expect(
    controller.moveToQuarantine({
      token: preview.secret,
      operationId,
      uiSessionId: `ui-${operationId}`,
    }),
  ).rejects.toMatchObject({ point });
}

async function expectRepeatedRecoveryStable(
  harness: SyntheticHarness,
  operationId: string,
): Promise<void> {
  const manifestBefore = await harness.readManifest(operationId);
  const journalBefore = await harness.readJournal();

  const first = await harness.createController().recoverPreparedOperations();
  const manifestAfterFirst = await harness.readManifest(operationId);
  const journalAfterFirst = await harness.readJournal();
  const second = await harness.createController().recoverPreparedOperations();
  const manifestAfterSecond = await harness.readManifest(operationId);
  const journalAfterSecond = await harness.readJournal();

  expect(first).toEqual([manifestBefore]);
  expect(second).toEqual([manifestBefore]);
  expect(manifestAfterFirst).toEqual(manifestBefore);
  expect(manifestAfterSecond).toEqual(manifestBefore);
  expect(manifestAfterFirst.eventSequence).toBe(manifestBefore.eventSequence);
  expect(manifestAfterSecond.eventSequence).toBe(manifestBefore.eventSequence);
  expect(journalAfterFirst).toEqual(journalBefore);
  expect(journalAfterSecond).toEqual(journalBefore);
}

describe("fault injection и recovery", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  it("до manifest не меняет source и не создаёт recovery operation", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-before-manifest", "beforeManifest");

    const recovered = await harness.createController().recoverPreparedOperations();
    expect(recovered).toEqual([]);
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });

  it("после durable prepared восстанавливает 1/0 как aborted", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-after-prepared", "afterPrepared");
    expect(await harness.readManifest("op-after-prepared")).toMatchObject({
      state: "prepared",
    });

    const recovered = await harness.createController().recoverPreparedOperations();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ state: "aborted" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
  });

  it("после filesystem rename восстанавливает 0/1 как moved", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-after-rename", "afterRename");
    const payload = join(
      harness.storeRoot,
      "quarantine",
      "op-after-rename",
      "payload",
      "object",
    );
    expect(await exists(harness.sourcePath)).toBe(false);
    expect(await exists(payload)).toBe(true);

    const recovered = await harness.createController().recoverPreparedOperations();
    expect(recovered[0]).toMatchObject({ state: "moved" });
    expect(await readFile(payload, "utf8")).toBe("synthetic-object-a");
  });

  it("до journal append догоняет moved journal без второго rename", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-before-journal", "beforeJournalAppend");
    const before = await harness.readJournal();
    expect(before.at(-1)).toMatchObject({ state: "prepared" });

    const recovered = await harness.createController().recoverPreparedOperations();
    expect(recovered[0]).toMatchObject({ state: "moved" });
    const after = await harness.readJournal();
    expect(after.at(-1)).toMatchObject({
      operationId: "op-before-journal",
      state: "moved",
    });
  });

  it("два повторных recovery не меняют согласованные manifest и journal после successful move", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController();
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-stable-success",
    });
    await controller.moveToQuarantine({
      token: preview.secret,
      operationId: "op-stable-success",
      uiSessionId: "ui-stable-success",
    });

    await expectRepeatedRecoveryStable(harness, "op-stable-success");
  });

  it("два повторных recovery не меняют manifest и journal после первого catch-up", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-stable-catch-up", "beforeJournalAppend");
    const [caughtUp] = await harness
      .createController()
      .recoverPreparedOperations();
    expect(caughtUp).toMatchObject({ state: "moved" });

    await expectRepeatedRecoveryStable(harness, "op-stable-catch-up");
  });

  it.each([
    {
      name: "malformed schemaVersion",
      mutate: (event: Record<string, unknown>) => ({
        ...event,
        schemaVersion: 2,
      }),
    },
    {
      name: "mismatched lastErrorCode",
      mutate: (event: Record<string, unknown>) => ({
        ...event,
        lastErrorCode: "OPERATION_CONFLICT",
      }),
    },
    {
      name: "mismatched state",
      mutate: (event: Record<string, unknown>) => ({
        ...event,
        state: "prepared",
      }),
    },
  ])(
    "повреждённый journal ($name) даёт MANIFEST_INCONSISTENT и блокирует mutation contour",
    async ({ mutate }) => {
      harness = await createSyntheticHarness();
      const controller = harness.createController();
      const preview = await controller.prepareMove({
        findingId: harness.subject.findingId,
        auditRevision: 1,
        uiSessionId: "ui-invalid-journal",
      });
      await controller.moveToQuarantine({
        token: preview.secret,
        operationId: "op-invalid-journal",
        uiSessionId: "ui-invalid-journal",
      });

      const journal = await harness.readJournal();
      const last = journal.at(-1);
      if (last === undefined) throw new Error("Синтетический journal пуст");
      journal[journal.length - 1] = mutate(last);
      await writeFile(
        join(harness.storeRoot, "journal", "operations.ndjson"),
        `${journal.map((event) => JSON.stringify(event)).join("\n")}\n`,
      );

      const recoveryController = harness.createController();
      await expect(
        recoveryController.recoverPreparedOperations(),
      ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
      expect(recoveryController.isMutationBlocked()).toBe(true);
      await expect(
        recoveryController.prepareMove({
          findingId: harness.subject.findingId,
          auditRevision: 1,
          uiSessionId: "ui-invalid-journal-blocked",
        }),
      ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
    },
  );

  it("recovery matrix 1/1 даёт conflicted", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-conflicted", "afterPrepared");
    const payload = join(
      harness.storeRoot,
      "quarantine",
      "op-conflicted",
      "payload",
      "object",
    );
    await writeFile(payload, "synthetic-conflicting-payload");

    const recovered = await harness.createController().recoverPreparedOperations();
    expect(recovered[0]).toMatchObject({ state: "conflicted" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
    expect(await readFile(payload, "utf8")).toBe("synthetic-conflicting-payload");
  });

  it("recovery matrix 0/0 даёт inconsistent и блокирует mutation contour", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-inconsistent", "afterPrepared");
    await rm(harness.sourcePath);

    const recoveryController = harness.createController();
    const recovered = await recoveryController.recoverPreparedOperations();
    expect(recovered[0]).toMatchObject({ state: "inconsistent" });
    expect(recoveryController.isMutationBlocked()).toBe(true);
    await expect(
      recoveryController.prepareMove({
        findingId: harness.subject.findingId,
        auditRevision: 1,
        uiSessionId: "ui-blocked",
      }),
    ).rejects.toMatchObject({ code: "MANIFEST_INCONSISTENT" });
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });

  it("recovery сохраняет mandatory fingerprints во всех terminal outcomes", async () => {
    harness = await createSyntheticHarness();
    await moveWithFault(harness, "op-fingerprints", "afterPrepared");
    const [manifest] = await harness.createController().recoverPreparedOperations();
    const typed = manifest as QuarantineManifest;

    expect(typed.sourceFingerprint).toEqual(harness.subject.sourceFingerprint);
    expect(typed.sourceParentFingerprint).toEqual(
      harness.subject.sourceParentFingerprint,
    );
  });
});

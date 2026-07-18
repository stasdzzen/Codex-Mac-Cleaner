import { mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { inspectMoveSource } from "../src/index.js";
import { createSyntheticHarness, type SyntheticHarness } from "./helpers.js";

type RaceCase = {
  readonly name: string;
  readonly expectedCode: string;
  mutate(harness: SyntheticHarness): Promise<void>;
};

const raceCases: RaceCase[] = [
  {
    name: "inode",
    expectedCode: "SOURCE_CHANGED",
    mutate: async ({ sourcePath }) => {
      await rm(sourcePath);
      await writeFile(sourcePath, "synthetic-object-a", { mode: 0o600 });
    },
  },
  {
    name: "content",
    expectedCode: "SOURCE_CHANGED",
    mutate: async ({ sourcePath }) => {
      await writeFile(sourcePath, "synthetic-object-a-changed", { mode: 0o600 });
    },
  },
  {
    name: "owner",
    expectedCode: "SOURCE_CHANGED",
    mutate: async (harness) => {
      harness.safety.ownerIdentity = "mismatched";
    },
  },
  {
    name: "type",
    expectedCode: "SOURCE_CHANGED",
    mutate: async ({ sourcePath }) => {
      await rm(sourcePath);
      await mkdir(sourcePath);
    },
  },
  {
    name: "parent",
    expectedCode: "SOURCE_CHANGED",
    mutate: async ({ allowedRoot, sourcePath }) => {
      const oldParent = `${allowedRoot}-old`;
      await rename(allowedRoot, oldParent);
      await mkdir(allowedRoot);
      await rename(join(oldParent, "artifact-a"), sourcePath);
      await rename(join(oldParent, "artifact-b"), join(allowedRoot, "artifact-b"));
    },
  },
  {
    name: "link boundary",
    expectedCode: "SYMLINK_BOUNDARY",
    mutate: async ({ temporaryRoot, sourcePath }) => {
      const target = join(temporaryRoot, "link-target");
      await writeFile(target, "synthetic-link-target");
      await rm(sourcePath);
      await symlink(target, sourcePath);
    },
  },
  {
    name: "mount identity",
    expectedCode: "SOURCE_CHANGED",
    mutate: async (harness) => {
      const current = await inspectMoveSource({
        allowedRoot: harness.allowedRoot,
        sourcePath: harness.sourcePath,
      });
      harness.safety.evaluatedFingerprintOverride = {
        ...current.sourceFingerprint,
        mountId: "synthetic-other-mount",
      };
    },
  },
  {
    name: "activity",
    expectedCode: "ACTIVE_PROCESS",
    mutate: async (harness) => {
      harness.safety.activityState = "active";
    },
  },
  {
    name: "open file",
    expectedCode: "OPEN_FILE",
    mutate: async (harness) => {
      harness.safety.openFileState = "open";
    },
  },
];

describe("TOCTOU race matrix", () => {
  let harness: SyntheticHarness | undefined;

  afterEach(async () => harness?.cleanup());

  for (const race of raceCases) {
    it(`блокирует изменение ${race.name} между preview и confirm`, async () => {
      harness = await createSyntheticHarness();
      const controller = harness.createController();
      const preview = await controller.prepareMove({
        findingId: harness.subject.findingId,
        auditRevision: 1,
        uiSessionId: `ui-race-${race.name.replaceAll(" ", "-")}`,
      });
      await race.mutate(harness);

      await expect(
        controller.moveToQuarantine({
          token: preview.secret,
          operationId: `op-race-${race.name.replaceAll(" ", "-")}`,
          uiSessionId: `ui-race-${race.name.replaceAll(" ", "-")}`,
        }),
      ).rejects.toMatchObject({ code: race.expectedCode });

      expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
      const journal = await harness.readJournal();
      expect(journal.some((event) => event.state === "moved")).toBe(false);
    });
  }

  it("повторяет policy/protected/sensitivity checks непосредственно перед действием", async () => {
    harness = await createSyntheticHarness();
    const controller = harness.createController();
    const preview = await controller.prepareMove({
      findingId: harness.subject.findingId,
      auditRevision: 1,
      uiSessionId: "ui-policy-race",
    });
    harness.safety.protectedScope = true;
    harness.safety.sensitivityFlags = ["personal_data"];

    await expect(
      controller.moveToQuarantine({
        token: preview.secret,
        operationId: "op-policy-race",
        uiSessionId: "ui-policy-race",
      }),
    ).rejects.toMatchObject({ code: "PROTECTED_SCOPE" });
    expect(await readFile(harness.sourcePath, "utf8")).toBe("synthetic-object-a");
    expect(await readFile(harness.otherPath, "utf8")).toBe("synthetic-object-b");
  });
});

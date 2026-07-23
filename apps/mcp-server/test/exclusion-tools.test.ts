import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { UserExclusionIdentity } from "@codex-mac-cleaner/contracts";
import {
  deriveKeyedUserExclusion,
  InstallationKeyStore,
  KeyedExclusionStateStore,
  type KeyedExclusionMetadata,
} from "@codex-mac-cleaner/storage";
import { describe, expect, it } from "vitest";

import {
  APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS,
  ExclusionService,
  createMcpServer,
} from "../src/server.js";

const identity = "a".repeat(64);
const now = () => new Date("2026-07-18T01:00:00.000Z");

async function serviceFixture() {
  const stateRoot = join(await mkdtemp(join(tmpdir(), "cmc-server-exclusions-")), "state");
  let sequence = 0;
  const keyedStore = new KeyedExclusionStateStore({ stateRoot, now });
  const installationKey = await new InstallationKeyStore({ stateRoot }).loadOrCreate();
  const rawIdentity = (value: UserExclusionIdentity) => ({
    targetIdentity: value.normalizedTargetIdentity,
    ownerTypeFingerprint: value.ownerTypeFingerprint,
    ...(value.bundleId == null ? {} : { bundleIdentifier: value.bundleId }),
    ...(value.packageId == null ? {} : { packageIdentifier: value.packageId }),
    ...(value.signingIdentity == null
      ? {}
      : { signingRequirement: value.signingIdentity }),
  });
  const store = {
    list: () => keyedStore.list(),
    async create(
      metadata: KeyedExclusionMetadata,
      value: UserExclusionIdentity,
    ) {
      await keyedStore.createFromIdentity(metadata, rawIdentity(value));
      return keyedStore.list();
    },
    remove: (exclusionId: string) => keyedStore.remove(exclusionId),
    reset: (stateVersion: number) => keyedStore.reset(stateVersion),
    readForAudit: () => keyedStore.readForAudit(),
    deriveIdentity(value: UserExclusionIdentity) {
      const keyed = deriveKeyedUserExclusion(
        installationKey,
        {
          exclusionId: "exclusion-identity-probe",
          ruleId: value.ruleId,
          artifactKind: value.artifactKind,
          createdAt: "1970-01-01T00:00:00.000Z",
          reasonCategory: "other",
        },
        rawIdentity(value),
      );
      return {
        ruleId: keyed.ruleId,
        artifactKind: keyed.artifactKind,
        keyId: keyed.keyId,
        derivationVersion: keyed.derivationVersion,
        subjectDigest: keyed.subjectDigest,
        claimDigests: keyed.claimDigests,
      };
    },
  };
  const service = new ExclusionService({
    store,
    now,
    createId: (prefix) => `${prefix}-synthetic-${++sequence}`,
    findings: {
      async resolveIdentity(findingId, auditRevision) {
        if (findingId !== "finding-synthetic-a" || auditRevision !== 7) return null;
        return {
          ruleId: "RULE_SYNTHETIC_CACHE",
          artifactKind: "directory",
          normalizedTargetIdentity: `target:v1:${identity}`,
          bundleId: "org.example.synthetic",
          packageId: null,
          signingIdentity: `signing:v1:${identity}`,
          ownerTypeFingerprint: `owner-type:v1:${identity}`,
        };
      },
    },
  });
  return { service, stateRoot };
}

describe("app-visible exclusion tools", () => {
  it("регистрирует ровно пять app-only tools со strict schemas", async () => {
    const { service } = await serviceFixture();
    const server = createMcpServer(
      { platform: "darwin", arch: "arm64", release: "26.0.0" },
      { exclusionService: service },
    );
    const client = new Client({ name: "exclusion-contract", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      expect(Object.keys(APP_VISIBLE_EXCLUSION_TOOL_DEFINITIONS)).toEqual([
        "exclusion_create",
        "exclusion_list",
        "exclusion_remove",
        "exclusion_reset_prepare",
        "exclusion_reset",
      ]);
      const listed = await client.listTools();
      const appTools = listed.tools.filter((tool) => tool.name.startsWith("exclusion_"));
      expect(appTools).toHaveLength(5);
      for (const tool of appTools) {
        expect(tool._meta).toMatchObject({ ui: { visibility: ["app"] } });
        expect(tool.inputSchema).toMatchObject({
          type: "object",
          additionalProperties: false,
        });
        expect(tool.outputSchema).toMatchObject({
          type: "object",
          additionalProperties: false,
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("create/list/remove используют только IDs и не возвращают identity", async () => {
    const { service } = await serviceFixture();
    const created = await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-a",
      reasonCategory: "keep_data",
    });
    const listed = await service.list({});
    const serialized = JSON.stringify(listed);

    expect(created.exclusion.reasonCategory).toBe("keep_data");
    expect(listed.exclusions).toHaveLength(1);
    expect(serialized).not.toMatch(/target|bundle|package|signing|owner|path/i);
    expect(
      await service.remove({
        exclusionId: created.exclusion.exclusionId,
        requestId: "request-create-a",
      }),
    ).toMatchObject({ removedExclusionId: created.exclusion.exclusionId });
  });

  it("reset all требует отдельный одноразовый token", async () => {
    const { service } = await serviceFixture();
    await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-a",
      reasonCategory: "user_choice",
    });
    const prepared = await service.resetPrepare({ requestId: "request-prepare-a" });
    expect(prepared.exclusionCount).toBe(1);

    await expect(
      service.reset({ resetToken: "reset-forged", requestId: "request-reset-forged" }),
    ).rejects.toMatchObject({ errorCode: "PREVIEW_EXPIRED" });
    expect(
      await service.reset({
        resetToken: prepared.resetToken,
        requestId: "request-reset-a",
      }),
    ).toMatchObject({ removedCount: 1 });
    await expect(
      service.reset({
        resetToken: prepared.resetToken,
        requestId: "request-reset-replay-a",
      }),
    ).rejects.toMatchObject({ errorCode: "PREVIEW_EXPIRED" });
  });

  it("не применяет reset token после изменения подготовленного stateVersion", async () => {
    const { service } = await serviceFixture();
    const first = await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-before-prepare",
      reasonCategory: "user_choice",
    });
    const prepared = await service.resetPrepare({
      requestId: "request-prepare-stale-state",
    });
    const addedAfterPrepare = await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-after-prepare",
      reasonCategory: "keep_data",
    });

    await expect(
      service.reset({
        resetToken: prepared.resetToken,
        requestId: "request-reset-stale-state",
      }),
    ).rejects.toMatchObject({ errorCode: "PREVIEW_EXPIRED" });
    expect((await service.list({})).exclusions.map((item) => item.exclusionId)).toEqual([
      first.exclusion.exclusionId,
      addedAfterPrepare.exclusion.exclusionId,
    ]);
  });

  it("не применяет reset token после удаления из подготовленного stateVersion", async () => {
    const { service } = await serviceFixture();
    const removedAfterPrepare = await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-to-remove",
      reasonCategory: "user_choice",
    });
    const retained = await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-to-retain",
      reasonCategory: "keep_data",
    });
    const prepared = await service.resetPrepare({
      requestId: "request-prepare-before-remove",
    });
    await service.remove({
      exclusionId: removedAfterPrepare.exclusion.exclusionId,
      requestId: "request-remove-after-prepare",
    });

    await expect(
      service.reset({
        resetToken: prepared.resetToken,
        requestId: "request-reset-after-remove",
      }),
    ).rejects.toMatchObject({ errorCode: "PREVIEW_EXPIRED" });
    expect((await service.list({})).exclusions.map((item) => item.exclusionId)).toEqual([
      retained.exclusion.exclusionId,
    ]);
  });

  it("повторно проверяет exclusion непосредственно перед destructive token", async () => {
    const { service } = await serviceFixture();
    await service.create({
      findingId: "finding-synthetic-a",
      auditRevision: 7,
      requestId: "request-create-a",
      reasonCategory: "user_choice",
    });

    await expect(
      service.assertFindingCanReceiveDestructiveToken("finding-synthetic-a", 7),
    ).rejects.toMatchObject({ errorCode: "EXCLUDED_FINDING" });
  });
});

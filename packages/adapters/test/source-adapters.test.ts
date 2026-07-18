import { describe, expect, it } from "vitest";

import {
  createAutostartAdapter,
  createFilesystemMetadataAdapter,
  createInspectionOnlyAdapter,
  createProtectedContainerAdapter,
  createReceiptsAdapter,
  type TargetedRecord,
} from "../src/index.js";
import { SyntheticFileSystem } from "./helpers.js";

const record = (
  overrides: Pick<TargetedRecord, "kind"> & Partial<TargetedRecord>,
): TargetedRecord => ({
  ref: "record-synthetic",
  displayName: "Synthetic Item",
  modifiedAt: "2026-01-01T00:00:00.000Z",
  fingerprint: "fingerprint-synthetic",
  ...overrides,
});

describe("Targeted read-only adapters", () => {
  it("фиксирует login/background/launch items и missing executable как typed evidence", async () => {
    const filesystem = new SyntheticFileSystem({}, {
      autostart: [
        record({ kind: "login_item", executableState: "present" }),
        record({ kind: "background_item", executableState: "present" }),
        record({ kind: "launch_item", executableState: "absent" }),
      ],
    });
    const result = await createAutostartAdapter(filesystem).scan({ signal: new AbortController().signal });

    expect(result.observations.map(({ evidenceKind }) => evidenceKind)).toEqual([
      "startup_item",
      "startup_item",
      "missing_executable",
    ]);
  });

  it("фиксирует stale receipts и official uninstallers без ready-to-run guidance", async () => {
    const filesystem = new SyntheticFileSystem({}, {
      receipts: [
        record({ kind: "receipt", stale: false }),
        record({ kind: "receipt", stale: true }),
        record({ kind: "official_uninstaller", recommendedMethod: "official_uninstaller" }),
      ],
    });
    const result = await createReceiptsAdapter(filesystem).scan({ signal: new AbortController().signal });

    expect(result.observations.map(({ evidenceKind }) => evidenceKind)).toEqual([
      "receipt",
      "stale_receipt",
      "official_uninstaller",
    ]);
    expect(result.observations[2]).toMatchObject({
      supportLevel: "analysis_only",
      recommendedMethod: "official_uninstaller",
      allowedActions: ["inspect"],
    });
    expect(JSON.stringify(result)).not.toMatch(/sudo|\brm\b|launchctl|tccutil/i);
  });

  it("возвращает filesystem/APFS/Time Machine observations без causal claim", async () => {
    const filesystem = new SyntheticFileSystem({}, {
      filesystem: [record({ kind: "filesystem_metadata", logicalSize: 256, physicalSize: 128 })],
      disk: [record({ kind: "apfs_observation" }), record({ kind: "time_machine_observation" })],
    });
    const result = await createFilesystemMetadataAdapter(filesystem).scan({ signal: new AbortController().signal });

    expect(result.observations.map(({ evidenceKind }) => evidenceKind)).toEqual([
      "filesystem_metadata",
      "apfs_observation",
      "time_machine_observation",
    ]);
    expect(result.observations.every(({ allowedActions }) => allowedActions.length === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/freed|reclaimed|освобожд/i);
  });

  it("сводит protected container к metadata shell", async () => {
    const filesystem = new SyntheticFileSystem({}, {
      protected_containers: [record({ kind: "protected_container", sensitivityFlags: ["personal_data"] })],
    });
    const result = await createProtectedContainerAdapter(filesystem).scan({ signal: new AbortController().signal });

    expect(result.observations[0]).toMatchObject({
      evidenceKind: "protected_container_metadata",
      supportLevel: "analysis_only",
      allowedActions: [],
    });
  });

  it.each([
    "relocated_item",
    "system_helper",
    "launch_daemon",
    "framework",
    "printer_remnant",
    "vpn_remnant",
    "service",
    "snapshot",
  ] as const)("помечает %s только как unsupported_manual", async (kind) => {
    const filesystem = new SyntheticFileSystem({}, { inspection: [record({ kind })] });
    const result = await createInspectionOnlyAdapter(filesystem).scan({ signal: new AbortController().signal });
    const observation = result.observations[0];

    expect(observation).toMatchObject({ supportLevel: "unsupported_manual", allowedActions: ["inspect"] });
    expect(observation?.safeExplanation).toBe("Требует расширенного режима");
    expect(JSON.stringify(observation)).not.toMatch(/sudo|\brm\b|launchctl|tccutil|full disk access/i);
  });
});

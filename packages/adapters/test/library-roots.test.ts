import { describe, expect, it } from "vitest";

import {
  ALLOWLISTED_LIBRARY_ROOTS,
  createLibraryRootsAdapter,
  type AdapterFileEntry,
} from "../src/index.js";
import { SyntheticFileSystem } from "./helpers.js";

const safeEntry = (overrides: Partial<AdapterFileEntry> = {}): AdapterFileEntry => ({
  ref: "entry-safe",
  displayName: "Synthetic Cache",
  kind: "directory",
  logicalSize: 128,
  physicalSize: 64,
  modifiedAt: "2026-01-01T00:00:00.000Z",
  fingerprint: "fingerprint-safe",
  volumeKind: "internal_apfs",
  protection: [],
  ...overrides,
});

describe("Library adapter", () => {
  it("перечисляет ровно девять allowlisted roots и возвращает safe candidates", async () => {
    const filesystem = new SyntheticFileSystem({ Caches: [safeEntry()] });
    const result = await createLibraryRootsAdapter(filesystem).scan({
      signal: new AbortController().signal,
    });

    expect(filesystem.libraryCalls).toEqual(ALLOWLISTED_LIBRARY_ROOTS);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      source: "user_library_artifacts",
      evidenceKind: "library_artifact",
      supportLevel: "candidate",
    });
  });

  it("не создаёт candidates и не перечисляет содержимое protected classes", async () => {
    const protectedCases: AdapterFileEntry[] = [
      safeEntry({ ref: "codex", protection: ["codex_state"] }),
      safeEntry({ ref: "system", protection: ["system_scope"] }),
      safeEntry({ ref: "project", protection: ["current_project"] }),
      safeEntry({ ref: "plugin", protection: ["plugin_state"] }),
      safeEntry({ ref: "quarantine", protection: ["quarantine_state"] }),
      safeEntry({ ref: "credential", protection: ["credentials"] }),
      safeEntry({ ref: "browser", protection: ["browser_profile"] }),
      safeEntry({ ref: "personal", protection: ["personal_data"] }),
      safeEntry({ ref: "developer", protection: ["developer_artifact"] }),
      safeEntry({ ref: "git", protection: ["local_git_project"] }),
      safeEntry({ ref: "external", volumeKind: "external" }),
      safeEntry({ ref: "network", volumeKind: "network" }),
    ];
    const filesystem = new SyntheticFileSystem({ "Application Support": protectedCases });
    const result = await createLibraryRootsAdapter(filesystem).scan({
      signal: new AbortController().signal,
    });

    expect(result.observations).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/codex|project|plugin|quarantine|credential|browser|personal|developer|external|network/);
  });

  it("превращает denied root в typed coverage gap без локального path", async () => {
    const filesystem = new SyntheticFileSystem({}, {}, new Set(["Containers"]));
    const result = await createLibraryRootsAdapter(filesystem).scan({
      signal: new AbortController().signal,
    });

    expect(result.warnings).toContainEqual({
      source: "user_library_artifacts",
      capability: "library:containers",
      errorCode: "PERMISSION_DENIED",
      safeMessage: "Источник недоступен из-за ограничений доступа",
    });
    expect(JSON.stringify(result)).not.toMatch(/Operation not permitted|\/Users\//);
  });
});

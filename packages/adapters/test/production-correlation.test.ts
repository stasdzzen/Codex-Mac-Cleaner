import { createHash } from "node:crypto";

import { InstallationKey, type KeyedOwnerBindingHistoryRecord } from "@codex-mac-cleaner/storage";
import { describe, expect, it } from "vitest";

import {
  consumeEphemeralCorrelationInput,
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
  type MacOSOwnerBindingHistory,
  type RawCorrelationPayload,
} from "../src/index.js";

const fixedNow = "2026-07-18T00:00:00.000Z";
const rawCanary = "PRIVATE-PRODUCTION-LIBRARY-CANARY";
const home = `/private/${rawCanary}/home`;
const candidatePath = `${home}/Library/Caches/Owner/private-cache`;
const parentPath = `${home}/Library/Caches/Owner`;
const ownerApp = "/Applications/Owner.app";
const ownerExecutable = `${ownerApp}/Contents/MacOS/Owner`;

class MemoryHistory implements MacOSOwnerBindingHistory {
  records: readonly KeyedOwnerBindingHistoryRecord[] = [];
  async list() { return this.records; }
  async replace(records: readonly KeyedOwnerBindingHistoryRecord[]) { this.records = records; }
}

function id(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

function harness() {
  let ownerInstalled = true;
  let ownerRunning = true;
  let ownerOpen = true;
  const calls: Array<{ executable: string; argv: readonly string[]; shell: boolean }> = [];
  const executor: ArgvExecutor = async (executable, argv, options) => {
    calls.push({ executable, argv, shell: options.shell });
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkgs") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--file-info") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/bin/plutil") {
      return {
        stdout: JSON.stringify({
          CFBundleIdentifier: `org.private.${rawCanary}`,
          CFBundleExecutable: "Owner",
          CFBundleName: "Owner",
        }),
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/bin/codesign") {
      return {
        stdout: "",
        stderr: "designated => identifier org.private.owner and anchor apple generic\nTeamIdentifier=TEAMPRIVATE\n",
        exitCode: 0,
      };
    }
    if (executable === "/bin/ps") {
      return {
        stdout: ownerRunning ? `42 Sat Jul 18 00:00:00 2026 ${ownerExecutable}\n` : "",
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/lsof") {
      return {
        stdout: ownerOpen ? `p42\ncOwner\nn${candidatePath}\n` : "",
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const filesystem: MacOSCorrelationReadOnlyFileSystem = {
    canonicalize: async (path) => path,
    stat: async (path) => ({
      device: "device-a",
      inode: id(path),
      fileType: path.endsWith(".app") ? "bundle" : path === ownerExecutable ? "file" : "directory",
      uid: 501,
      gid: 20,
      size: 1,
      modifiedAtMs: 1,
    }),
    readDirectory: async (path) => {
      if (path === "/Applications") {
        return ownerInstalled ? [{ path: ownerApp, fileType: "bundle" }] : [];
      }
      if (
        path === "/System/Applications" ||
        path === `${home}/Applications` ||
        path === "/Library/LaunchAgents" ||
        path === "/Library/LaunchDaemons" ||
        path === `${home}/Library/LaunchAgents`
      ) return [];
      return [];
    },
  };
  const history = new MemoryHistory();
  const key = new InstallationKey(new Uint8Array(32).fill(7));
  const adapter = createMacOSProductionCorrelationAdapter({
    commands: createCommandRunner(executor),
    candidates: createMacOSCandidateRegistry({
      candidates: new Map([["candidate-ref-library", candidatePath]]),
      userHome: home,
    }),
    filesystem,
    installationKey: key,
    ownerBindingHistory: history,
    now: () => fixedNow,
  });
  return {
    adapter,
    calls,
    history,
    removeOwner() {
      ownerInstalled = false;
      ownerRunning = false;
      ownerOpen = false;
    },
  };
}

async function payloadFrom(adapter: ReturnType<typeof createMacOSProductionCorrelationAdapter>, snapshotId: string) {
  const input = await adapter.buildInput({
    candidateRef: "candidate-ref-library",
    snapshotId,
    signal: new AbortController().signal,
  });
  return consumeEphemeralCorrelationInput(input, (payload) => payload);
}

describe("concrete macOS production correlation collector v2", () => {
  it("оставляет candidate Library artifact и владеет canonical argv/parsing", async () => {
    const test = harness();
    const payload = await payloadFrom(test.adapter, "snapshot-library-a");

    expect(payload.schemaVersion).toBe(2);
    expect(payload.artifactCategory).toBe("cache");
    expect(payload.artifactPrivateNonExecutable).toBe(true);
    expect(payload.candidate).toMatchObject({
      subjectRole: "library_artifact",
      subjectKind: "filesystem_object",
    });
    expect(payload.candidate.claims.map(({ kind }) => kind)).toEqual(["filesystem", "owner"]);
    expect(payload.queries.map(({ queryScope }) => queryScope)).toEqual([
      "owner_bindings",
      "installed_apps",
      "owner_executables",
      "processes",
      "open_files",
      "startup_targets",
      "receipts",
      "official_uninstallers",
      "dependencies",
    ]);
    expect(test.calls).toEqual(expect.arrayContaining([
      { executable: "/usr/sbin/pkgutil", argv: ["--pkgs"], shell: false },
      { executable: "/usr/sbin/pkgutil", argv: ["--file-info", candidatePath], shell: false },
      { executable: "/bin/ps", argv: ["-axo", "pid=,lstart=,comm="], shell: false },
      { executable: "/usr/sbin/lsof", argv: ["-nP", "-Fpcn", "-d", "cwd,txt"], shell: false },
      { executable: "/usr/bin/codesign", argv: ["-d", "-r-", "--verbose=4", ownerApp], shell: false },
    ]));
    expect(JSON.stringify({
      candidate: payload.candidate.subjectRole,
      scopes: payload.queries.map(({ queryScope, state }) => ({ queryScope, state })),
    })).not.toContain(rawCanary);
  });

  it("создаёт signed process/open history в N и использует только в N+1", async () => {
    const test = harness();
    const revisionN = await payloadFrom(test.adapter, "snapshot-library-n");
    expect(revisionN.queries.find(({ queryScope }) => queryScope === "owner_bindings")?.subjects).toEqual([]);
    expect(test.history.records).toHaveLength(1);

    test.removeOwner();
    const revisionN1 = await payloadFrom(test.adapter, "snapshot-library-n1");
    const binding = revisionN1.queries.find(({ queryScope }) => queryScope === "owner_bindings")!;
    expect(binding.state).toBe("complete");
    expect(binding.subjects).toHaveLength(1);
    expect(binding.subjects[0]).toMatchObject({
      subjectRole: "owner_application",
      bindingSourceKind: "signed_process_open_file_history",
    });
    expect(revisionN1.queries.find(({ queryScope }) => queryScope === "installed_apps")?.subjects).toEqual([]);
    expect(revisionN1.queries.find(({ queryScope }) => queryScope === "owner_executables")?.subjects).toEqual([]);
    expect(revisionN1.snapshotA).toEqual(revisionN1.snapshotB);
    expect(JSON.stringify(test.history.records)).not.toContain(rawCanary);
    expect(JSON.stringify(test.history.records)).not.toContain(candidatePath);
  });

  it("canonical package failure не превращается в complete/absent", async () => {
    const executor: ArgvExecutor = async (executable, argv) => {
      if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkgs") {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-failure",
        inode: id(path),
        fileType: "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async () => [],
    };
    const adapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-ref-library", candidatePath]]),
        userHome: home,
      }),
      filesystem,
      now: () => fixedNow,
    });
    const payload = await payloadFrom(adapter, "snapshot-failure");
    const states = Object.fromEntries(payload.queries.map(({ queryScope, state }) => [queryScope, state]));
    expect(states.installed_apps).toBe("permission_denied");
    expect(states.receipts).toBe("permission_denied");
    expect(states.official_uninstallers).toBe("permission_denied");
    expect(states.owner_executables).toBe("permission_denied");
    expect(states.owner_bindings).toBe("permission_denied");
  });

  it("Snapshot A/B race фиксируется в raw production snapshots", async () => {
    let candidateReads = 0;
    const executor: ArgvExecutor = async () => ({ stdout: "", stderr: "", exitCode: 0 });
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-race",
        inode: path === candidatePath ? `candidate-${candidateReads++}` : id(path),
        fileType: "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async () => [],
    };
    const adapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({ candidates: new Map([["candidate-ref-library", candidatePath]]), userHome: home }),
      filesystem,
      now: () => fixedNow,
    });
    const payload = await payloadFrom(adapter, "snapshot-race");
    expect(payload.snapshotA.candidateFingerprint).not.toBe(payload.snapshotB.candidateFingerprint);
  });

  it("ephemeral payload остаётся non-serializable", async () => {
    const test = harness();
    const input = await test.adapter.buildInput({
      candidateRef: "candidate-ref-library",
      snapshotId: "snapshot-private",
      signal: new AbortController().signal,
    });
    expect(input.describe()).toEqual({ schemaVersion: 2, snapshotId: "snapshot-private", queryCount: 9 });
    expect(() => JSON.stringify(input)).toThrowError("Raw correlation input нельзя сериализовать");
  });
});

void ({} satisfies Partial<RawCorrelationPayload>);

import { describe, expect, it } from "vitest";

import {
  consumeEphemeralCorrelationInput,
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
} from "../src/index.js";

const now = "2026-07-18T00:00:00.000Z";
const rawCanary = "PRIVATE-PRODUCTION-CORRELATION-CANARY";

describe("concrete macOS production correlation collector", () => {
  it("строится только из low-level runner/registry/filesystem и владеет argv/parsing", async () => {
    const calls: Array<{
      executable: string;
      argv: readonly string[];
      shell: boolean;
    }> = [];
    const candidatePath = `/private/${rawCanary}/Candidate.app`;
    const executablePath = `${candidatePath}/Contents/MacOS/Candidate`;
    const executor: ArgvExecutor = async (executable, argv, options) => {
      calls.push({ executable, argv, shell: options.shell });
      if (executable === "/usr/bin/plutil") {
        return {
          stdout: JSON.stringify({
            CFBundleIdentifier: `org.private.${rawCanary}`,
            CFBundleExecutable: "Candidate",
          }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/codesign") {
        return {
          stdout: "",
          stderr: "designated => requirement-private\nTeamIdentifier=TEAMPRIVATE\n",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-low-level",
        inode: path === executablePath ? "inode-executable" : `inode-${path.length}`,
        fileType: path.endsWith(".app") ? "bundle" : path === executablePath ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async () => [],
    };
    let clockTick = 0;
    const adapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-ref-low-level", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => new Date(Date.parse(now) + clockTick++).toISOString(),
    });

    const input = await adapter.buildInput({
      candidateRef: "candidate-ref-low-level",
      snapshotId: "snapshot-low-level",
      signal: new AbortController().signal,
    });

    expect(input.describe()).toEqual({
      schemaVersion: 1,
      snapshotId: "snapshot-low-level",
      queryCount: 8,
    });
    consumeEphemeralCorrelationInput(input, (payload) => {
      expect(payload.queries.map(({ queryScope }) => queryScope)).toEqual([
        "installed_apps",
        "processes",
        "open_files",
        "startup_targets",
        "target_executables",
        "receipts",
        "official_uninstallers",
        "dependencies",
      ]);
      expect(payload.candidate.claims.map(({ kind }) => kind)).toEqual(
        expect.arrayContaining(["filesystem", "bundle", "signing", "owner", "executable"]),
      );
      expect(payload.snapshotA).toEqual(payload.snapshotB);
    });
    expect(calls).toEqual(expect.arrayContaining([
      {
        executable: "/usr/bin/mdfind",
        argv: ["kMDItemContentType == 'com.apple.application-bundle'"],
        shell: false,
      },
      {
        executable: "/bin/ps",
        argv: ["-axo", "pid=,lstart=,comm="],
        shell: false,
      },
      {
        executable: "/usr/sbin/lsof",
        argv: ["-nP", "-Fpcn", "-d", "cwd,txt"],
        shell: false,
      },
      {
        executable: "/usr/sbin/pkgutil",
        argv: ["--file-info", candidatePath],
        shell: false,
      },
    ]));
    expect(calls.every(({ shell }) => shell === false)).toBe(true);
  });

  it("нормализует native outputs во все восемь candidate-specific scopes", async () => {
    const candidatePath = `/private/${rawCanary}/Candidate.app`;
    const candidateExecutable = `${candidatePath}/Contents/MacOS/Candidate`;
    const dependentPath = `/private/${rawCanary}/Dependent.app`;
    const dependentExecutable = `${dependentPath}/Contents/MacOS/Dependent`;
    const startupPlist = `/private/${rawCanary}/synthetic-user-root/Library/LaunchAgents/private.plist`;
    const calls: Array<{ executable: string; argv: readonly string[]; shell: boolean }> = [];
    const executor: ArgvExecutor = async (executable, argv, options) => {
      calls.push({ executable, argv, shell: options.shell });
      if (executable === "/usr/bin/mdfind") {
        return {
          stdout: `${candidatePath}\n${dependentPath}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/bin/ps") {
        return {
          stdout: `101 Mon Jul 18 12:00:00 2026 ${candidateExecutable}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/sbin/lsof") {
        return {
          stdout: `p101\ncCandidate\nn${candidatePath}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/sbin/pkgutil") {
        return {
          stdout: "pkgid: package.private.candidate\n",
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/otool") {
        return {
          stdout: `${dependentExecutable}:\n\t${candidateExecutable} (compatibility version 1.0.0, current version 1.0.0)\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/plutil") {
        const target = argv.at(-1);
        if (target === startupPlist) {
          return {
            stdout: JSON.stringify({ Program: candidateExecutable }),
            stderr: "",
            exitCode: 0,
          };
        }
        const dependent = target?.startsWith(dependentPath) === true;
        return {
          stdout: JSON.stringify(dependent
            ? {
                CFBundleIdentifier: "org.private.dependent",
                CFBundleExecutable: "Dependent",
              }
            : {
                CFBundleIdentifier: "org.private.candidate",
                CFBundleExecutable: "Candidate",
                CodexMacCleanerOfficialUninstallerExecutable: "Candidate",
              }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/codesign") {
        const dependent = argv.at(-1) === dependentPath;
        return {
          stdout: "",
          stderr: dependent
            ? "designated => requirement-dependent\nTeamIdentifier=TEAMDEPENDENT\n"
            : "designated => requirement-candidate\nTeamIdentifier=TEAMCANDIDATE\n",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-all-scopes",
        inode: `inode-${path.length}`,
        fileType: path.endsWith(".app")
          ? "bundle"
          : path.includes("/Contents/MacOS/") ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async (path) => path.endsWith("Library/LaunchAgents")
        ? [{ path: startupPlist, fileType: "file" }]
        : [],
    };
    const adapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-ref-all-scopes", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => now,
    });
    const input = await adapter.buildInput({
      candidateRef: "candidate-ref-all-scopes",
      snapshotId: "snapshot-all-scopes",
      signal: new AbortController().signal,
    });

    consumeEphemeralCorrelationInput(input, (payload) => {
      expect(Object.fromEntries(payload.queries.map((query) => [
        query.queryScope,
        { state: query.state, count: query.subjects.length },
      ]))).toEqual({
        installed_apps: { state: "complete", count: 2 },
        processes: { state: "complete", count: 1 },
        open_files: { state: "complete", count: 1 },
        startup_targets: { state: "complete", count: 1 },
        target_executables: { state: "complete", count: 1 },
        receipts: { state: "complete", count: 1 },
        official_uninstallers: { state: "complete", count: 1 },
        dependencies: { state: "complete", count: 1 },
      });
      expect(payload.candidate.claims.map(({ kind }) => kind)).toEqual(
        expect.arrayContaining([
          "filesystem",
          "bundle",
          "package",
          "signing",
          "owner",
          "executable",
        ]),
      );
      expect(payload.snapshotA).toEqual(payload.snapshotB);
    });
    expect(calls.some(({ executable, argv }) =>
      executable === "/usr/bin/otool" && argv[0] === "-L"
    )).toBe(true);
    expect(calls.every(({ shell }) => shell === false)).toBe(true);
  });

  it("повторный collection cycle фиксирует process race в Snapshot A/B", async () => {
    const candidatePath = `/private/${rawCanary}/Race.app`;
    const executablePath = `${candidatePath}/Contents/MacOS/Race`;
    let processCycle = 0;
    const executor: ArgvExecutor = async (executable) => {
      if (executable === "/usr/bin/plutil") {
        return {
          stdout: JSON.stringify({
            CFBundleIdentifier: "org.private.race",
            CFBundleExecutable: "Race",
          }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/codesign") {
        return {
          stdout: "",
          stderr: "designated => requirement-race\nTeamIdentifier=TEAMRACE\n",
          exitCode: 0,
        };
      }
      if (executable === "/bin/ps") {
        processCycle += 1;
        return {
          stdout: processCycle === 1
            ? `101 Mon Jul 18 12:00:00 2026 ${executablePath}\n`
            : "",
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-race",
        inode: `inode-${path.length}`,
        fileType: path.endsWith(".app") ? "bundle" : path === executablePath ? "file" : "directory",
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
        candidates: new Map([["candidate-ref-race", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => now,
    });
    const input = await adapter.buildInput({
      candidateRef: "candidate-ref-race",
      snapshotId: "snapshot-race",
      signal: new AbortController().signal,
    });

    consumeEphemeralCorrelationInput(input, (payload) => {
      expect(payload.queries.find(({ queryScope }) => queryScope === "processes")?.subjects)
        .toHaveLength(1);
      expect(payload.snapshotA.processFingerprint).not.toBe(
        payload.snapshotB.processFingerprint,
      );
    });
  });

  it("permission/capability/timeout/cancellation/partial дают fail-closed states", async () => {
    const candidatePath = `/private/${rawCanary}/Failures.app`;
    const executablePath = `${candidatePath}/Contents/MacOS/Failures`;
    const executor: ArgvExecutor = async (executable) => {
      if (executable === "/usr/bin/plutil") {
        return {
          stdout: JSON.stringify({
            CFBundleIdentifier: "org.private.failures",
            CFBundleExecutable: "Failures",
          }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/codesign") {
        return {
          stdout: "",
          stderr: "designated => requirement-failures\nTeamIdentifier=TEAMFAIL\n",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/mdfind") {
        throw Object.assign(new Error("private capability detail"), { code: "ENOENT" });
      }
      if (executable === "/bin/ps") {
        throw Object.assign(new Error("private permission detail"), { code: "EACCES" });
      }
      if (executable === "/usr/sbin/lsof") {
        throw new DOMException("private cancellation detail", "AbortError");
      }
      if (executable === "/usr/sbin/pkgutil") {
        throw Object.assign(new Error("private timeout detail"), { code: "ETIMEDOUT" });
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-failures",
        inode: `inode-${path.length}`,
        fileType: path.endsWith(".app") ? "bundle" : path === executablePath ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async (path) => {
        if (path === "/Library/LaunchAgents") {
          throw Object.assign(new Error("private startup permission"), { code: "EPERM" });
        }
        return [];
      },
    };
    const adapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-ref-failures", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => now,
    });
    const input = await adapter.buildInput({
      candidateRef: "candidate-ref-failures",
      snapshotId: "snapshot-failures",
      signal: new AbortController().signal,
    });

    consumeEphemeralCorrelationInput(input, (payload) => {
      const states = Object.fromEntries(
        payload.queries.map(({ queryScope, state }) => [queryScope, state]),
      );
      expect(states).toEqual({
        installed_apps: "capability_missing",
        processes: "permission_denied",
        open_files: "cancelled",
        startup_targets: "permission_denied",
        target_executables: "complete",
        receipts: "timeout",
        official_uninstallers: "partial_inventory",
        dependencies: "capability_missing",
      });
      expect(payload.queries
        .filter(({ state }) => state === "timeout" || state === "cancelled")
        .every(({ completedAt }) => completedAt === null)).toBe(true);
      expect(JSON.stringify({
        descriptor: { queryCount: payload.queries.length },
        states,
      })).not.toMatch(/private (?:capability|permission|timeout|cancellation|startup)/u);
    });
  });

  it("malformed native output становится parse_loss, а не complete", async () => {
    const candidatePath = `/private/${rawCanary}/Parse.app`;
    const executablePath = `${candidatePath}/Contents/MacOS/Parse`;
    const executor: ArgvExecutor = async (executable) => {
      if (executable === "/usr/bin/plutil") {
        return {
          stdout: JSON.stringify({
            CFBundleIdentifier: "org.private.parse",
            CFBundleExecutable: "Parse",
          }),
          stderr: "",
          exitCode: 0,
        };
      }
      if (executable === "/usr/bin/codesign") {
        return {
          stdout: "",
          stderr: "designated => requirement-parse\nTeamIdentifier=TEAMPARSE\n",
          exitCode: 0,
        };
      }
      if (executable === "/bin/ps") {
        return { stdout: "malformed-private-process-output\n", stderr: "", exitCode: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-parse",
        inode: `inode-${path.length}`,
        fileType: path.endsWith(".app") ? "bundle" : path === executablePath ? "file" : "directory",
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
        candidates: new Map([["candidate-ref-parse", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => now,
    });
    const input = await adapter.buildInput({
      candidateRef: "candidate-ref-parse",
      snapshotId: "snapshot-parse",
      signal: new AbortController().signal,
    });

    consumeEphemeralCorrelationInput(input, (payload) => {
      expect(payload.queries.find(({ queryScope }) => queryScope === "processes"))
        .toMatchObject({ state: "parse_loss", subjects: [] });
    });
  });
});

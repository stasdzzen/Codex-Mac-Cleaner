import { createHash } from "node:crypto";

import {
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
  type MacOSOwnerBindingHistory,
} from "@codex-mac-cleaner/adapters";
import { resolveCorrelation } from "@codex-mac-cleaner/evidence";
import {
  InstallationKey,
  type KeyedOwnerBindingHistoryRecord,
} from "../../storage/src/index.js";
import { describe, expect, it } from "vitest";

import { runSafeCoreIntegrationHarness } from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const now = "2026-07-18T00:00:00.000Z";
const canary = "PRIVATE-PRODUCTION-CORE-CANARY";
const home = `/private/${canary}/home`;
const candidate = `${home}/Library/Logs/Owner/private.log`;
const ownerApp = "/Applications/Owner.app";
const ownerExecutable = `${ownerApp}/Contents/MacOS/Owner`;

class History implements MacOSOwnerBindingHistory {
  records: readonly KeyedOwnerBindingHistoryRecord[] = [];
  async list() { return this.records; }
  async replace(records: readonly KeyedOwnerBindingHistoryRecord[]) { this.records = records; }
}

function inode(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

async function resolvePackageRegisteredOwner(uninstaller: boolean) {
  const packageIdentifier = "org.vendor.owner";
  const appName = uninstaller ? "Uninstall Owner.app" : "Owner.app";
  const installLocation = "Library/Application Support/Vendor";
  const exactApp = `/${installLocation}/${appName}`;
  const exactExecutable = `${exactApp}/Contents/MacOS/Owner`;
  const executor: ArgvExecutor = async (executable, argv) => {
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkgs") {
      return { stdout: `${packageIdentifier}\n`, stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkg-info") {
      return {
        stdout: [
          `package-id: ${packageIdentifier}`,
          "version: 1.0",
          "volume: /",
          `location: ${installLocation}`,
        ].join("\n"),
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--files") {
      return {
        stdout: `${appName}/Contents/Info.plist\n${appName}/Contents/MacOS/Owner\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--file-info") {
      return { stdout: `package-id: ${packageIdentifier}\n`, stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/bin/plutil") {
      return {
        stdout: JSON.stringify({
          CFBundleIdentifier: "org.vendor.owner",
          CFBundleExecutable: "Owner",
        }),
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/bin/codesign") {
      return {
        stdout: "",
        stderr: "designated => identifier org.vendor.owner and anchor apple generic\nTeamIdentifier=TEAMVENDOR\n",
        exitCode: 0,
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const filesystem: MacOSCorrelationReadOnlyFileSystem = {
    canonicalize: async (path) => path,
    stat: async (path) => ({
      device: "device-package-owner",
      inode: inode(path),
      fileType: path === exactApp ? "bundle" : path === candidate || path === exactExecutable ? "file" : "directory",
      uid: 501,
      gid: 20,
      size: 1,
      modifiedAtMs: 1,
    }),
    readDirectory: async () => [],
  };
  const key = new InstallationKey(new Uint8Array(32).fill(uninstaller ? 13 : 12));
  const adapter = createMacOSProductionCorrelationAdapter({
    commands: createCommandRunner(executor),
    candidates: createMacOSCandidateRegistry({
      candidates: new Map([["candidate-package-owner", candidate]]),
      userHome: home,
    }),
    filesystem,
    now: () => now,
  });
  const rawInput = await adapter.buildInput({
    candidateRef: "candidate-package-owner",
    snapshotId: `snapshot-package-owner-${uninstaller ? "uninstaller" : "app"}`,
    signal: new AbortController().signal,
  });
  return resolveCorrelation({
    auditId: `audit-package-owner-${uninstaller ? "uninstaller" : "app"}`,
    auditRevision: 1,
    findingId: "finding-package-owner",
    exclusionStateVersion: 1,
    ruleSetVersion: 2,
    policyVersion: 2,
    now,
    deriver: key,
    rawInput,
  });
}

describe("production Library adapter → resolver → classifier → policy", () => {
  it.each([
    ["owner app", false],
    ["official uninstaller", true],
  ] as const)("package-registered %s вне app roots остаётся blocking evidence", async (_label, uninstaller) => {
    const resolverResult = await resolvePackageRegisteredOwner(uninstaller);
    const {
      classification: _classification,
      evidenceSet: _evidenceSet,
      correlationRevision: _revision,
      ...policyContext
    } = safeFinding;
    const harness = runSafeCoreIntegrationHarness({
      resolverResult,
      evidenceOptions: { supportLevel: "candidate", sensitivityFlags: [], dataKind: "known" },
      policyContext: { ...policyContext, category: "log" },
    });

    expect(resolverResult.safeView.facts.ownerApplication.state).toBe("present");
    expect(resolverResult.safeView.receiptLifecycle.lifecycle).toBe("live");
    expect(resolverResult.safeView.facts.officialUninstaller.state).toBe(
      uninstaller ? "present" : "absent",
    );
    expect(resolverResult.safeView.blockingReasonCodes).toContain("positive_counter_evidence");
    if (uninstaller) {
      expect(resolverResult.safeView.blockingReasonCodes).toContain("official_uninstaller_required");
    }
    expect(resolverResult.safeView.allowedActions).not.toContain("prepare_move");
    expect(harness.decision.allowedActions).not.toContain("prepare_move");
  });

  it("revision N→N+1 выдаёт orphaned и prepare_move без identity discovery в app", async () => {
    let installed = true;
    let active = true;
    let open = true;
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
          stdout: JSON.stringify({ CFBundleIdentifier: "org.private.owner", CFBundleExecutable: "Owner" }),
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
      if (executable === "/bin/ps") return {
        stdout: active ? `42 Sat Jul 18 00:00:00 2026 ${ownerExecutable}\n` : "",
        stderr: "",
        exitCode: 0,
      };
      if (executable === "/usr/sbin/lsof") return {
        stdout: open ? `p42\ncOwner\nn${candidate}\n` : "",
        stderr: "",
        exitCode: 0,
      };
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-production",
        inode: inode(path),
        fileType: path.endsWith(".app") ? "bundle" : path === ownerExecutable || path === candidate ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async (path) => path === "/Applications" && installed
        ? [{ path: ownerApp, fileType: "bundle" }]
        : [],
    };
    const key = new InstallationKey(new Uint8Array(32).fill(11));
    const history = new History();
    const createAdapter = () => createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-production-log", candidate]]),
        userHome: home,
      }),
      filesystem,
      installationKey: key,
      ownerBindingHistory: history,
      now: () => now,
    });
    const adapter = createAdapter();

    const first = await adapter.buildInput({
      candidateRef: "candidate-production-log",
      snapshotId: "snapshot-production-n",
      signal: new AbortController().signal,
    });
    resolveCorrelation({
      auditId: "audit-production-n",
      auditRevision: 1,
      findingId: "finding-production-log",
      exclusionStateVersion: 1,
      ruleSetVersion: 2,
      policyVersion: 2,
      now,
      deriver: key,
      rawInput: first,
    });
    expect(history.records).toHaveLength(1);

    installed = false;
    active = false;
    open = false;
    const second = await createAdapter().buildInput({
      candidateRef: "candidate-production-log",
      snapshotId: "snapshot-production-n1",
      signal: new AbortController().signal,
    });
    const resolverResult = resolveCorrelation({
      auditId: "audit-production-n1",
      auditRevision: 2,
      findingId: "finding-production-log",
      exclusionStateVersion: 1,
      ruleSetVersion: 2,
      policyVersion: 2,
      now,
      deriver: key,
      rawInput: second,
    });
    const {
      classification: _classification,
      evidenceSet: _evidenceSet,
      correlationRevision: _revision,
      ...policyContext
    } = safeFinding;
    const harness = runSafeCoreIntegrationHarness({
      resolverResult,
      evidenceOptions: { supportLevel: "candidate", sensitivityFlags: [], dataKind: "known" },
      policyContext: { ...policyContext, category: "log" },
    });

    expect(resolverResult.safeView).toMatchObject({
      ownerBindingState: "resolved",
      ownerBindingSourceClass: "signed_history",
      requirementProfileId: "private_regenerable_remnant_v1",
      receiptLifecycle: { lifecycle: "absent" },
    });
    expect(harness.classification).toMatchObject({
      label: "orphaned",
      ruleIds: ["CLASSIFIER_V2_ORPHANED_LIBRARY_REMNANT"],
    });
    expect(harness.decision.blockingRuleIds).toEqual([]);
    expect(harness.decision.allowedActions).toContain("prepare_move");
    expect(calls.every(({ shell }) => shell === false)).toBe(true);
    const safe = JSON.stringify({
      safeInput: harness.safeInput,
      evidenceSet: harness.evidenceSet,
      classification: harness.classification,
      decision: harness.decision,
    });
    expect(safe).not.toContain(canary);
    expect(safe).not.toMatch(/canonicalPath|bundleIdentifier|packageIdentifier|designatedRequirement/u);
  });
});

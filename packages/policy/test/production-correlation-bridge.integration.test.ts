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

describe("production Library adapter → resolver → classifier → policy", () => {
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
    const adapter = createMacOSProductionCorrelationAdapter({
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
    const second = await adapter.buildInput({
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

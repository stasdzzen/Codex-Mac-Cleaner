import { createHash } from "node:crypto";

import {
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
} from "@codex-mac-cleaner/adapters";
import { resolveCorrelation } from "@codex-mac-cleaner/evidence";
import { describe, expect, it } from "vitest";

import { runSafeCoreIntegrationHarness } from "../src/index.js";
import { safeFinding } from "./fixtures.js";

const now = "2026-07-18T00:00:00.000Z";
const rawCanary = "PRIVATE-BRIDGE-INTEGRATION-CANARY";

const deriver = {
  keyId: "production-bridge-test-key",
  derivationVersion: 1,
  derive(domain: string, kind: string, value: string) {
    return `hmac-sha256:v1:${createHash("sha256")
      .update(`${domain}\u0000${kind}\u0000${value}`)
      .digest("hex")}` as const;
  },
};

describe("concrete macOS correlation collector → safe core", () => {
  it("CMC-09 передаёт low-level dependencies без per-source identity mapping", async () => {
    const candidatePath = `/private/${rawCanary}/Candidate.app`;
    const executablePath = `${candidatePath}/Contents/MacOS/Candidate`;
    const calls: Array<{ executable: string; argv: readonly string[]; shell: boolean }> = [];
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
          stderr: `designated => requirement-${rawCanary}\nTeamIdentifier=TEAMPRIVATE\n`,
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-integration",
        inode: path === executablePath ? "inode-executable" : `inode-${path.length}`,
        fileType: path.endsWith(".app")
          ? "bundle"
          : path === executablePath ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async () => [],
    };
    const correlationAdapter = createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-production-ref-a", candidatePath]]),
        userHome: `/private/${rawCanary}/synthetic-user-root`,
      }),
      filesystem,
      now: () => now,
    });
    const rawInput = await correlationAdapter.buildInput({
      candidateRef: "candidate-production-ref-a",
      snapshotId: "snapshot-production-integration-a",
      signal: new AbortController().signal,
    });
    const resolverResult = resolveCorrelation({
      auditId: "audit-production-integration-a",
      auditRevision: 1,
      findingId: "finding-production-integration-a",
      exclusionStateVersion: 1,
      ruleSetVersion: 1,
      policyVersion: 1,
      now,
      deriver,
      rawInput,
    });
    const {
      classification: _classification,
      evidenceSet: _evidenceSet,
      correlationRevision: _revision,
      ...policyContext
    } = safeFinding;
    const harness = runSafeCoreIntegrationHarness({
      resolverResult,
      evidenceOptions: {
        supportLevel: "candidate",
        sensitivityFlags: [],
        dataKind: "known",
      },
      policyContext,
    });

    expect(resolverResult.provenance).toHaveLength(8);
    expect(resolverResult.safeView.facts.targetExecutable.state).toBe("present");
    expect(resolverResult.safeView.facts.officialUninstaller).toMatchObject({
      state: "unknown",
      reasonCode: "partial_inventory",
    });
    expect(harness.classification.label).toBe("unknown");
    expect(harness.decision.allowedActions).not.toContain("prepare_move");
    expect(calls.some(({ executable }) => executable === "/usr/bin/mdfind")).toBe(true);
    expect(calls.some(({ executable }) => executable === "/bin/ps")).toBe(true);
    expect(calls.some(({ executable }) => executable === "/usr/sbin/lsof")).toBe(true);
    expect(calls.some(({ executable }) => executable === "/usr/sbin/pkgutil")).toBe(true);
    expect(calls.every(({ shell }) => shell === false)).toBe(true);
    const serializedSafeCore = JSON.stringify({
      safeInput: harness.safeInput,
      evidenceSet: harness.evidenceSet,
      classification: harness.classification,
      decision: harness.decision,
    });
    expect(serializedSafeCore).not.toContain(rawCanary);
    expect(serializedSafeCore).not.toMatch(
      /canonicalPath|bundleIdentifier|packageIdentifier|designatedRequirement/u,
    );
  });
});

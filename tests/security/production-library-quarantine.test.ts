import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deriveRuntimeDataKind } from "../../apps/mcp-server/src/runtime.js";

import {
  createCommandRunner,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
  type MacOSOwnerBindingHistory,
} from "../../packages/adapters/src/index.js";
import { resolveCorrelation } from "../../packages/evidence/src/index.js";
import { runSafeCoreIntegrationHarness } from "../../packages/policy/src/index.js";
import {
  QuarantineController,
  inspectMoveSource,
  type MoveSubject,
} from "../../packages/quarantine/src/index.js";
import {
  InstallationKey,
  type KeyedOwnerBindingHistoryRecord,
} from "../../packages/storage/src/index.js";

const now = "2026-07-18T00:00:00.000Z";
const privacyCanary = "PRIVATE-LIBRARY-MOVE-RESTORE-CANARY";

class MemoryHistory implements MacOSOwnerBindingHistory {
  records: readonly KeyedOwnerBindingHistoryRecord[] = [];
  async list() { return this.records; }
  async replace(records: readonly KeyedOwnerBindingHistoryRecord[]) { this.records = records; }
}

function opaque(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

describe("security: production Library audit → quarantine → restore", () => {
  it.each([
    { rootName: "Caches", category: "cache" },
    { rootName: "Logs", category: "log" },
  ] as const)("generated ~/Library/$rootName artifact проходит полный reversible flow", async ({
    rootName,
    category,
  }) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "cmc-production-quarantine-"));
    const userHome = join(temporaryRoot, "synthetic-home");
    const allowedRoot = join(userHome, "Library", rootName);
    const artifactParent = join(allowedRoot, "Owner");
    const artifact = join(artifactParent, privacyCanary);
    const storeRoot = join(temporaryRoot, "state");
    const ownerApp = "/Applications/Owner.app";
    const ownerExecutable = `${ownerApp}/Contents/MacOS/Owner`;
    await mkdir(artifactParent, { recursive: true });
    await writeFile(artifact, "", { mode: 0o600 });

    let installed = true;
    let running = true;
    let open = true;
    const executor: ArgvExecutor = async (executable, argv) => {
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
        stdout: running ? `42 Sat Jul 18 00:00:00 2026 ${ownerExecutable}\n` : "",
        stderr: "",
        exitCode: 0,
      };
      if (executable === "/usr/sbin/lsof") return {
        stdout: open ? `p42\ncOwner\nn${artifact}\n` : "",
        stderr: "",
        exitCode: 0,
      };
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      canonicalize: async (path) => path,
      stat: async (path) => ({
        device: "device-production-quarantine",
        inode: opaque(path),
        fileType: path.endsWith(".app") ? "bundle" : path === ownerExecutable || path === artifact ? "file" : "directory",
        uid: 501,
        gid: 20,
        size: 1,
        modifiedAtMs: 1,
      }),
      readDirectory: async (path) => path === "/Applications" && installed
        ? [{ path: ownerApp, fileType: "bundle" }]
        : [],
    };
    const key = new InstallationKey(new Uint8Array(32).fill(17));
    const history = new MemoryHistory();
    const createAdapter = () => createMacOSProductionCorrelationAdapter({
      commands: createCommandRunner(executor),
      candidates: createMacOSCandidateRegistry({
        candidates: new Map([["candidate-cache-flow", artifact]]),
        userHome,
      }),
      filesystem,
      installationKey: key,
      ownerBindingHistory: history,
      now: () => now,
    });
    const adapter = createAdapter();
    const first = await adapter.buildInput({
      candidateRef: "candidate-cache-flow",
      snapshotId: "snapshot-cache-n",
      signal: new AbortController().signal,
    });
    resolveCorrelation({
      auditId: "audit-cache-n",
      auditRevision: 1,
      findingId: "finding-cache-flow",
      exclusionStateVersion: 1,
      ruleSetVersion: 2,
      policyVersion: 2,
      now,
      deriver: key,
      rawInput: first,
    });
    expect(history.records).toHaveLength(1);

    installed = false;
    running = false;
    open = false;
    const second = await createAdapter().buildInput({
      candidateRef: "candidate-cache-flow",
      snapshotId: "snapshot-cache-n1",
      signal: new AbortController().signal,
    });
    const resolverResult = resolveCorrelation({
      auditId: "audit-cache-n1",
      auditRevision: 2,
      findingId: "finding-cache-flow",
      exclusionStateVersion: 1,
      ruleSetVersion: 2,
      policyVersion: 2,
      now,
      deriver: key,
      rawInput: second,
    });
    const observed = await inspectMoveSource({ allowedRoot, sourcePath: artifact });
    const targetFingerprint = `sha256:v1:${"c".repeat(64)}`;
    const dataKind = deriveRuntimeDataKind({
      category,
      sensitivityFlags: [],
      correlation: {
        ownerBindingState: resolverResult.safeView.ownerBindingState,
        requirementProfileId: resolverResult.revision.requirementProfileId,
        requirementProfileVersion: resolverResult.revision.requirementProfileVersion,
        requirementProfileFingerprint:
          resolverResult.revision.requirementProfileFingerprint,
        staleDuringAudit: resolverResult.revision.staleDuringAudit,
        correlationRevisionId: resolverResult.revision.correlationRevisionId,
      },
      proof: {
        schemaVersion: 1,
        ruleId: "BOUNDED_CACHE_LOG_REGENERABILITY_V2",
        ruleVersion: 2,
        targetFingerprint,
        correlationRevisionId: resolverResult.revision.correlationRevisionId,
      },
      targetFingerprint,
    });
    expect(dataKind).toBe("known");
    const core = runSafeCoreIntegrationHarness({
      resolverResult,
      evidenceOptions: { supportLevel: "candidate", sensitivityFlags: [], dataKind },
      policyContext: {
        supportLevel: "candidate",
        category,
        sensitivityFlags: [],
        protectedScopeKinds: [],
        exclusionMatch: { status: "none" },
        officialUninstallerApplicable: false,
        snapshotFingerprint: observed.sourceFingerprint,
        currentFingerprint: observed.sourceFingerprint,
        pathValidation: { ok: true, canonicalPath: artifact },
      },
    });
    expect(core.classification.label).toBe("orphaned");
    expect(core.decision.allowedActions).toContain("prepare_move");

    const subject: MoveSubject = {
      auditId: "audit-cache-n1",
      auditRevision: 2,
      findingId: "finding-cache-flow",
      sourcePath: artifact,
      allowedRoot,
      sourceFingerprint: observed.sourceFingerprint,
      sourceParentFingerprint: observed.sourceParentFingerprint,
      artifactKind: "file",
      category,
      physicalSize: observed.sourceFingerprint.size,
      classificationRuleIds: [...core.classification.ruleIds],
      policyRuleIds: ["POLICY_V2_PRIVATE_REGENERABLE_REMNANT"],
    };
    const controller = new QuarantineController({
      storeRoot,
      resolveSubject: async ({ findingId, auditRevision }) => {
        if (findingId !== subject.findingId || auditRevision !== subject.auditRevision) throw new Error("unknown finding");
        return subject;
      },
      revalidate: async () => ({
        policyDecision: core.decision,
        ownerIdentity: "matched",
        activityState: "inactive",
        openFileState: "closed",
        protectedScope: false,
        sensitivityFlags: [],
      }),
    });
    const moveSession = "ui-cache-move";
    const movePreview = await controller.prepareMove({
      findingId: subject.findingId,
      auditRevision: subject.auditRevision,
      uiSessionId: moveSession,
    });
    const operationId = "operation-cache-flow";
    await controller.moveToQuarantine({ token: movePreview.secret, operationId, uiSessionId: moveSession });
    expect(await exists(artifact)).toBe(false);

    const restoreSession = "ui-cache-restore";
    const restorePreview = await controller.prepareRestore({ operationId, uiSessionId: restoreSession });
    await controller.restoreFromQuarantine({ token: restorePreview.secret, operationId, uiSessionId: restoreSession });
    expect(await readFile(artifact, "utf8")).toBe("");
    expect(JSON.stringify({ safe: core.safeInput, evidence: core.evidenceSet, decision: core.decision })).not.toContain(privacyCanary);

    await rm(temporaryRoot, { recursive: true, force: true });
  });
});

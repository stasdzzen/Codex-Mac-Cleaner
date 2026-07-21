import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCommandRunner,
  consumeEphemeralCorrelationInput,
  createMacOSCandidateRegistry,
  createMacOSProductionCorrelationAdapter,
  createNodeMacOSCorrelationReadOnlyFileSystem,
  type ArgvExecutor,
  type MacOSCorrelationReadOnlyFileSystem,
  type MacOSOwnerBindingHistory,
} from "@codex-mac-cleaner/adapters";
import { resolveCorrelation } from "@codex-mac-cleaner/evidence";
import {
  InstallationKey,
  type KeyedOwnerBindingHistoryRecord,
} from "@codex-mac-cleaner/storage";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDefaultRuntimeServices,
  createMcpServer,
} from "../src/server.js";

const platform = { platform: "darwin", arch: "arm64", release: "26.0.0" } as const;
const roots: string[] = [];
type GitMarkerKind = "directory" | "file";

class MemoryOwnerBindingHistory implements MacOSOwnerBindingHistory {
  records: readonly KeyedOwnerBindingHistoryRecord[] = [];

  async list() {
    return this.records;
  }

  async replace(records: readonly KeyedOwnerBindingHistoryRecord[]) {
    this.records = records;
  }
}

function inode(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}

async function productionCorrelationHarness(
  homeDirectory: string,
  candidatePath: string,
) {
  const suffix = randomUUID().replaceAll("-", "");
  const ownerApp = join("/Applications", `Owner-${suffix}.app`);
  const ownerExecutable = join(ownerApp, "Contents", "MacOS", "Owner");
  const bundleId = `org.example.cmc.${suffix}`;
  const fixedNow = new Date().toISOString();
  const nodeFilesystem = createNodeMacOSCorrelationReadOnlyFileSystem();
  const history = new MemoryOwnerBindingHistory();
  const installationKey = new InstallationKey(new Uint8Array(32).fill(19));
  let ownerPresent = true;
  let packageInventoryDenied = false;

  const executor: ArgvExecutor = async (executable, argv) => {
    if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkgs") {
      if (packageInventoryDenied) {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/sbin/pkgutil") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    if (executable === "/usr/bin/plutil") {
      return {
        stdout: JSON.stringify({
          CFBundleIdentifier: bundleId,
          CFBundleExecutable: "Owner",
        }),
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/bin/codesign") {
      return {
        stdout: "",
        stderr: [
          `designated => identifier ${bundleId} and anchor apple generic`,
          `TeamIdentifier=TEAM${suffix.slice(0, 12).toUpperCase()}`,
        ].join("\n"),
        exitCode: 0,
      };
    }
    if (executable === "/bin/ps") {
      return {
        stdout: ownerPresent
          ? `42 Sat Jul 18 00:00:00 2026 ${ownerExecutable}\n`
          : "",
        stderr: "",
        exitCode: 0,
      };
    }
    if (executable === "/usr/sbin/lsof") {
      return {
        stdout: ownerPresent ? `p42\ncOwner\nn${candidatePath}\n` : "",
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  const filesystem: MacOSCorrelationReadOnlyFileSystem = {
    async canonicalize(path, signal) {
      signal.throwIfAborted();
      if (path === ownerApp || path === ownerExecutable) return path;
      return nodeFilesystem.canonicalize(path, signal);
    },
    async stat(path, signal) {
      signal.throwIfAborted();
      if (path === ownerApp || path === ownerExecutable) {
        return {
          device: "virtual-owner-device",
          inode: inode(path),
          fileType: path === ownerApp ? "bundle" : "file",
          uid: process.getuid?.() ?? 501,
          gid: process.getgid?.() ?? 20,
          size: 1,
          modifiedAtMs: 1,
        };
      }
      return nodeFilesystem.stat(path, signal);
    },
    async readDirectory(path, signal) {
      signal.throwIfAborted();
      if (path === "/Applications") {
        return ownerPresent ? [{ path: ownerApp, fileType: "bundle" }] : [];
      }
      if (
        path === "/System/Applications" ||
        path === join(homeDirectory, "Applications") ||
        path === "/Library/LaunchAgents" ||
        path === "/Library/LaunchDaemons" ||
        path === join(homeDirectory, "Library", "LaunchAgents")
      ) {
        return [];
      }
      return nodeFilesystem.readDirectory(path, signal);
    },
  };
  const commands = createCommandRunner(executor);
  const adapter = createMacOSProductionCorrelationAdapter({
    commands,
    candidates: createMacOSCandidateRegistry({
      candidates: new Map([["candidate-history-n", candidatePath]]),
      userHome: homeDirectory,
    }),
    filesystem,
    installationKey,
    ownerBindingHistory: history,
    now: () => fixedNow,
  });
  const diagnosticInput = await adapter.buildInput({
    candidateRef: "candidate-history-n",
    snapshotId: `snapshot-history-diagnostic-${suffix}`,
    signal: new AbortController().signal,
  });
  const diagnostic = consumeEphemeralCorrelationInput(
    diagnosticInput,
    (payload) => ({
      queryStates: Object.fromEntries(
        payload.queries.map(({ queryScope, state }) => [queryScope, state]),
      ),
      querySubjectCounts: Object.fromEntries(
        payload.queries.map(({ queryScope, subjects }) => [queryScope, subjects.length]),
      ),
    }),
  );
  expect(diagnostic.queryStates).toMatchObject({
    owner_bindings: "complete",
    installed_apps: "complete",
    processes: "complete",
    open_files: "complete",
  });
  expect(diagnostic.querySubjectCounts).toMatchObject({
    owner_bindings: 0,
    installed_apps: 1,
    processes: 1,
    open_files: 1,
  });
  const rawInput = await adapter.buildInput({
    candidateRef: "candidate-history-n",
    snapshotId: `snapshot-history-n-${suffix}`,
    signal: new AbortController().signal,
  });
  const revisionN = resolveCorrelation({
    auditId: `audit-history-n-${suffix}`,
    auditRevision: 1,
    findingId: `finding-history-n-${suffix}`,
    exclusionStateVersion: 0,
    ruleSetVersion: 2,
    policyVersion: 2,
    now: fixedNow,
    deriver: installationKey,
    rawInput,
  });
  expect(revisionN.safeView.facts.ownerApplication.state).toBe("present");
  expect(revisionN.safeView.facts.activity.state).toBe("present");
  expect(revisionN.safeView.facts.openFile.state).toBe("present");
  expect(revisionN.safeView.allowedActions).not.toContain("prepare_move");
  expect(history.records).toHaveLength(1);
  expect(JSON.stringify(history.records)).not.toContain(candidatePath);
  expect(JSON.stringify(history.records)).not.toContain(bundleId);

  return {
    fixedNow,
    correlation: { commands, filesystem, ownerBindingHistory: history, installationKey },
    removeOwner() {
      ownerPresent = false;
    },
    denyPackageInventory() {
      packageInventoryDenied = true;
    },
  };
}

async function createNestedGitMarker(
  candidatePath: string,
  markerKind: GitMarkerKind,
): Promise<void> {
  const nestedProject = join(candidatePath, "Nested Project");
  await mkdir(nestedProject, { recursive: true });
  if (markerKind === "directory") {
    await mkdir(join(nestedProject, ".git"));
    return;
  }
  await writeFile(join(nestedProject, ".git"), "gitdir: synthetic-metadata\n", "utf8");
}

async function completedAudit(client: Client, requestId: string) {
  const started = await client.callTool({
    name: "audit_start",
    arguments: { requestId, profile: "application_remnants" },
  });
  expect(started.isError).not.toBe(true);
  const auditId = (started.structuredContent as { auditId: string }).auditId;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const status = await client.callTool({ name: "audit_status", arguments: { auditId } });
    const state = (status.structuredContent as { state: string }).state;
    if (state === "completed" || state === "completed_with_warnings") {
      return client.callTool({
        name: "audit_results",
        arguments: { auditId, revision: 1, cursor: null, filters: {} },
      });
    }
    if (state === "failed" || state === "cancelled") {
      throw new Error(`Synthetic audit ended in ${state}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Synthetic audit did not complete");
}

async function connectedRuntime(
  homeDirectory: string,
  stateRoot: string,
  correlation: Awaited<ReturnType<typeof productionCorrelationHarness>>["correlation"],
  fixedNow: string,
) {
  const services = await createDefaultRuntimeServices({
    homeDirectory,
    stateRoot,
    correlation,
    now: () => new Date(fixedNow),
  });
  const server = createMcpServer(platform, services);
  const client = new Client({ name: "runtime-production-correlation", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("production runtime services", () => {
  it("открывает безопасный live Dashboard до завершения аудита", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-live-dashboard-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    await mkdir(join(homeDirectory, "Library", "Caches"), { recursive: true });
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
    });

    const started = (await services.auditService?.start({
      requestId: "live-dashboard-request",
      profile: "application_remnants",
    })) as { auditId: string };
    const live = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: null,
    });

    expect(live?.output).toMatchObject({
      auditId: started.auditId,
      revision: null,
      state: expect.stringMatching(/^(?:queued|running)$/u),
      resourceUri: "ui://codex-mac-cleaner/dashboard-v2.html",
      findings: [],
    });
    expect(live?.meta).toMatchObject({
      dashboard: {
        auditId: started.auditId,
        revision: null,
        findings: [],
        progress: {
          phase: expect.stringMatching(
            /^(?:queued|discovering_candidates|finalizing)$/u,
          ),
          processedCandidates: 0,
          totalCandidates: 0,
        },
      },
    });
  });

  it("останавливает зависший аудит по server-owned deadline", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-audit-timeout-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Synthetic Timeout Candidate",
    );
    await mkdir(candidatePath, { recursive: true });
    const executor: ArgvExecutor = async (_executable, _argv, { signal }) =>
      new Promise((_resolve, reject) => {
        const abort = () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      });
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      async canonicalize(path) {
        return path;
      },
      async stat(path) {
        return {
          device: "device-timeout",
          inode: inode(path),
          fileType: "directory",
          uid: process.getuid?.() ?? 501,
          gid: process.getgid?.() ?? 20,
          size: 0,
          modifiedAtMs: 1,
        };
      },
      async readDirectory() {
        return [];
      },
    };
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      auditTimeoutMs: 25,
      correlation: {
        commands: createCommandRunner(executor),
        filesystem,
      },
    });
    const started = (await services.auditService?.start({
      requestId: "audit-timeout-request",
      profile: "application_remnants",
    })) as { auditId: string };

    type TimeoutStatus = {
      state: string;
      coverageWarningCodes: string[];
      progress: { phase: string };
    };
    let status: TimeoutStatus | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      status = (await services.auditService?.status({
        auditId: started.auditId,
      })) as TimeoutStatus;
      if (status?.state === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(status).toMatchObject({
      state: "failed",
      coverageWarningCodes: ["AUDIT_TIMEOUT"],
      progress: { phase: "failed" },
    });
  });

  it.each(["directory", "file"] as const)(
    "исключает candidate до finding при вложенном .git-%s",
    async (markerKind) => {
      const root = await mkdtemp(join(tmpdir(), `cmc-runtime-git-${markerKind}-`));
      roots.push(root);
      const homeDirectory = join(root, "home");
      const candidatePath = join(homeDirectory, "Library", "Caches", "Parent Candidate");
      await createNestedGitMarker(candidatePath, markerKind);

      const services = await createDefaultRuntimeServices({
        homeDirectory,
        stateRoot: join(root, "state"),
      });
      const server = createMcpServer(platform, services);
      const client = new Client({ name: `runtime-git-${markerKind}`, version: "1.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      try {
        const results = await completedAudit(client, `nested-git-${markerKind}-audit`);
        const findings = (results.structuredContent as {
          findings: Array<{ displayName: string }>;
        }).findings;
        expect(findings).toHaveLength(0);
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it.each(["directory", "file"] as const)(
    "не выдаёт destructive token после появления вложенного .git-%s",
    async (markerKind) => {
      const root = await mkdtemp(join(tmpdir(), `cmc-runtime-git-token-${markerKind}-`));
      roots.push(root);
      const homeDirectory = join(root, "home");
      const candidatePath = join(homeDirectory, "Library", "Caches", "Parent Candidate");
      await mkdir(candidatePath, { recursive: true });
      const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
      harness.removeOwner();
      const { server, client } = await connectedRuntime(
        homeDirectory,
        join(root, "state"),
        harness.correlation,
        harness.fixedNow,
      );
      try {
        const results = await completedAudit(client, `nested-git-${markerKind}-token-audit`);
        const finding = (results.structuredContent as {
          findings: Array<{ findingId: string; displayName: string; allowedActions: string[] }>;
        }).findings[0];
        expect(finding?.allowedActions).toContain("prepare_move");

        await createNestedGitMarker(candidatePath, markerKind);
        const preview = await client.callTool({
          name: "quarantine_prepare_move",
          arguments: { findingId: finding?.findingId, auditRevision: 1 },
        });
        expect(preview.isError).toBe(true);
        expect(preview.structuredContent ?? {}).not.toHaveProperty("previewToken");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it.each(["Caches", "Logs"] as const)(
    "проводит empty %s N→N+1 audit/prepare/move/restore без запуска executable",
    async (libraryRoot) => {
      const root = await mkdtemp(
        join(tmpdir(), `cmc-runtime-core-${libraryRoot}-`),
      );
      roots.push(root);
      const homeDirectory = join(root, "home");
      const candidatePath = join(
        homeDirectory,
        "Library",
        libraryRoot,
        "Synthetic Remnant",
      );
      await mkdir(candidatePath, { recursive: true });
      const harness = await productionCorrelationHarness(
        homeDirectory,
        candidatePath,
      );
      harness.removeOwner();
      const { server, client } = await connectedRuntime(
        homeDirectory,
        join(root, "state"),
        harness.correlation,
        harness.fixedNow,
      );
      try {
      const results = await completedAudit(client, "synthetic-audit-n1");
      const resultContent = results.structuredContent as {
        auditId: string;
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      };
      const finding = resultContent.findings[0];
      const dashboard = await client.callTool({
        name: "dashboard_open",
        arguments: { auditId: resultContent.auditId, revision: 1 },
      });
      const dashboardFinding = (
        (dashboard._meta as { dashboard?: { findings?: unknown[] } } | undefined)
          ?.dashboard?.findings ?? []
      )[0];
      const correlationSummary = dashboardFinding as Record<string, unknown>;
      expect({
        requirementProfileId: correlationSummary.requirementProfileId,
        requirementApplicability: correlationSummary.requirementApplicability,
        receiptLifecycle: correlationSummary.receiptLifecycle,
        coverageSummary: correlationSummary.coverageSummary,
        blockingReasonCodes: correlationSummary.blockingReasonCodes,
      }).toMatchObject({
        requirementProfileId: "private_regenerable_remnant_v1",
        requirementApplicability: expect.any(Object),
        receiptLifecycle: { lifecycle: "absent", reasonCode: "complete_empty" },
        coverageSummary: { completeSourceCount: 9, gapCount: 0, gapCodes: [] },
        blockingReasonCodes: [],
      });
      expect(dashboardFinding).toMatchObject({
        ownerBindingState: "resolved",
        requirementProfileId: "private_regenerable_remnant_v1",
        staleDuringAudit: false,
        coverageSummary: { gapCount: 0 },
        facts: {
          artifactExistence: { state: "present" },
          ownerApplication: { state: "absent" },
          activity: { state: "absent" },
          openFile: { state: "absent" },
        },
      });
      expect(finding?.allowedActions).toContain("prepare_move");

      const preview = await client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding?.findingId, auditRevision: 1 },
      });
      expect(preview.isError).not.toBe(true);
      const previewToken = (preview.structuredContent as { previewToken: string }).previewToken;
      expect(previewToken).toMatch(/^action-handle-/u);
      const duplicatePreview = await client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding?.findingId, auditRevision: 1 },
      });
      const duplicatePreviewToken = (
        duplicatePreview.structuredContent as { previewToken: string }
      ).previewToken;
      expect(duplicatePreviewToken).not.toBe(previewToken);
      const operationId = `synthetic-operation-${randomUUID()}`;
      const forgedMove = await client.callTool({
        name: "quarantine_move",
        arguments: {
          previewToken: `action-handle-forged-${randomUUID()}`,
          operationId: `forged-operation-${randomUUID()}`,
        },
      });
      expect(forgedMove.isError).toBe(true);
      await expect(stat(candidatePath)).resolves.toBeDefined();
      const [moved, concurrentMoved] = await Promise.all([
        client.callTool({
          name: "quarantine_move",
          arguments: { previewToken, operationId },
        }),
        client.callTool({
          name: "quarantine_move",
          arguments: { previewToken, operationId },
        }),
      ]);
      expect(moved.isError).not.toBe(true);
      expect(concurrentMoved.isError).not.toBe(true);
      expect(concurrentMoved.structuredContent).toEqual(moved.structuredContent);
      await expect(stat(candidatePath)).rejects.toMatchObject({ code: "ENOENT" });
      const replayedMove = await client.callTool({
        name: "quarantine_move",
        arguments: { previewToken, operationId },
      });
      expect(replayedMove.isError).not.toBe(true);
      expect(replayedMove.structuredContent).toEqual(moved.structuredContent);
      await expect(stat(candidatePath)).rejects.toMatchObject({ code: "ENOENT" });
      const crossOperationMove = await client.callTool({
        name: "quarantine_move",
        arguments: {
          previewToken,
          operationId: `other-operation-${randomUUID()}`,
        },
      });
      expect(crossOperationMove.isError).toBe(true);
      const differentHandleMove = await client.callTool({
        name: "quarantine_move",
        arguments: { previewToken: duplicatePreviewToken, operationId },
      });
      expect(differentHandleMove.isError).toBe(true);

      const restorePreview = await client.callTool({
        name: "quarantine_prepare_restore",
        arguments: { operationId },
      });
      const restoreToken = (restorePreview.structuredContent as { previewToken: string })
        .previewToken;
      expect(restoreToken).toMatch(/^action-handle-/u);
      const crossAction = await client.callTool({
        name: "quarantine_purge",
        arguments: { operationId, previewToken: restoreToken },
      });
      expect(crossAction.isError).toBe(true);
      const crossObject = await client.callTool({
        name: "quarantine_restore",
        arguments: {
          operationId: `other-operation-${randomUUID()}`,
          previewToken: restoreToken,
        },
      });
      expect(crossObject.isError).toBe(true);
      const restored = await client.callTool({
        name: "quarantine_restore",
        arguments: { operationId, previewToken: restoreToken },
      });
      expect(restored.isError).not.toBe(true);
      await expect(stat(candidatePath)).resolves.toBeDefined();
      const replayedRestore = await client.callTool({
        name: "quarantine_restore",
        arguments: { operationId, previewToken: restoreToken },
      });
      expect(replayedRestore.isError).not.toBe(true);
      expect(replayedRestore.structuredContent).toEqual(
        restored.structuredContent,
      );
      await expect(stat(candidatePath)).resolves.toBeDefined();
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it.each(["Caches", "Logs"] as const)(
    "оставляет непустой %s artifact inspect-only с POLICY_DATA_KIND_UNKNOWN",
    async (libraryRoot) => {
      const root = await mkdtemp(join(tmpdir(), `cmc-runtime-nonempty-${libraryRoot}-`));
      roots.push(root);
      const homeDirectory = join(root, "home");
      const candidatePath = join(
        homeDirectory,
        "Library",
        libraryRoot,
        "Arbitrary Payload",
      );
      await mkdir(candidatePath, { recursive: true });
      await writeFile(join(candidatePath, "payload.bin"), "arbitrary-payload", "utf8");
      const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
      harness.removeOwner();
      const { server, client } = await connectedRuntime(
        homeDirectory,
        join(root, "state"),
        harness.correlation,
        harness.fixedNow,
      );
      try {
        const results = await completedAudit(
          client,
          `nonempty-${libraryRoot.toLowerCase()}-audit`,
        );
        const finding = (results.structuredContent as {
          findings: Array<{ allowedActions: string[]; blockingReasons: string[] }>;
        }).findings[0];
        expect(finding?.allowedActions).not.toContain("prepare_move");
        expect(finding?.blockingReasons).toContain("POLICY_DATA_KIND_UNKNOWN");
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it("пересчитывает empty proof перед preview и блокирует появившийся payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-proof-race-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Proof Race",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();
    const { server, client } = await connectedRuntime(
      homeDirectory,
      join(root, "state"),
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const results = await completedAudit(client, "proof-race-audit");
      const finding = (results.structuredContent as {
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      }).findings[0];
      expect(finding?.allowedActions).toContain("prepare_move");

      await writeFile(join(candidatePath, "payload.bin"), "late-payload", "utf8");
      const preview = await client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding?.findingId, auditRevision: 1 },
      });
      expect(preview.isError).toBe(true);
      expect(preview.structuredContent ?? {}).not.toHaveProperty("previewToken");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("возвращает exact purge replay без второй filesystem mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-purge-replay-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Synthetic Purge Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(
      homeDirectory,
      candidatePath,
    );
    harness.removeOwner();
    const { server, client } = await connectedRuntime(
      homeDirectory,
      join(root, "state"),
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const results = await completedAudit(client, "synthetic-purge-audit");
      const finding = (results.structuredContent as {
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      }).findings[0];
      expect(finding?.allowedActions).toContain("prepare_move");
      const movePreview = await client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding?.findingId, auditRevision: 1 },
      });
      const moveHandle = (
        movePreview.structuredContent as { previewToken: string }
      ).previewToken;
      const operationId = `synthetic-purge-operation-${randomUUID()}`;
      const moved = await client.callTool({
        name: "quarantine_move",
        arguments: { previewToken: moveHandle, operationId },
      });
      expect(moved.isError).not.toBe(true);
      const purgePreview = await client.callTool({
        name: "quarantine_prepare_purge",
        arguments: { operationId },
      });
      const purgeHandle = (
        purgePreview.structuredContent as { previewToken: string }
      ).previewToken;
      const purged = await client.callTool({
        name: "quarantine_purge",
        arguments: { operationId, previewToken: purgeHandle },
      });
      expect(purged.isError).not.toBe(true);
      const replayedPurge = await client.callTool({
        name: "quarantine_purge",
        arguments: { operationId, previewToken: purgeHandle },
      });

      expect(replayedPurge.isError).not.toBe(true);
      expect(replayedPurge.structuredContent).toEqual(purged.structuredContent);
      await expect(stat(candidatePath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("не разрешает mutation для active/open/installed owner", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-active-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const candidatePath = join(homeDirectory, "Library", "Caches", "Active Remnant");
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    const { server, client } = await connectedRuntime(
      homeDirectory,
      join(root, "state"),
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const results = await completedAudit(client, "active-owner-audit");
      const finding = (results.structuredContent as {
        findings: Array<{ allowedActions: string[] }>;
      }).findings[0];
      expect(finding?.allowedActions).not.toContain("prepare_move");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("fail-closed блокирует incomplete coverage и inspect-only category", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-fail-closed-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const cachePath = join(homeDirectory, "Library", "Caches", "Incomplete Remnant");
    const supportPath = join(
      homeDirectory,
      "Library",
      "Application Support",
      "Inspection Only Remnant",
    );
    await mkdir(cachePath, { recursive: true });
    await mkdir(supportPath, { recursive: true });
    const cacheHarness = await productionCorrelationHarness(homeDirectory, cachePath);
    cacheHarness.removeOwner();
    cacheHarness.denyPackageInventory();
    const { server, client } = await connectedRuntime(
      homeDirectory,
      join(root, "state"),
      cacheHarness.correlation,
      cacheHarness.fixedNow,
    );
    try {
      const results = await completedAudit(client, "fail-closed-audit");
      const findings = (results.structuredContent as {
        findings: Array<{ category: string; allowedActions: string[] }>;
      }).findings;
      expect(findings.find(({ category }) => category === "cache")
        ?.allowedActions).not.toContain("prepare_move");
      expect(findings.find(({ category }) => category === "application_support")
        ?.allowedActions).not.toContain("prepare_move");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
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
import { afterEach, describe, expect, it, vi } from "vitest";

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
  return { server, client, services };
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
      resourceUri: "ui://codex-mac-cleaner/dashboard-v4.html",
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

    let status = (await services.auditService?.status({
      auditId: started.auditId,
    })) as { state: string } | undefined;
    while (status?.state === "queued" || status?.state === "running") {
      await new Promise((resolve) => setTimeout(resolve, 5));
      status = (await services.auditService?.status({
        auditId: started.auditId,
      })) as { state: string } | undefined;
    }
    expect(status?.state).toMatch(/^completed(?:_with_warnings)?$/u);

    const completedLive = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: null,
    });
    expect(completedLive?.output).toMatchObject({
      auditId: started.auditId,
      revision: null,
      findings: [],
    });
    expect(completedLive?.meta).toMatchObject({
      dashboard: {
        auditId: started.auditId,
        revision: null,
        findings: [],
      },
    });
  });

  it("восстанавливает последний завершённый аудит после restart и заново проверяет mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-persisted-audit-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Persisted Synthetic Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();

    const first = await connectedRuntime(
      homeDirectory,
      stateRoot,
      harness.correlation,
      harness.fixedNow,
    );
    let auditId: string;
    let findingId: string;
    try {
      const results = await completedAudit(first.client, "persisted-audit-request");
      const content = results.structuredContent as {
        auditId: string;
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      };
      auditId = content.auditId;
      findingId = content.findings[0]!.findingId;
      expect(content.findings[0]!.allowedActions).toContain("prepare_move");
    } finally {
      await first.client.close();
      await first.server.close();
    }
    expect((await stat(join(stateRoot, "audits"))).mode & 0o777).toBe(0o700);
    expect((await stat(join(stateRoot, "audits", "latest.json"))).mode & 0o777).toBe(
      0o600,
    );
    const persisted = await readFile(
      join(stateRoot, "audits", "latest.json"),
      "utf8",
    );
    expect(persisted).not.toMatch(/previewToken|action-handle|cursor-/u);
    const persistedEnvelope = JSON.parse(persisted) as {
      payload: {
        findings: Array<{
          correlation: Record<string, unknown> | null;
          candidate: Record<string, unknown> | null;
        }>;
      };
    };
    const persistedFinding = persistedEnvelope.payload.findings[0]!;
    expect(persistedFinding).not.toHaveProperty("identity");
    expect(Object.keys(persistedFinding.correlation ?? {}).sort()).toEqual([
      "candidateSubjectId",
      "revision",
      "safeView",
    ]);
    expect(Object.keys(persistedFinding.candidate ?? {}).sort()).toEqual([
      "allowedRoot",
      "fingerprint",
      "kind",
      "parentFingerprint",
      "path",
      "ref",
      "root",
    ]);
    for (const forbiddenKey of [
      "subjects",
      "edges",
      "ownerBindings",
      "provenance",
      "certificates",
      "resolutionStates",
      "ownerResolutionState",
      "bundleId",
      "packageId",
      "signingIdentity",
    ]) {
      expect(persisted).not.toContain(`"${forbiddenKey}":`);
    }

    const second = await connectedRuntime(
      homeDirectory,
      stateRoot,
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const dashboard = await second.client.callTool({
        name: "dashboard_open",
        arguments: { auditId: null, revision: null },
      });
      expect(dashboard.isError).not.toBe(true);
      expect(dashboard.structuredContent).toMatchObject({
        auditId,
        revision: 1,
        state: expect.stringMatching(/^completed(?:_with_warnings)?$/u),
      });
      expect(
        (dashboard._meta as { dashboard?: { findings?: unknown[] } } | undefined)
          ?.dashboard?.findings,
      ).toHaveLength(1);

      const preview = await second.client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId, auditRevision: 1 },
      });
      expect(preview.isError).not.toBe(true);
      expect(preview.structuredContent).toMatchObject({
        previewToken: expect.stringMatching(/^action-handle-/u),
      });
      await expect(stat(candidatePath)).resolves.toBeDefined();
    } finally {
      await second.client.close();
      await second.server.close();
    }
  });

  it("игнорирует повреждённый persisted audit и не открывает stale authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-corrupt-audit-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    await mkdir(join(homeDirectory, "Library", "Caches"), { recursive: true });
    const first = await createDefaultRuntimeServices({ homeDirectory, stateRoot });
    const started = (await first.auditService?.start({
      requestId: "corrupt-persisted-audit-request",
      profile: "application_remnants",
    })) as { auditId: string };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const status = (await first.auditService?.status({
        auditId: started.auditId,
      })) as { state: string };
      if (/^completed(?:_with_warnings)?$/u.test(status.state)) break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const persistedPath = join(stateRoot, "audits", "latest.json");
    const envelope = JSON.parse(await readFile(persistedPath, "utf8")) as {
      integrity: string;
    };
    envelope.integrity = `${envelope.integrity.slice(0, -1)}${
      envelope.integrity.endsWith("0") ? "1" : "0"
    }`;
    await writeFile(persistedPath, JSON.stringify(envelope), { mode: 0o600 });

    const second = await createDefaultRuntimeServices({ homeDirectory, stateRoot });
    await expect(
      second.auditService?.dashboard({ auditId: null, revision: null }),
    ).rejects.toThrow("AUDIT_STALE");
  });

  it("сохраняет доступ к последнему completed-аудиту после отмены более нового", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-latest-completed-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Last Completed Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();
    const runtime = await connectedRuntime(
      homeDirectory,
      stateRoot,
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const completed = await completedAudit(
        runtime.client,
        "last-completed-request",
      );
      const completedAuditId = (
        completed.structuredContent as { auditId: string }
      ).auditId;
      const completedStorageSummary = (
        completed.structuredContent as {
          storageSummary: {
            candidateLogicalBytes: number;
            candidatePhysicalBytes: number;
          };
        }
      ).storageSummary;
      expect(completedStorageSummary.candidateLogicalBytes).toBeGreaterThan(0);
      const newer = (await runtime.services.auditService?.start({
        requestId: "newer-cancelled-request",
        profile: "application_remnants",
      })) as { auditId: string };
      await runtime.services.auditService?.cancel({
        auditId: newer.auditId,
        requestId: "cancel-newer-request",
      });
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const status = (await runtime.services.auditService?.status({
          auditId: newer.auditId,
        })) as { state: string };
        if (status.state === "cancelled") break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const dashboard = await runtime.services.auditService?.dashboard({
        auditId: null,
        revision: null,
      });
      expect(dashboard?.output).toMatchObject({
        auditId: completedAuditId,
        revision: 1,
        storageSummary: completedStorageSummary,
      });
    } finally {
      await runtime.client.close();
      await runtime.server.close();
    }
  });

  it("сериализует разные audit_start и после restart восстанавливает последний", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-serialized-audits-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Serialized Audit Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();
    const originalCommands = harness.correlation.commands;
    let releaseFirstCommand: (() => void) | undefined;
    let markFirstCommandStarted: (() => void) | undefined;
    const firstCommandStarted = new Promise<void>((resolve) => {
      markFirstCommandStarted = resolve;
    });
    const firstCommandGate = new Promise<void>((resolve) => {
      releaseFirstCommand = resolve;
    });
    let firstCommandBlocked = false;
    const correlation = {
      ...harness.correlation,
      commands: {
        async run(
          executable: string,
          argv: readonly string[],
          options: Readonly<{ signal: AbortSignal }>,
        ) {
          if (!firstCommandBlocked) {
            firstCommandBlocked = true;
            markFirstCommandStarted?.();
            await firstCommandGate;
          }
          return originalCommands.run(executable, argv, options);
        },
      },
    };
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot,
      correlation,
      now: () => new Date(harness.fixedNow),
    });
    const first = (await services.auditService?.start({
      requestId: "serialized-audit-first",
      profile: "application_remnants",
    })) as { auditId: string };
    await firstCommandStarted;
    const second = (await services.auditService?.start({
      requestId: "serialized-audit-second",
      profile: "application_remnants",
    })) as { auditId: string };

    expect(
      (await services.auditService?.status({
        auditId: second.auditId,
      })) as { state: string },
    ).toMatchObject({ state: "queued" });
    releaseFirstCommand?.();

    for (const auditId of [first.auditId, second.auditId]) {
      let terminalState = "";
      for (let attempt = 0; attempt < 500; attempt += 1) {
        terminalState = (
          (await services.auditService?.status({ auditId })) as {
            state: string;
          }
        ).state;
        if (/^completed(?:_with_warnings)?$/u.test(terminalState)) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(terminalState).toMatch(/^completed(?:_with_warnings)?$/u);
    }

    const liveDashboard = await services.auditService?.dashboard({
      auditId: null,
      revision: null,
    });
    expect(liveDashboard?.output).toMatchObject({
      auditId: second.auditId,
      revision: 1,
    });

    const restored = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot,
      correlation: harness.correlation,
      now: () => new Date(harness.fixedNow),
    });
    const restoredDashboard = await restored.auditService?.dashboard({
      auditId: null,
      revision: null,
    });
    expect(restoredDashboard?.output).toMatchObject({
      auditId: second.auditId,
      revision: 1,
    });
  });

  it("оставляет findings видимыми при corrupt exclusion state и блокирует mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-corrupt-exclusion-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Corrupt Exclusion Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();
    const runtime = await connectedRuntime(
      homeDirectory,
      stateRoot,
      harness.correlation,
      harness.fixedNow,
    );
    try {
      await writeFile(
        join(stateRoot, "exclusions", "exclusions.json"),
        "{\"schemaVersion\":999}\n",
        { mode: 0o600 },
      );
      const results = await completedAudit(
        runtime.client,
        "corrupt-exclusion-audit-request",
      );
      const finding = (results.structuredContent as {
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      }).findings[0]!;
      expect(finding.allowedActions).not.toContain("prepare_move");

      const dashboard = await runtime.client.callTool({
        name: "dashboard_open",
        arguments: {
          auditId: (results.structuredContent as { auditId: string }).auditId,
          revision: 1,
        },
      });
      expect(dashboard.isError).not.toBe(true);
      expect(
        (dashboard._meta as { dashboard?: { findings?: unknown[] } } | undefined)
          ?.dashboard?.findings,
      ).toHaveLength(1);

      const preview = await runtime.client.callTool({
        name: "quarantine_prepare_move",
        arguments: { findingId: finding.findingId, auditRevision: 1 },
      });
      expect(preview.isError).toBe(true);
    } finally {
      await runtime.client.close();
      await runtime.server.close();
    }
  });

  it("стартует fail-closed с повреждённым exclusion key", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-corrupt-exclusion-key-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const stateRoot = join(root, "state");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Corrupt Exclusion Key Remnant",
    );
    await mkdir(candidatePath, { recursive: true });
    const harness = await productionCorrelationHarness(homeDirectory, candidatePath);
    harness.removeOwner();
    await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot,
      correlation: harness.correlation,
      now: () => new Date(harness.fixedNow),
    });
    await writeFile(
      join(
        stateRoot,
        "exclusions",
        "keys",
        "exclusion-hmac-key.json",
      ),
      "{\"schemaVersion\":999}\n",
      { mode: 0o600 },
    );

    const runtime = await connectedRuntime(
      homeDirectory,
      stateRoot,
      harness.correlation,
      harness.fixedNow,
    );
    try {
      const results = await completedAudit(
        runtime.client,
        "corrupt-exclusion-key-audit",
      );
      const finding = (results.structuredContent as {
        findings: Array<{ findingId: string; allowedActions: string[] }>;
      }).findings[0]!;
      expect(finding).toBeDefined();
      expect(finding.allowedActions).not.toContain("prepare_move");

      const preview = await runtime.client.callTool({
        name: "quarantine_prepare_move",
        arguments: {
          findingId: finding.findingId,
          auditRevision: 1,
        },
      });
      expect(preview.isError).toBe(true);
    } finally {
      await runtime.client.close();
      await runtime.server.close();
    }
  });

  it("не прерывает долгий аудит по времени и завершает его после продолжения источника", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-audit-without-deadline-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const candidatePath = join(
      homeDirectory,
      "Library",
      "Caches",
      "Synthetic Delayed Candidate",
    );
    await mkdir(candidatePath, { recursive: true });
    let markInspectionStarted: (() => void) | undefined;
    const inspectionStarted = new Promise<void>((resolve) => {
      markInspectionStarted = resolve;
    });
    let continueInspection: (() => void) | undefined;
    const inspectionGate = new Promise<void>((resolve) => {
      continueInspection = resolve;
    });
    const executor: ArgvExecutor = async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    let inspectionBlocked = false;
    const waitForInspectionGate = async (signal: AbortSignal) => {
      markInspectionStarted?.();
      await new Promise<void>((resolve, reject) => {
        const abort = () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        void inspectionGate.then(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        });
      });
    };
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
      async readDirectory(_path, signal) {
        if (!inspectionBlocked) {
          inspectionBlocked = true;
          await waitForInspectionGate(signal);
        }
        return [];
      },
    };
    vi.useFakeTimers();
    try {
      const services = await createDefaultRuntimeServices({
        homeDirectory,
        stateRoot: join(root, "state"),
        correlation: {
          commands: createCommandRunner(executor),
          filesystem,
        },
      });
      const started = (await services.auditService?.start({
        requestId: "audit-without-deadline-request",
        profile: "application_remnants",
      })) as { auditId: string };

      type AuditStatus = {
        state: string;
        coverageWarningCodes: string[];
        progress: { phase: string };
      };
      await vi.advanceTimersByTimeAsync(0);
      await inspectionStarted;
      await vi.advanceTimersByTimeAsync(300_001);
      let status = (await services.auditService?.status({
        auditId: started.auditId,
      })) as AuditStatus;
      expect(status).toMatchObject({
        state: "running",
      });
      expect(status.coverageWarningCodes).not.toContain("AUDIT_TIMEOUT");

      continueInspection?.();
      for (let attempt = 0; attempt < 400; attempt += 1) {
        await vi.advanceTimersByTimeAsync(0);
        status = (await services.auditService?.status({
          auditId: started.auditId,
        })) as AuditStatus;
        if (!["queued", "running"].includes(status.state)) break;
      }

      expect(status).toMatchObject({
        state: expect.stringMatching(/^completed(?:_with_warnings)?$/u),
        progress: { phase: "completed" },
      });
      expect(status.coverageWarningCodes).not.toContain("AUDIT_TIMEOUT");
      const results = await services.auditService?.results({
        auditId: started.auditId,
        revision: 1,
        cursor: null,
        filters: {},
      });
      expect(results).toMatchObject({
        auditId: started.auditId,
        revision: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    {
      name: "plutil при проверке автозапуска",
      executable: "/usr/bin/plutil",
      processInspection: false,
    },
    {
      name: "ps при проверке процессов",
      executable: "/bin/ps",
      processInspection: true,
    },
  ])(
    "ограничивает зависший $name отдельным тайм-аутом и завершает аудит с coverage gap",
    async ({ executable: stalledExecutable, processInspection }) => {
      const root = await mkdtemp(join(tmpdir(), "cmc-runtime-command-timeout-"));
      roots.push(root);
      const homeDirectory = join(root, "home");
      const launchAgents = join(homeDirectory, "Library", "LaunchAgents");
      await mkdir(launchAgents, { recursive: true });
      if (stalledExecutable === "/usr/bin/plutil") {
        await writeFile(
          join(launchAgents, "org.example.stalled.plist"),
          "<plist version=\"1.0\"></plist>\n",
          "utf8",
        );
      }
      const executor: ArgvExecutor = async (executable, _argv, { signal }) => {
        if (executable !== stalledExecutable) {
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return new Promise((_resolve, reject) => {
          const abort = () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        });
      };
      const services = await createDefaultRuntimeServices({
        homeDirectory,
        stateRoot: join(root, "state"),
        correlation: {
          commands: createCommandRunner(executor),
          commandTimeoutMs: 25,
        },
        diagnostics: {
          systemLibraryRoot: join(root, "system-library"),
          enableProcessInspection: processInspection,
        },
      });
      const started = (await services.auditService?.start({
        requestId: `audit-command-timeout-${processInspection ? "ps" : "plutil"}`,
        profile: "application_remnants",
      })) as { auditId: string };

      let status = (await services.auditService?.status({
        auditId: started.auditId,
      })) as {
        state: string;
        coverageWarningCodes: string[];
      };
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if (!["queued", "running"].includes(status.state)) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
        status = (await services.auditService?.status({
          auditId: started.auditId,
        })) as typeof status;
      }

      expect(status).toMatchObject({
        state: "completed_with_warnings",
        coverageWarningCodes: expect.arrayContaining(["INTERNAL_ERROR"]),
      });
      expect(status.coverageWarningCodes).not.toContain("AUDIT_TIMEOUT");
      const results = await services.auditService?.results({
        auditId: started.auditId,
        revision: 1,
        cursor: null,
        filters: {},
      });
      expect(results).toMatchObject({
        revision: 1,
        findings: [],
      });
    },
  );

  it("обрабатывает большой snapshot с production concurrency восемь и сохраняет порядок findings", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-bounded-audit-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const cacheRoot = join(homeDirectory, "Library", "Caches");
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        mkdir(join(cacheRoot, `Synthetic Candidate ${index}`), { recursive: true }),
      ),
    );
    const discoveredNames = await readdir(cacheRoot);
    const canonicalCacheRoot = await realpath(cacheRoot);
    let packageInventoryCount = 0;
    let fileInfoCount = 0;
    let activeFileInfo = 0;
    let maxActiveFileInfo = 0;
    let releaseInitialFileInfo: (() => void) | undefined;
    const initialFileInfoGate = new Promise<void>((resolve) => {
      releaseInitialFileInfo = resolve;
    });
    const executor: ArgvExecutor = async (executable, argv, { signal }) => {
      signal.throwIfAborted();
      if (executable === "/usr/sbin/pkgutil" && argv[0] === "--pkgs") {
        packageInventoryCount += 1;
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      if (executable === "/usr/sbin/pkgutil" && argv[0] === "--file-info") {
        fileInfoCount += 1;
        activeFileInfo += 1;
        maxActiveFileInfo = Math.max(maxActiveFileInfo, activeFileInfo);
        try {
          if (fileInfoCount <= 8) {
            if (fileInfoCount === 8) releaseInitialFileInfo?.();
            await initialFileInfoGate;
          }
          signal.throwIfAborted();
          return { stdout: "", stderr: "", exitCode: 0 };
        } finally {
          activeFileInfo -= 1;
        }
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      async canonicalize(path, signal) {
        signal.throwIfAborted();
        return path;
      },
      async stat(path, signal) {
        signal.throwIfAborted();
        return {
          device: "device-bounded",
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
      correlation: {
        commands: createCommandRunner(executor),
        filesystem,
      },
    });
    const started = (await services.auditService?.start({
      requestId: "bounded-audit-request",
      profile: "application_remnants",
    })) as { auditId: string };

    let state = "queued";
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const status = (await services.auditService?.status({
        auditId: started.auditId,
      })) as {
        state: string;
        progress: { processedCandidates: number; totalCandidates: number };
      };
      state = status.state;
      if (state === "completed" || state === "completed_with_warnings") {
        expect(status.progress).toMatchObject({
          processedCandidates: 8,
          totalCandidates: 8,
        });
        break;
      }
      if (state === "failed" || state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(state).toMatch(/^completed(?:_with_warnings)?$/u);
    expect(maxActiveFileInfo).toBe(8);
    expect(packageInventoryCount).toBe(2);
    expect(fileInfoCount).toBe(16);
    const results = await services.auditService?.results({
      auditId: started.auditId,
      revision: 1,
      cursor: null,
      filters: {},
    });
    const displayNames = (results as {
      findings: Array<{ displayName: string }>;
    }).findings.map(({ displayName }) => displayName);
    expect(displayNames).toEqual(
      discoveredNames.map((name) => {
        const candidatePath = join(canonicalCacheRoot, name);
        const publicSuffix = createHash("sha256")
          .update(candidatePath)
          .digest("hex")
          .slice(16, 24);
        return `Объект кэша ${publicSuffix}`;
      }),
    );
    const dashboard = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: 1,
    });
    const widgetNames = (dashboard as unknown as {
      meta: { dashboard: { findings: Array<{ componentDisplayName: string }> } };
    }).meta.dashboard.findings.map(({ componentDisplayName }) => componentDisplayName);
    expect(widgetNames).toEqual(discoveredNames);
    expect(JSON.stringify(dashboard)).not.toContain(canonicalCacheRoot);
  });

  it("проводит 101 finding через реальные MCP handlers с независимыми model и Dashboard cursor", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-integrated-pagination-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const cacheRoot = join(homeDirectory, "Library", "Caches");
    await Promise.all(
      Array.from({ length: 101 }, (_, index) =>
        mkdir(
          join(
            cacheRoot,
            `Pagination Candidate ${index.toString().padStart(3, "0")}`,
          ),
          { recursive: true },
        ),
      ),
    );
    const commands = createCommandRunner(async (_executable, _argv, { signal }) => {
      signal.throwIfAborted();
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      async canonicalize(path, signal) {
        signal.throwIfAborted();
        return path;
      },
      async stat(path, signal) {
        signal.throwIfAborted();
        return {
          device: "device-integrated-pagination",
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
    let nextId = 0;
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      correlation: { commands, filesystem },
      createId: (prefix) => `${prefix}-integrated-${++nextId}`,
    });
    const started = (await services.auditService?.start({
      requestId: "integrated-pagination-request",
      profile: "application_remnants",
    })) as { auditId: string };

    let state = "queued";
    for (let attempt = 0; attempt < 500; attempt += 1) {
      state = ((await services.auditService?.status({ auditId: started.auditId })) as {
        state: string;
      }).state;
      if (state === "completed" || state === "completed_with_warnings") break;
      if (state === "failed" || state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state).toMatch(/^completed(?:_with_warnings)?$/u);

    const server = createMcpServer(platform, services);
    const client = new Client({
      name: "integrated-pagination",
      version: "1.0.0",
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const modelFirst = await client.callTool({
        name: "audit_results",
        arguments: {
          auditId: started.auditId,
          revision: 1,
          cursor: null,
          filters: {},
        },
      });
      expect(modelFirst.isError).not.toBe(true);
      const modelPage = modelFirst.structuredContent as {
        findings: unknown[];
        nextCursor: string | null;
      };
      expect(modelPage.findings).toHaveLength(100);
      expect(modelPage.nextCursor).toEqual(expect.any(String));
      expect(
        Buffer.byteLength(JSON.stringify(modelPage.findings), "utf8"),
      ).toBeLessThanOrEqual(512 * 1024);

      const dashboardFirst = await client.callTool({
        name: "dashboard_open",
        arguments: { auditId: started.auditId, revision: 1 },
      });
      expect(dashboardFirst.isError).not.toBe(true);
      const dashboardMeta = dashboardFirst._meta?.["dashboard"] as {
        findingSummary: { matchingCount: number };
        findings: Array<{ findingId: string }>;
        nextCursor: string | null;
      };
      expect(dashboardMeta.findingSummary.matchingCount).toBe(101);
      expect(dashboardMeta.findings).toHaveLength(100);
      expect(dashboardMeta.nextCursor).toEqual(expect.any(String));
      expect(dashboardMeta.nextCursor).not.toBe(modelPage.nextCursor);
      expect(
        Buffer.byteLength(JSON.stringify(dashboardMeta.findings), "utf8"),
      ).toBeLessThanOrEqual(512 * 1024);

      const dashboardSecond = await client.callTool({
        name: "dashboard_page",
        arguments: {
          auditId: started.auditId,
          revision: 1,
          cursor: dashboardMeta.nextCursor,
          filters: {},
        },
      });
      expect(dashboardSecond.isError).not.toBe(true);
      const dashboardSecondPage = dashboardSecond.structuredContent as {
        findings: Array<{ findingId: string }>;
        nextCursor: string | null;
      };
      expect(dashboardSecondPage.findings).toHaveLength(1);
      expect(dashboardSecondPage.nextCursor).toBeNull();
      expect(
        new Set(
          [...dashboardMeta.findings, ...dashboardSecondPage.findings].map(
            ({ findingId }) => findingId,
          ),
        ).size,
      ).toBe(101);
      expect(
        Buffer.byteLength(JSON.stringify(dashboardSecondPage.findings), "utf8"),
      ).toBeLessThanOrEqual(512 * 1024);

      const crossChannel = await client.callTool({
        name: "dashboard_page",
        arguments: {
          auditId: started.auditId,
          revision: 1,
          cursor: modelPage.nextCursor,
          filters: {},
        },
      });
      expect(crossChannel.isError).toBe(true);
      expect(crossChannel._meta?.["codexMacCleaner/toolError"]).toMatchObject({
        errorCode: "AUDIT_STALE",
        severity: "blocking",
        scope: "audit",
        retryable: false,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("укладывает наблюдаемую Real-Mac стоимость 2 766 candidates в прежние пять минут", () => {
    const candidateCount = 2_766;
    const observedWorkerCostMs = Math.ceil((300_000 * 4) / 2_016);

    expect(Math.ceil((candidateCount * observedWorkerCostMs) / 4)).toBeGreaterThan(300_000);
    expect(Math.ceil((candidateCount * observedWorkerCostMs) / 8)).toBeLessThan(300_000);
  });

  it("показывает missing-target user LaunchAgent только как app-visible read-only diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-autostart-diagnostic-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const launchAgentsRoot = join(homeDirectory, "Library", "LaunchAgents");
    const launchAgentName = "org.example.synthetic-orphan.plist";
    const launchAgentPath = join(launchAgentsRoot, launchAgentName);
    const missingTarget = join(root, "missing", "Synthetic Helper");
    await mkdir(launchAgentsRoot, { recursive: true });
    await writeFile(launchAgentPath, "synthetic plist payload", "utf8");
    const canonicalLaunchAgentPath = await realpath(launchAgentPath);
    let plutilCalls = 0;
    const commands = createCommandRunner(async (executable, argv, { signal }) => {
      signal.throwIfAborted();
      if (executable === "/usr/bin/plutil" && argv.at(-1) === canonicalLaunchAgentPath) {
        plutilCalls += 1;
        return {
          stdout: JSON.stringify({ Program: missingTarget }),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      correlation: { commands },
    });
    const started = (await services.auditService?.start({
      requestId: "autostart-diagnostic-request",
      profile: "application_remnants",
    })) as { auditId: string };

    let state = "queued";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      state = ((await services.auditService?.status({ auditId: started.auditId })) as {
        state: string;
      }).state;
      if (state === "completed" || state === "completed_with_warnings") break;
      if (state === "failed" || state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state).toMatch(/^completed(?:_with_warnings)?$/u);

    const results = await services.auditService?.results({
      auditId: started.auditId,
      revision: 1,
      cursor: null,
      filters: {},
    });
    expect(plutilCalls).toBe(1);
    const modelFindings = (results as {
      findings: Array<{
        displayName: string;
        category: string;
        supportLevel: string;
        allowedActions: string[];
      }>;
    }).findings;
    expect(modelFindings).toEqual([
      expect.objectContaining({
        displayName: "Запись автозапуска с отсутствующим target",
        category: "autostart",
        supportLevel: "analysis_only",
        allowedActions: ["inspect"],
      }),
    ]);
    expect(JSON.stringify(results)).not.toContain(launchAgentName);
    expect(JSON.stringify(results)).not.toContain(root);

    const dashboard = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: 1,
    });
    const widgetFinding = (dashboard as unknown as {
      meta: {
        dashboard: {
          findings: Array<{
            componentDisplayName: string;
            findingFacts: {
              startupKinds: string[];
              targetExecutableState: string;
            };
          }>;
        };
      };
    }).meta.dashboard.findings[0];
    expect(widgetFinding).toMatchObject({
      componentDisplayName: launchAgentName,
      findingFacts: {
        startupKinds: ["launch_agent"],
        targetExecutableState: "absent",
      },
    });
    expect(JSON.stringify(dashboard)).not.toContain(root);
  });

  it("показывает missing-target system LaunchDaemon только как unsupported-manual diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-system-autostart-diagnostic-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const systemLibraryRoot = join(root, "system-library");
    const launchDaemonsRoot = join(systemLibraryRoot, "LaunchDaemons");
    const launchDaemonName = "org.example.synthetic-system-orphan.plist";
    const launchDaemonPath = join(launchDaemonsRoot, launchDaemonName);
    const missingTarget = join(root, "missing", "Synthetic Privileged Helper");
    await mkdir(homeDirectory, { recursive: true });
    await mkdir(launchDaemonsRoot, { recursive: true });
    await writeFile(launchDaemonPath, "synthetic plist payload", "utf8");
    const commands = createCommandRunner(async (executable, argv, { signal }) => {
      signal.throwIfAborted();
      if (executable === "/usr/bin/plutil" && argv.at(-1) === launchDaemonPath) {
        return {
          stdout: JSON.stringify({ ProgramArguments: [missingTarget, "--background"] }),
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      correlation: { commands },
      diagnostics: { systemLibraryRoot },
    });
    const started = (await services.auditService?.start({
      requestId: "system-autostart-diagnostic-request",
      profile: "application_remnants",
    })) as { auditId: string };

    let state = "queued";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      state = ((await services.auditService?.status({ auditId: started.auditId })) as {
        state: string;
      }).state;
      if (state === "completed" || state === "completed_with_warnings") break;
      if (state === "failed" || state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state).toMatch(/^completed(?:_with_warnings)?$/u);

    const results = await services.auditService?.results({
      auditId: started.auditId,
      revision: 1,
      cursor: null,
      filters: {},
    });
    expect((results as { findings: unknown[] }).findings).toEqual([
      expect.objectContaining({
        displayName: "Системная запись автозапуска с отсутствующим target",
        category: "autostart",
        supportLevel: "unsupported_manual",
        allowedActions: ["inspect"],
      }),
    ]);
    expect(JSON.stringify(results)).not.toContain(launchDaemonName);
    expect(JSON.stringify(results)).not.toContain(root);

    const dashboard = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: 1,
    });
    const widgetFinding = (dashboard as unknown as {
      meta: {
        dashboard: {
          findings: Array<{
            componentDisplayName: string;
            allowedActions: string[];
            findingFacts: {
              startupKinds: string[];
              targetExecutableState: string;
            };
          }>;
        };
      };
    }).meta.dashboard.findings[0];
    expect(widgetFinding).toMatchObject({
      componentDisplayName: launchDaemonName,
      allowedActions: ["inspect"],
      findingFacts: {
        startupKinds: ["launch_daemon"],
        targetExecutableState: "absent",
      },
    });
    expect(JSON.stringify(dashboard)).not.toContain(root);
  });

  it("показывает активный user process с отсутствующим executable только как diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-orphaned-process-diagnostic-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const missingExecutable = join(root, "Deleted App.app", "Contents", "MacOS", "Deleted Helper");
    const executableName = "Deleted Helper";
    await mkdir(homeDirectory, { recursive: true });
    const commands = createCommandRunner(async (executable, argv, { signal }) => {
      signal.throwIfAborted();
      if (
        executable === "/bin/ps" &&
        argv.join(" ") === "-axo pid=,uid=,comm="
      ) {
        return {
          stdout: `481  ${process.getuid?.() ?? 501} ${missingExecutable}\n`,
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    });
    const services = await createDefaultRuntimeServices({
      homeDirectory,
      stateRoot: join(root, "state"),
      correlation: { commands },
      diagnostics: { enableProcessInspection: true },
    });
    const started = (await services.auditService?.start({
      requestId: "orphaned-process-diagnostic-request",
      profile: "application_remnants",
    })) as { auditId: string };

    let state = "queued";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      state = ((await services.auditService?.status({ auditId: started.auditId })) as {
        state: string;
      }).state;
      if (state === "completed" || state === "completed_with_warnings") break;
      if (state === "failed" || state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state).toMatch(/^completed(?:_with_warnings)?$/u);

    const results = await services.auditService?.results({
      auditId: started.auditId,
      revision: 1,
      cursor: null,
      filters: {},
    });
    expect((results as { findings: unknown[] }).findings).toEqual([
      expect.objectContaining({
        displayName: "Активный процесс с отсутствующим executable",
        category: "unknown",
        supportLevel: "analysis_only",
        allowedActions: ["inspect"],
      }),
    ]);
    expect(JSON.stringify(results)).not.toContain(executableName);
    expect(JSON.stringify(results)).not.toContain(root);

    const dashboard = await services.auditService?.dashboard({
      auditId: started.auditId,
      revision: 1,
    });
    const widgetFinding = (dashboard as unknown as {
      meta: {
        dashboard: {
          findings: Array<{
            componentDisplayName: string;
            allowedActions: string[];
            findingFacts: {
              activityState: string;
              targetExecutableState: string;
            };
          }>;
        };
      };
    }).meta.dashboard.findings[0];
    expect(widgetFinding).toMatchObject({
      componentDisplayName: executableName,
      allowedActions: ["inspect"],
      findingFacts: {
        activityState: "present",
        targetExecutableState: "absent",
      },
    });
    expect(JSON.stringify(dashboard)).not.toContain(root);
  });

  it("отменяет все concurrent candidate workers общим audit signal", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-runtime-concurrent-cancel-"));
    roots.push(root);
    const homeDirectory = join(root, "home");
    const cacheRoot = join(homeDirectory, "Library", "Caches");
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        mkdir(join(cacheRoot, `Cancel Candidate ${index}`), { recursive: true }),
      ),
    );
    let activeFileInfo = 0;
    let maxActiveFileInfo = 0;
    let abortedFileInfo = 0;
    let markWorkersStarted: (() => void) | undefined;
    const workersStarted = new Promise<void>((resolve) => {
      markWorkersStarted = resolve;
    });
    const executor: ArgvExecutor = async (executable, argv, { signal }) => {
      signal.throwIfAborted();
      if (executable === "/usr/sbin/pkgutil" && argv[0] === "--file-info") {
        activeFileInfo += 1;
        maxActiveFileInfo = Math.max(maxActiveFileInfo, activeFileInfo);
        if (activeFileInfo >= 2) markWorkersStarted?.();
        try {
          await new Promise<void>((_resolve, reject) => {
            const abort = () => {
              abortedFileInfo += 1;
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            };
            if (signal.aborted) abort();
            else signal.addEventListener("abort", abort, { once: true });
          });
        } finally {
          activeFileInfo -= 1;
        }
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    const filesystem: MacOSCorrelationReadOnlyFileSystem = {
      async canonicalize(path, signal) {
        signal.throwIfAborted();
        return path;
      },
      async stat(path, signal) {
        signal.throwIfAborted();
        return {
          device: "device-cancel",
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
      candidateConcurrency: 4,
      correlation: {
        commands: createCommandRunner(executor),
        filesystem,
      },
    });
    const requestId = "concurrent-cancel-request";
    const started = (await services.auditService?.start({
      requestId,
      profile: "application_remnants",
    })) as { auditId: string };
    await Promise.race([
      workersStarted,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("Concurrent workers did not start")), 1_000),
      ),
    ]);
    await services.auditService?.cancel({ auditId: started.auditId, requestId });

    let state = "cancelling";
    for (let attempt = 0; attempt < 200; attempt += 1) {
      state = ((await services.auditService?.status({ auditId: started.auditId })) as {
        state: string;
      }).state;
      if (state === "cancelled") break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(state).toBe("cancelled");
    expect(maxActiveFileInfo).toBeGreaterThanOrEqual(2);
    expect(maxActiveFileInfo).toBeLessThanOrEqual(4);
    expect(abortedFileInfo).toBe(maxActiveFileInfo);
    expect(activeFileInfo).toBe(0);
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

  it.each([
    ["Caches", true],
    ["Logs", false],
  ] as const)(
    "применяет bounded regenerability rule к непустому %s artifact",
    async (libraryRoot, actionable) => {
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
        if (actionable) {
          expect(finding?.allowedActions).toContain("prepare_move");
          expect(finding?.blockingReasons).not.toContain("POLICY_DATA_KIND_UNKNOWN");
        } else {
          expect(finding?.allowedActions).not.toContain("prepare_move");
          expect(finding?.blockingReasons).toContain("POLICY_DATA_KIND_UNKNOWN");
        }
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

  it.each(["credentials.db", "Cookies", "sync-state"])(
    "пересчитывает cache proof перед preview и блокирует появившееся имя %s",
    async (sensitiveName) => {
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

      await writeFile(
        join(candidatePath, sensitiveName),
        "late-sensitive-payload",
        "utf8",
      );
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

  it.each([
    "Cookies",
    "Bookmarks",
    "session-store",
    "oauth-token",
    "sync-state",
    "vpn-profile",
    "Saved Games",
  ])(
    "не выдаёт prepare_move для cache с чувствительным вложенным именем %s",
    async (sensitiveName) => {
      const root = await mkdtemp(join(tmpdir(), "cmc-runtime-sensitive-cache-"));
      roots.push(root);
      const homeDirectory = join(root, "home");
      const candidatePath = join(
        homeDirectory,
        "Library",
        "Caches",
        "Sensitive Cache",
      );
      await mkdir(candidatePath, { recursive: true });
      await writeFile(
        join(candidatePath, sensitiveName),
        "synthetic-sensitive-payload",
        "utf8",
      );
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
        const results = await completedAudit(
          client,
          `sensitive-cache-${createHash("sha256")
            .update(sensitiveName)
            .digest("hex")
            .slice(0, 16)}`,
        );
        const finding = (results.structuredContent as {
          findings: Array<{
            allowedActions: string[];
            blockingReasons: string[];
          }>;
        }).findings[0];
        expect(finding?.allowedActions).not.toContain("prepare_move");
        expect(finding?.blockingReasons).toContain(
          "POLICY_DATA_KIND_UNKNOWN",
        );
      } finally {
        await client.close();
        await server.close();
      }
    },
  );

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

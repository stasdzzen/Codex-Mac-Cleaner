import { useEffect, useMemo, useState } from "react";

import { AuditDashboard } from "@/components/audit-dashboard";
import { Toaster } from "@/components/ui/sonner";
import {
  createStandaloneBridge,
} from "@/lib/bridge";
import type { DashboardSnapshot } from "@/lib/dashboard-types";

interface ToolResultLike {
  readonly structuredContent?: unknown;
  readonly _meta?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dashboardFromMeta(value: unknown): DashboardSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.dashboard)) return undefined;
  const dashboard = value.dashboard;
  const validState = [
    "queued",
    "running",
    "cancelling",
    "cancelled",
    "completed",
    "completed_with_warnings",
    "failed",
  ].includes(typeof dashboard.state === "string" ? dashboard.state : "");
  const revisionValid =
    dashboard.revision === null ||
    (typeof dashboard.revision === "number" &&
      Number.isSafeInteger(dashboard.revision) &&
      dashboard.revision >= 1);
  if (
    typeof dashboard.auditId !== "string" ||
    !revisionValid ||
    !validState ||
    typeof dashboard.stateVersion !== "number" ||
    !Number.isSafeInteger(dashboard.stateVersion) ||
    dashboard.stateVersion < 0 ||
    !isRecord(dashboard.progress) ||
    !isRecord(dashboard.coverage) ||
    !isRecord(dashboard.storageSummary) ||
    !isRecord(dashboard.diskObservation) ||
    typeof dashboard.excludedCount !== "number" ||
    !Array.isArray(dashboard.findings) ||
    !dashboard.findings.every(
      (finding) =>
        isRecord(finding) &&
        typeof finding.findingId === "string" &&
        Array.isArray(finding.allowedActions),
    ) ||
    !Array.isArray(dashboard.quarantineEntries) ||
    !dashboard.quarantineEntries.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.entryId === "string" &&
        entry.state === "moved",
    )
  ) {
    return undefined;
  }
  return dashboard as unknown as DashboardSnapshot;
}

function mergeSafeResult(
  current: DashboardSnapshot | null,
  result: ToolResultLike,
): DashboardSnapshot | null {
  const hydrated = dashboardFromMeta(result._meta);
  if (
    hydrated !== undefined &&
    (current === null || hydrated.stateVersion >= current.stateVersion)
  ) {
    return hydrated;
  }
  if (current === null) return null;
  if (!isRecord(result.structuredContent)) return current;
  const safe = result.structuredContent;
  const incomingVersion = safe.stateVersion;
  if (typeof incomingVersion !== "number" || incomingVersion < current.stateVersion) {
    return current;
  }
  return {
    ...current,
    ...(typeof safe.auditId === "string" ? { auditId: safe.auditId } : {}),
    ...(typeof safe.revision === "number" ? { revision: safe.revision } : {}),
    ...(typeof safe.state === "string" ? { state: safe.state as DashboardSnapshot["state"] } : {}),
    ...(isRecord(safe.storageSummary)
      ? { storageSummary: safe.storageSummary as unknown as DashboardSnapshot["storageSummary"] }
      : {}),
    ...(isRecord(safe.diskObservation)
      ? { diskObservation: safe.diskObservation as unknown as DashboardSnapshot["diskObservation"] }
      : {}),
    ...(typeof safe.excludedCount === "number"
      ? { excludedCount: safe.excludedCount }
      : {}),
    stateVersion: incomingVersion,
  };
}

function initialToolResult(): ToolResultLike {
  const host = window as unknown as {
    openai?: { toolOutput?: unknown; toolResponseMetadata?: unknown };
  };
  return {
    structuredContent: host.openai?.toolOutput,
    _meta: host.openai?.toolResponseMetadata,
  };
}

export function App() {
  const bridge = useMemo(() => createStandaloneBridge(), []);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(() =>
    mergeSafeResult(null, initialToolResult()),
  );

  useEffect(() => {
    const receiveToolResult = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || !isRecord(event.data)) return;
      if (event.data.method !== "ui/notifications/tool-result") return;
      const params = isRecord(event.data.params)
        ? (event.data.params as ToolResultLike)
        : {};
      setSnapshot((current) => mergeSafeResult(current, params));
    };
    window.addEventListener("message", receiveToolResult, { passive: true });
    return () => window.removeEventListener("message", receiveToolResult);
  }, []);

  return (
    <>
      {snapshot === null ? (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-6">
          <section className="w-full rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
            <p className="text-sm text-muted-foreground">Codex Mac Cleaner</p>
            <h1 className="mt-2 text-2xl font-semibold">Проверка Mac</h1>
            <h2 className="mt-6 text-base font-medium">Ожидание результатов</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Найденные объекты и доступные действия появятся после ответа локального плагина.
            </p>
          </section>
        </main>
      ) : (
        <AuditDashboard snapshot={snapshot} bridge={bridge} />
      )}
      <Toaster position="bottom-right" />
    </>
  );
}

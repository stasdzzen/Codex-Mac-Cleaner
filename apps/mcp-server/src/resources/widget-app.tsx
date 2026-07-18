import { useEffect, useMemo, useState } from "react";

import { AuditDashboard } from "@/components/audit-dashboard";
import { Toaster } from "@/components/ui/sonner";
import {
  createStandaloneBridge,
} from "@/lib/bridge";
import type { DashboardSnapshot } from "@/lib/dashboard-types";
import { standaloneFixture } from "@/lib/standalone-fixture";

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
  if (
    typeof dashboard.auditId !== "string" ||
    typeof dashboard.stateVersion !== "number" ||
    !Array.isArray(dashboard.findings) ||
    !Array.isArray(dashboard.quarantineEntries)
  ) {
    return undefined;
  }
  return dashboard as unknown as DashboardSnapshot;
}

function mergeSafeResult(
  current: DashboardSnapshot,
  result: ToolResultLike,
): DashboardSnapshot {
  const hydrated = dashboardFromMeta(result._meta);
  if (hydrated !== undefined && hydrated.stateVersion >= current.stateVersion) {
    return hydrated;
  }
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
  const [snapshot, setSnapshot] = useState(() =>
    mergeSafeResult(standaloneFixture, initialToolResult()),
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
      <AuditDashboard snapshot={snapshot} bridge={bridge} />
      <Toaster position="bottom-right" />
    </>
  );
}

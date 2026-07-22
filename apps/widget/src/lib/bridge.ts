import {
  isAllowedExternalUrl,
  type WidgetExternalUrl,
} from "@/lib/project-links";

export type DashboardTab =
  | "overview"
  | "findings"
  | "quarantine"
  | "exclusions"
  | "schedule";

export interface WidgetViewState {
  readonly activeTab: DashboardTab;
  readonly filter: string;
  readonly selectedFindingId: string | null;
  readonly selectedQuarantineEntryId: string | null;
  readonly panel: "none" | "evidence";
  readonly skippedFindingIds: readonly string[];
}

export interface WidgetBridge {
  callTool<T>(name: string, input: Record<string, unknown>): Promise<T>;
  setViewState(state: WidgetViewState): void;
  requestDisplayMode?(mode: "fullscreen"): Promise<void>;
  openExternal?(url: WidgetExternalUrl): Promise<void>;
}

export function acceptSnapshot(
  currentVersion: number,
  incomingVersion: number,
): boolean {
  return incomingVersion >= currentVersion;
}

export function createRequestId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createStandaloneBridge(): WidgetBridge {
  const host = window as unknown as {
    openai?: {
      requestDisplayMode?: (request: {
        mode: "fullscreen";
      }) => Promise<unknown>;
      openExternal?: (request: { href: WidgetExternalUrl }) => Promise<unknown>;
    };
  };
  const requestDisplayMode = host.openai?.requestDisplayMode;
  const openExternal = host.openai?.openExternal;
  return {
    async callTool<T>(): Promise<T> {
      throw new Error("Подключение MCP App tools будет добавлено в CMC-09.");
    },
    setViewState(): void {},
    ...(requestDisplayMode === undefined
      ? {}
      : {
          async requestDisplayMode(mode: "fullscreen"): Promise<void> {
            await requestDisplayMode.call(host.openai, { mode });
          },
        }),
    ...(openExternal === undefined
      ? {}
      : {
          async openExternal(url: WidgetExternalUrl): Promise<void> {
            if (!isAllowedExternalUrl(url)) {
              throw new Error("EXTERNAL_URL_NOT_ALLOWED");
            }
            await openExternal.call(host.openai, { href: url });
          },
        }),
  };
}

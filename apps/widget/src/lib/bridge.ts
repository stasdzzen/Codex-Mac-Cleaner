import {
  isAllowedExternalUrl,
  type WidgetExternalUrl,
} from "@/lib/project-links";

export type DashboardTab =
  | "overview"
  | "quarantine"
  | "exclusions"
  | "schedule";

export type WidgetDisplayMode = "inline" | "fullscreen";

export interface WidgetViewState {
  readonly activeTab: DashboardTab;
  readonly selectedFindingId: string | null;
  readonly panel: "none" | "evidence";
  readonly skippedFindingIds: readonly string[];
}

export interface WidgetBridge {
  callTool<T>(name: string, input: Record<string, unknown>): Promise<T>;
  setViewState(state: WidgetViewState): void;
  getDisplayMode?(): WidgetDisplayMode;
  requestDisplayMode?(mode: WidgetDisplayMode): Promise<WidgetDisplayMode>;
  openExternal?(url: WidgetExternalUrl): Promise<void>;
}

interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: number;
  readonly result?: {
    readonly structuredContent?: unknown;
    readonly content?: unknown;
    readonly isError?: boolean;
  };
  readonly error?: { readonly message?: string };
}

type PendingRequest = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: Error) => void;
  readonly timeoutId: number;
};

const pending = new Map<number, PendingRequest>();
let nextRequestId = 0;

window.addEventListener(
  "message",
  (event: MessageEvent<unknown>) => {
    if (
      event.source !== window.parent ||
      typeof event.data !== "object" ||
      event.data === null
    ) {
      return;
    }
    const response = event.data as Partial<JsonRpcResponse>;
    if (response.jsonrpc !== "2.0" || typeof response.id !== "number") return;
    const request = pending.get(response.id);
    if (request === undefined) return;
    pending.delete(response.id);
    window.clearTimeout(request.timeoutId);
    if (response.error !== undefined || response.result?.isError === true) {
      request.reject(
        new Error(response.error?.message ?? "MCP_APP_TOOL_ERROR"),
      );
      return;
    }
    request.resolve(response.result?.structuredContent ?? response.result);
  },
  { passive: true },
);

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
      setWidgetState?: (value: WidgetViewState) => void;
      displayMode?: string;
      requestDisplayMode?: (request: {
        mode: WidgetDisplayMode;
      }) => Promise<unknown>;
      openExternal?: (request: { href: WidgetExternalUrl }) => Promise<unknown>;
    };
  };
  const requestDisplayMode = host.openai?.requestDisplayMode;
  const openExternal = host.openai?.openExternal;
  return {
    callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
      const id = ++nextRequestId;
      return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error("MCP_APP_TOOL_TIMEOUT"));
        }, 30_000);
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
          timeoutId,
        });
        window.parent.postMessage(
          {
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name, arguments: input },
          },
          "*",
        );
      });
    },
    setViewState(state: WidgetViewState): void {
      host.openai?.setWidgetState?.(state);
    },
    getDisplayMode(): WidgetDisplayMode {
      return host.openai?.displayMode === "fullscreen" ? "fullscreen" : "inline";
    },
    ...(requestDisplayMode === undefined
      ? {}
      : {
          async requestDisplayMode(
            mode: WidgetDisplayMode,
          ): Promise<WidgetDisplayMode> {
            const result = await requestDisplayMode.call(host.openai, { mode });
            if (
              typeof result === "object" &&
              result !== null
            ) {
              const observedMode = Reflect.get(result, "mode");
              if (observedMode === "fullscreen" || observedMode === "inline") {
                return observedMode;
              }
            }
            return mode;
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

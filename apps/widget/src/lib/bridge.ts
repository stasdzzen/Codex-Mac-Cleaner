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
  return {
    async callTool<T>(): Promise<T> {
      throw new Error("Подключение MCP App tools будет добавлено в CMC-09.");
    },
    setViewState(): void {},
  };
}

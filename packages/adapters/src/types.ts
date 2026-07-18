import type { SafeMetadata } from "@codex-mac-cleaner/contracts";

export type AuditSource =
  | "application_inventory"
  | "user_library_artifacts"
  | "process_activity"
  | "open_files"
  | "startup_items"
  | "package_receipts"
  | "protected_containers"
  | "filesystem_metadata"
  | "disk_observation";

export type SensitivityFlag =
  | "credentials"
  | "tokens"
  | "subscription_url"
  | "personal_data"
  | "database"
  | "local_project";

export type EvidenceKind =
  | "installed_app"
  | "library_artifact"
  | "process_activity"
  | "open_file"
  | "tcp_listener"
  | "startup_item"
  | "missing_executable"
  | "receipt"
  | "stale_receipt"
  | "official_uninstaller"
  | "filesystem_metadata"
  | "apfs_observation"
  | "time_machine_observation"
  | "protected_container_metadata"
  | "system_inspection";

export interface Observation {
  readonly observationId: string;
  readonly targetRef: string;
  readonly source: AuditSource;
  readonly evidenceKind: EvidenceKind;
  readonly displayName: string;
  readonly supportLevel: "candidate" | "analysis_only" | "unsupported_manual";
  readonly allowedActions: readonly "inspect"[];
  readonly staleDuringAudit: boolean;
  readonly observedAt: string;
  readonly fingerprint: string;
  readonly logicalSize: number;
  readonly physicalSize: number;
  readonly sensitivityFlags: readonly SensitivityFlag[];
  readonly safeExplanation: string;
  readonly recommendedMethod?:
    | "official_uninstaller"
    | "advanced_mode"
    | "inspect_only";
  readonly safeMetadata?: SafeMetadata;
}

export type AdapterWarningCode =
  | "CAPABILITY_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR";

export interface AdapterWarning {
  readonly source: AuditSource;
  readonly capability: string;
  readonly errorCode: AdapterWarningCode;
  readonly safeMessage: string;
}

export interface CapabilityReport {
  readonly supportedSources: readonly AuditSource[];
  readonly unavailableSources: readonly Readonly<{
    source: AuditSource;
    errorCode: AdapterWarningCode;
  }>[];
  readonly gaps: readonly AdapterWarning[];
}

export interface AdapterScanContext {
  readonly signal: AbortSignal;
}

export interface AdapterScanResult {
  readonly observations: readonly Observation[];
  readonly warnings: readonly AdapterWarning[];
}

export interface SourceAdapter {
  readonly id: string;
  readonly source: AuditSource;
  scan(context: Readonly<AdapterScanContext>): Promise<AdapterScanResult>;
}

export type AuditRunState =
  | "queued"
  | "running"
  | "cancelling"
  | "cancelled"
  | "completed"
  | "completed_with_warnings"
  | "failed";

export interface SnapshotProvider {
  capture(
    phase: "A" | "B",
    signal: AbortSignal,
  ): Promise<ReadonlyMap<string, string>>;
}

export interface CoordinatorResult {
  readonly state: Extract<
    AuditRunState,
    "cancelled" | "completed" | "completed_with_warnings" | "failed"
  >;
  readonly stateTransitions: readonly AuditRunState[];
  readonly observations: readonly Observation[];
  readonly capabilityReport: CapabilityReport;
  readonly coverage: Readonly<{
    checkedSourceCount: number;
    skippedSourceCount: number;
    gaps: readonly AdapterWarning[];
  }>;
  readonly writersClosed: boolean;
}

export interface AuditReportWriter {
  write(result: CoordinatorResult): Promise<void>;
  close(): Promise<void>;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isPermissionMessage(error: unknown): boolean {
  return error instanceof Error && /^(?:operation not permitted|permission denied)$/iu.test(error.message.trim());
}

export function toAdapterWarning(
  error: unknown,
  source: AuditSource,
  capability: string,
): AdapterWarning {
  const safeCapability = /^[a-z0-9][a-z0-9:_-]{0,127}$/u.test(capability)
    ? capability
    : "source-capability";
  const code = errorCode(error);
  if (code === "EACCES" || code === "EPERM" || isPermissionMessage(error)) {
    return {
      source,
      capability: safeCapability,
      errorCode: "PERMISSION_DENIED",
      safeMessage: "Источник недоступен из-за ограничений доступа",
    };
  }
  if (code === "ENOENT" || code === "ENOTSUP") {
    return {
      source,
      capability: safeCapability,
      errorCode: "CAPABILITY_UNAVAILABLE",
      safeMessage: "Источник не поддерживается в текущем окружении",
    };
  }
  return {
    source,
    capability: safeCapability,
    errorCode: "INTERNAL_ERROR",
    safeMessage: "Источник завершился с безопасно скрытой ошибкой",
  };
}

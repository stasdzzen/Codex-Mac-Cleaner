export type QuarantineErrorCode =
  | "ACTIVE_PROCESS"
  | "CROSS_VOLUME"
  | "INTERNAL_ERROR"
  | "MANIFEST_INCONSISTENT"
  | "OPEN_FILE"
  | "OPERATION_CONFLICT"
  | "PATH_OUTSIDE_ALLOWLIST"
  | "PREVIEW_EXPIRED"
  | "PROTECTED_SCOPE"
  | "SENSITIVE_DATA"
  | "SOURCE_CHANGED"
  | "SYMLINK_BOUNDARY";

const QUARANTINE_ERROR_CODES = new Set<QuarantineErrorCode>([
  "ACTIVE_PROCESS",
  "CROSS_VOLUME",
  "INTERNAL_ERROR",
  "MANIFEST_INCONSISTENT",
  "OPEN_FILE",
  "OPERATION_CONFLICT",
  "PATH_OUTSIDE_ALLOWLIST",
  "PREVIEW_EXPIRED",
  "PROTECTED_SCOPE",
  "SENSITIVE_DATA",
  "SOURCE_CHANGED",
  "SYMLINK_BOUNDARY",
]);

export function isQuarantineErrorCode(
  value: unknown,
): value is QuarantineErrorCode {
  return (
    typeof value === "string" &&
    QUARANTINE_ERROR_CODES.has(value as QuarantineErrorCode)
  );
}

export class QuarantineError extends Error {
  readonly failClosed = true;

  constructor(
    readonly code: QuarantineErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "QuarantineError";
  }
}

export type FaultPoint =
  | "beforeManifest"
  | "afterPrepared"
  | "afterRename"
  | "beforeJournalAppend";

export class InjectedFault extends Error {
  constructor(readonly point: FaultPoint) {
    super(`INJECTED_FAULT:${point}`);
    this.name = "InjectedFault";
  }
}

export type FaultInjector = (
  point: FaultPoint,
  operationId: string,
) => void | Promise<void>;

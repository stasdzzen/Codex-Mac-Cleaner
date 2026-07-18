import type {
  CorrelationRuleInputType,
  ServerCorrelationSignal,
  ServerCorrelationSignalInput,
} from "./types.js";

const OPAQUE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CORRELATION_FINGERPRINT = /^correlation:v1:[a-f0-9]{64}$/u;
const ALLOWED_FIELDS = new Set([
  "schemaVersion",
  "targetRef",
  "ruleInputType",
  "state",
  "observedAt",
  "fingerprint",
]);
const VALID_STATES: Readonly<Record<CorrelationRuleInputType, ReadonlySet<string>>> = {
  owner_identity: new Set(["confirmed", "mismatch", "unknown"]),
  installed_state: new Set(["present", "absent", "unknown"]),
  activity: new Set(["present", "absent", "unknown"]),
  open_file_state: new Set(["present", "absent", "unknown"]),
  target_existence: new Set(["present", "absent", "unknown"]),
  receipt: new Set(["present", "absent", "unknown"]),
  dependency: new Set(["present", "absent", "unknown"]),
  temporal: new Set(["current", "stale", "unknown"]),
  data_kind: new Set(["known", "unsafe", "unknown"]),
  capability: new Set(["available", "missing", "unknown"]),
};

function isCorrelationRuleInputType(value: unknown): value is CorrelationRuleInputType {
  return typeof value === "string" && value in VALID_STATES;
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.includes("T") &&
    Number.isFinite(Date.parse(value))
  );
}

export function createServerCorrelationSignal<
  Input extends CorrelationRuleInputType,
>(
  input: ServerCorrelationSignalInput<Input>,
): Extract<ServerCorrelationSignal, { readonly ruleInputType: Input }> {
  const candidate = input as unknown as Record<string, unknown>;
  const fields = Object.keys(candidate);
  if (
    fields.length !== ALLOWED_FIELDS.size ||
    fields.some((field) => !ALLOWED_FIELDS.has(field))
  ) {
    throw new TypeError("Correlation signal содержит запрещённые поля");
  }
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.targetRef !== "string" ||
    !OPAQUE_VALUE.test(candidate.targetRef) ||
    typeof candidate.fingerprint !== "string" ||
    !CORRELATION_FINGERPRINT.test(candidate.fingerprint) ||
    !isIsoDateTime(candidate.observedAt) ||
    !isCorrelationRuleInputType(candidate.ruleInputType) ||
    typeof candidate.state !== "string" ||
    !VALID_STATES[candidate.ruleInputType].has(candidate.state)
  ) {
    throw new TypeError("Correlation signal не прошёл fail-closed validation");
  }

  return Object.freeze({ ...input }) as Extract<
    ServerCorrelationSignal,
    { readonly ruleInputType: Input }
  >;
}

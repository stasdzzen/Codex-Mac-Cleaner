import { z } from "zod";

const FULL_PATH_PATTERN = /(?:^|[\s"'(])(?:\/(?:[^/\s]+\/)*[^/\s]+|[A-Za-z]:\\[^\s]+)/u;
const SECRET_ASSIGNMENT_PATTERN =
  /(?:token|password|secret|api[_-]?key|subscription[_-]?url)\s*[:=]\s*\S+/iu;

export const SafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const OpaqueIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const ModelSafeTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .superRefine((value, context) => {
    if (FULL_PATH_PATTERN.test(value)) {
      context.addIssue({ code: "custom", message: "Полный путь запрещён" });
    }
    if (SECRET_ASSIGNMENT_PATTERN.test(value)) {
      context.addIssue({ code: "custom", message: "Secret-like значение запрещено" });
    }
  });

export const NullableIsoDateTimeSchema = IsoDateTimeSchema.nullable();

export function hasOnlyValues<T extends string>(
  values: readonly T[],
  allowed: ReadonlySet<T>,
): boolean {
  return values.every((value) => allowed.has(value));
}

import { z } from "zod";

const POSIX_PATH_PATTERN = /(?:^|[\s:="'(])\/(?!\/)[^\s"'<>]+/u;
const FILE_URI_PATTERN = /\bfile:\/{3}[^\s"'<>]+/iu;
const WINDOWS_PATH_PATTERN =
  /(?:^|[\s:="'(])[A-Za-z]:\\(?:[^\\\s"'<>]+\\)*[^\\\s"'<>]+/u;
const SECRET_ASSIGNMENT_PATTERN =
  /["']?(?:token|password|secret|api[_-]?key|subscription[_-]?url)["']?\s*[:=]\s*(?:["'][^"']*["']|\S+)/iu;
const AUTHORIZATION_BEARER_PATTERN =
  /["']?authorization["']?\s*:\s*["']?bearer\s+[^\s"']+/iu;

export function containsFullPath(value: string): boolean {
  return (
    POSIX_PATH_PATTERN.test(value) ||
    FILE_URI_PATTERN.test(value) ||
    WINDOWS_PATH_PATTERN.test(value)
  );
}

export function containsSecretLikeValue(value: string): boolean {
  return (
    SECRET_ASSIGNMENT_PATTERN.test(value) ||
    AUTHORIZATION_BEARER_PATTERN.test(value)
  );
}

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
    if (containsFullPath(value)) {
      context.addIssue({ code: "custom", message: "Полный путь запрещён" });
    }
    if (containsSecretLikeValue(value)) {
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

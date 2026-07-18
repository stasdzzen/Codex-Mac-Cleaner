import {
  SafeMetadataSchema,
  type SafeMetadata,
} from "@codex-mac-cleaner/contracts";

import type { SensitivityFlag } from "./types.js";
import { makeObservation } from "./observation.js";
import type { Observation } from "./types.js";

export interface SafeMetadataInput {
  readonly raw: string;
  readonly name: string;
  readonly modifiedAt: string;
}

export interface SafeMetadataObservationInput extends SafeMetadataInput {
  readonly ref: string;
  readonly displayName: string;
  readonly fingerprint: string;
}

function detectFormat(name: string): SafeMetadata["format"] {
  const normalized = name.toLocaleLowerCase("en-US");
  if (normalized.endsWith(".json")) return "json";
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) return "yaml";
  if (normalized.endsWith(".plist")) return "plist";
  return "unknown";
}

function parseStatus(format: SafeMetadata["format"], raw: string): SafeMetadata["parseStatus"] {
  if (format === "json") {
    try {
      JSON.parse(raw);
      return "parsed";
    } catch {
      return "malformed";
    }
  }
  if (format === "yaml") {
    const meaningful = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    return meaningful.every((line) => /^(?:---|\.\.\.|[^:]+:\s*.*)$/u.test(line))
      ? "parsed"
      : "malformed";
  }
  if (format === "plist") {
    if (raw.startsWith("bplist00")) return "unsupported";
    return /<plist\b[^>]*>/iu.test(raw) && /<\/plist>\s*$/iu.test(raw)
      ? "parsed"
      : "malformed";
  }
  return "unsupported";
}

function sensitivityFlags(raw: string): SensitivityFlag[] {
  const checks: ReadonlyArray<readonly [SensitivityFlag, RegExp]> = [
    ["credentials", /password|passwd|secret|credential|api[_-]?key/iu],
    ["tokens", /token|bearer|oauth/iu],
    ["subscription_url", /subscription.{0,24}(?:url|https?:\/\/)|https?:\/\/[^\s<]*(?:subscribe|subscription)/iu],
    ["personal_data", /(?:email|phone|address|personal|document|savegame)/iu],
    ["database", /(?:database|sqlite|\.db\b)/iu],
    ["local_project", /(?:\.git\b|project(?:root)?)/iu],
  ];
  return checks.filter(([, pattern]) => pattern.test(raw)).map(([flag]) => flag);
}

export function parseSafeMetadata(input: SafeMetadataInput): SafeMetadata {
  const format = detectFormat(input.name);
  return SafeMetadataSchema.parse({
    format,
    parseStatus: parseStatus(format, input.raw),
    byteLength: Buffer.byteLength(input.raw),
    modifiedAt: input.modifiedAt,
    sensitivityFlags: sensitivityFlags(input.raw),
    declaredOwnerDisplayName: null,
  });
}

export function createSafeMetadataObservation(
  input: SafeMetadataObservationInput,
): Observation {
  const safeMetadata = parseSafeMetadata(input);
  return {
    ...makeObservation({
      targetRef: input.ref,
      source: "filesystem_metadata",
      evidenceKind: "filesystem_metadata",
      displayName: input.displayName,
      supportLevel: "analysis_only",
      allowedActions: [],
      observedAt: input.modifiedAt,
      fingerprint: input.fingerprint,
      sensitivityFlags: safeMetadata.sensitivityFlags,
      safeExplanation: "Конфигурация сведена к безопасным метаданным",
      recommendedMethod: "inspect_only",
    }),
    safeMetadata,
  };
}

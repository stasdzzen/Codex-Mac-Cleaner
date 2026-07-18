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

function isYamlMappingLine(line: string): boolean {
  if (line === "---" || line === "...") return true;
  const separator = line.indexOf(":");
  return separator > 0 && line.slice(0, separator).trim().length > 0;
}

function isSafeYamlStructure(raw: string): boolean {
  let lineStart = 0;
  for (let index = 0; index <= raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    if (index !== raw.length && code !== 10 && code !== 13) continue;

    const line = raw.slice(lineStart, index).trim();
    if (line.length > 0 && !line.startsWith("#") && !isYamlMappingLine(line)) {
      return false;
    }

    if (code === 13 && raw.charCodeAt(index + 1) === 10) index += 1;
    lineStart = index + 1;
  }
  return true;
}

function hasPlistEnvelope(raw: string): boolean {
  const opening = raw.indexOf("<plist");
  if (opening < 0) return false;
  const boundary = raw.charAt(opening + "<plist".length);
  if (boundary !== ">" && boundary !== " " && boundary !== "\t" && boundary !== "\r" && boundary !== "\n") {
    return false;
  }
  return raw.trimEnd().endsWith("</plist>");
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
    return isSafeYamlStructure(raw) ? "parsed" : "malformed";
  }
  if (format === "plist") {
    if (raw.startsWith("bplist00")) return "unsupported";
    return hasPlistEnvelope(raw) ? "parsed" : "malformed";
  }
  return "unsupported";
}

function sensitivityFlags(raw: string): SensitivityFlag[] {
  const normalized = raw.toLocaleLowerCase("en-US");
  const hasAny = (needles: readonly string[]): boolean =>
    needles.some((needle) => normalized.includes(needle));
  const hasWebAddress = normalized.includes("http://") || normalized.includes("https://");
  const checks: ReadonlyArray<readonly [SensitivityFlag, boolean]> = [
    ["credentials", hasAny(["password", "passwd", "secret", "credential", "apikey", "api_key", "api-key"])],
    ["tokens", hasAny(["token", "bearer", "oauth"])],
    [
      "subscription_url",
      (normalized.includes("subscription") && (normalized.includes("url") || hasWebAddress)) ||
        (hasWebAddress && normalized.includes("subscribe")),
    ],
    ["personal_data", hasAny(["email", "phone", "address", "personal", "document", "savegame"])],
    ["database", hasAny(["database", "sqlite", ".db"])],
    ["local_project", hasAny([".git", "project", "projectroot"])],
  ];
  return checks.filter(([, matched]) => matched).map(([flag]) => flag);
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

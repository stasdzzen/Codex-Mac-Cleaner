import { createHash } from "node:crypto";
import { basename } from "node:path";

import {
  ModelSafeTextSchema,
  OpaqueIdSchema,
} from "@codex-mac-cleaner/contracts";

import type { Observation, SensitivityFlag } from "./types.js";

export function opaqueRef(namespace: string, value: string): string {
  return `${namespace}-${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export function safeDisplayName(value: string, fallback: string): string {
  const normalized = basename(value)
    .replace(/\.app$/iu, "")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 160);
  const parsed = ModelSafeTextSchema.safeParse(normalized);
  return parsed.success ? parsed.data : fallback;
}

function safeOpaqueId(namespace: string, value: string): string {
  const parsed = OpaqueIdSchema.safeParse(value);
  return parsed.success ? parsed.data : opaqueRef(namespace, value);
}

function safeSize(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}

export function makeObservation(input: Readonly<{
  targetRef: string;
  source: Observation["source"];
  evidenceKind: Observation["evidenceKind"];
  displayName: string;
  supportLevel: Observation["supportLevel"];
  allowedActions: Observation["allowedActions"];
  observedAt: string;
  fingerprint: string;
  logicalSize?: number | undefined;
  physicalSize?: number | undefined;
  sensitivityFlags?: readonly SensitivityFlag[] | undefined;
  safeExplanation: string;
  recommendedMethod?: Observation["recommendedMethod"] | undefined;
}>): Observation {
  const result: Observation = {
    observationId: opaqueRef("observation", `${input.source}:${input.targetRef}:${input.evidenceKind}`),
    targetRef: safeOpaqueId("target", input.targetRef),
    source: input.source,
    evidenceKind: input.evidenceKind,
    displayName: safeDisplayName(input.displayName, "Synthetic observation"),
    supportLevel: input.supportLevel,
    allowedActions: input.allowedActions,
    staleDuringAudit: false,
    observedAt: input.observedAt,
    fingerprint: opaqueRef("fingerprint", input.fingerprint),
    logicalSize: safeSize(input.logicalSize),
    physicalSize: safeSize(input.physicalSize),
    sensitivityFlags: input.sensitivityFlags ?? [],
    safeExplanation: input.safeExplanation,
  };
  if (input.recommendedMethod !== undefined) {
    return { ...result, recommendedMethod: input.recommendedMethod };
  }
  return result;
}

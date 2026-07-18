import { classifyEvidence, type Classification } from "@codex-mac-cleaner/classifier";
import {
  buildCorrelationEvidenceSet,
  type BuildCorrelationEvidenceOptions,
  type CorrelationResolverResult,
  type EvidenceSet,
} from "@codex-mac-cleaner/evidence";

import { evaluatePolicy } from "./evaluate.js";
import type { PolicyDecision, PolicyInput } from "./types.js";

export interface SafeCoreIntegrationHarnessInput {
  readonly resolverResult: CorrelationResolverResult;
  readonly evidenceOptions: BuildCorrelationEvidenceOptions;
  readonly policyContext: Omit<
    PolicyInput,
    "classification" | "evidenceSet" | "correlationRevision"
  >;
}

export interface SafeCoreIntegrationHarnessResult {
  readonly safeInput: Readonly<{
    schemaVersion: 2;
    findingId: string;
    auditRevision: number;
    correlationRevisionId: string;
    ownerBindingState: CorrelationResolverResult["safeView"]["ownerBindingState"];
    requirementProfileId: CorrelationResolverResult["safeView"]["requirementProfileId"];
    requirementApplicability: CorrelationResolverResult["safeView"]["requirementApplicability"];
    receiptLifecycle: CorrelationResolverResult["safeView"]["receiptLifecycle"];
    facts: CorrelationResolverResult["safeView"]["facts"];
    coverageSummary: CorrelationResolverResult["safeView"]["coverageSummary"];
    blockingReasonCodes: CorrelationResolverResult["safeView"]["blockingReasonCodes"];
    staleDuringAudit: boolean;
  }>;
  readonly evidenceSet: EvidenceSet;
  readonly classification: Classification;
  readonly decision: PolicyDecision;
}

export function runSafeCoreIntegrationHarness(
  input: SafeCoreIntegrationHarnessInput,
): SafeCoreIntegrationHarnessResult {
  const evidenceSet = buildCorrelationEvidenceSet(
    input.resolverResult,
    input.evidenceOptions,
  );
  const classification = classifyEvidence(evidenceSet);
  const decision = evaluatePolicy({
    ...input.policyContext,
    evidenceSet,
    classification,
    correlationRevision: input.resolverResult.revision,
  });
  return Object.freeze({
    safeInput: Object.freeze({
      schemaVersion: 2 as const,
      findingId: input.resolverResult.safeView.findingId,
      auditRevision: input.resolverResult.safeView.auditRevision,
      correlationRevisionId:
        input.resolverResult.safeView.correlationRevisionId,
      ownerBindingState: input.resolverResult.safeView.ownerBindingState,
      requirementProfileId: input.resolverResult.safeView.requirementProfileId,
      requirementApplicability: input.resolverResult.safeView.requirementApplicability,
      receiptLifecycle: input.resolverResult.safeView.receiptLifecycle,
      facts: input.resolverResult.safeView.facts,
      coverageSummary: input.resolverResult.safeView.coverageSummary,
      blockingReasonCodes: input.resolverResult.safeView.blockingReasonCodes,
      staleDuringAudit: input.resolverResult.safeView.staleDuringAudit,
    }),
    evidenceSet,
    classification,
    decision,
  });
}

import { describe, expect, it } from "vitest";

import {
  CorrelationEdgeSchema,
  CorrelationFactSchema,
  CorrelationRequirementProfileSchema,
  CorrelationRevisionSchema,
  CorrelationSubjectSchema,
  CoverageCertificateSchema,
  OwnerBindingSchema,
  ReceiptLifecycleFactSchema,
  SafeCorrelationViewSchema,
  SourceProvenanceSchema,
} from "../src/index.js";

const digest = (value: string) => `hmac-sha256:v1:${value.repeat(64)}`;
const fingerprint = (value: string) => `sha256:v1:${value.repeat(64)}`;
const observedAt = "2026-07-18T00:00:00.000Z";

const provenance = {
  schemaVersion: 2,
  provenanceId: "provenance-synthetic-a",
  sourceAdapter: "canonical-application-inventory",
  sourceSchemaVersion: 2,
  queryId: "query-synthetic-a",
  queryScope: "installed_apps",
  snapshotId: "snapshot-synthetic-a",
  phase: "query",
  startedAt: observedAt,
  completedAt: observedAt,
  queryFingerprint: fingerprint("a"),
  capabilityState: "available",
  permissionState: "granted",
  completionState: "complete",
  parseState: "complete",
  truncated: false,
  warningCodes: [],
} as const;

const certificate = {
  schemaVersion: 2,
  certificateId: "certificate-synthetic-a",
  sourceAdapter: "canonical-application-inventory",
  queryScope: "installed_apps",
  subjectId: digest("b"),
  snapshotId: "snapshot-synthetic-a",
  queryFingerprint: fingerprint("a"),
  coverageFingerprint: fingerprint("b"),
  capabilityState: "available",
  permissionState: "granted",
  completionState: "complete",
  parseState: "complete",
  partial: false,
  ambiguous: false,
  issuedAt: observedAt,
} as const;

const artifactSubject = {
  schemaVersion: 2,
  subjectId: digest("a"),
  subjectRole: "library_artifact",
  subjectKind: "filesystem_object",
  claimDigests: [
    { kind: "filesystem", digest: digest("b") },
    { kind: "owner", digest: digest("c") },
  ],
  provenanceIds: [provenance.provenanceId],
  snapshotId: provenance.snapshotId,
  identityFingerprint: fingerprint("d"),
  resolutionState: "resolved",
} as const;

const ownerSubject = {
  schemaVersion: 2,
  subjectId: digest("d"),
  subjectRole: "owner_application",
  subjectKind: "app_bundle",
  claimDigests: [
    { kind: "bundle", digest: digest("e") },
    { kind: "signing", digest: digest("f") },
    { kind: "executable", digest: digest("1") },
  ],
  provenanceIds: [provenance.provenanceId],
  snapshotId: provenance.snapshotId,
  identityFingerprint: fingerprint("e"),
  resolutionState: "resolved",
} as const;

const binding = {
  schemaVersion: 2,
  bindingId: "owner-binding-synthetic-a",
  artifactSubjectId: artifactSubject.subjectId,
  ownerSubjectId: ownerSubject.subjectId,
  ruleId: "OWNER_BINDING_SIGNED_HISTORY_V1",
  ruleVersion: 1,
  sourceKind: "signed_process_open_file_history",
  claimDigests: [digest("6"), digest("7")],
  provenanceIds: [provenance.provenanceId],
  createdAt: observedAt,
  lastValidatedAt: observedAt,
  bindingFingerprint: fingerprint("8"),
  resolutionState: "resolved",
} as const;

const profile = {
  schemaVersion: 2,
  profileId: "private_regenerable_remnant_v1",
  profileVersion: 1,
  requirements: [
    { requirementId: "artifact_existence", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "owner_application", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "owner_executable", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "activity", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "open_file", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "startup_target", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "receipt", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "official_uninstaller", applicability: "required", reasonCode: "profile_required" },
    { requirementId: "dependency", applicability: "not_applicable", reasonCode: "private_non_executable_artifact" },
  ],
  profileFingerprint: fingerprint("9"),
} as const;

const revision = {
  schemaVersion: 2,
  derivationVersion: 1,
  correlationRevisionId: "correlation-revision-synthetic-a",
  auditId: "audit-synthetic-a",
  auditRevision: 1,
  snapshotId: "snapshot-synthetic-a",
  snapshotAFingerprint: fingerprint("c"),
  snapshotBFingerprint: fingerprint("c"),
  subjectSetDigest: fingerprint("d"),
  edgeSetDigest: fingerprint("e"),
  coverageReportDigest: fingerprint("f"),
  ownerBindingFingerprint: binding.bindingFingerprint,
  requirementProfileId: profile.profileId,
  requirementProfileVersion: profile.profileVersion,
  requirementProfileFingerprint: profile.profileFingerprint,
  ruleSetVersion: 2,
  policyVersion: 2,
  exclusionStateVersion: 1,
  staleDuringAudit: false,
  createdAt: observedAt,
} as const;

describe("exact correlation schemas v2", () => {
  it("разделяет cleanup artifact и owner application", () => {
    expect(CorrelationSubjectSchema.parse(artifactSubject)).toEqual(artifactSubject);
    expect(CorrelationSubjectSchema.parse(ownerSubject)).toEqual(ownerSubject);
    expect(() => CorrelationSubjectSchema.parse({ ...artifactSubject, schemaVersion: 1 })).toThrow();
    expect(() => CorrelationSubjectSchema.parse({ ...artifactSubject, subjectRole: undefined })).toThrow();
    expect(() =>
      CorrelationSubjectSchema.parse({
        ...artifactSubject,
        subjectRole: "library_artifact",
        subjectKind: "app_bundle",
      }),
    ).toThrow();
  });

  it("разрешает owner authority только authoritative remnant_of", () => {
    const edge = {
      schemaVersion: 2,
      edgeId: "edge-synthetic-a",
      fromSubjectId: artifactSubject.subjectId,
      toSubjectId: ownerSubject.subjectId,
      relation: "remnant_of",
      ruleId: binding.ruleId,
      ruleVersion: 1,
      claimKinds: ["historical_binding"],
      strength: "authoritative",
      resolutionState: "resolved",
      provenanceIds: [provenance.provenanceId],
      snapshotId: provenance.snapshotId,
      edgeFingerprint: fingerprint("e"),
    } as const;

    expect(CorrelationEdgeSchema.parse(edge)).toEqual(edge);
    expect(OwnerBindingSchema.parse(binding)).toEqual(binding);
    expect(() => CorrelationEdgeSchema.parse({ ...edge, strength: "corroborated" })).toThrow();
    expect(() => CorrelationEdgeSchema.parse({ ...edge, relation: "installed_as" })).not.toThrow();
    expect(() => OwnerBindingSchema.parse({ ...binding, sourceKind: "user_attestation" })).toThrow();
    expect(() => OwnerBindingSchema.parse({ ...binding, rawPath: "/private/canary" })).toThrow();
  });

  it("фиксирует server-owned profile и typed applicability", () => {
    expect(CorrelationRequirementProfileSchema.parse(profile)).toEqual(profile);
    expect(() =>
      CorrelationRequirementProfileSchema.parse({
        ...profile,
        requirements: profile.requirements.filter(({ requirementId }) => requirementId !== "dependency"),
      }),
    ).toThrow();
    expect(() =>
      CorrelationRequirementProfileSchema.parse({
        ...profile,
        requirements: profile.requirements.map((requirement) =>
          requirement.requirementId === "artifact_existence"
            ? { ...requirement, applicability: "not_applicable" }
            : requirement
        ),
      }),
    ).toThrow();
  });

  it("валидирует v2 provenance/certificate и раздельные lifecycle facts", () => {
    expect(SourceProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(CoverageCertificateSchema.parse(certificate)).toEqual(certificate);
    expect(CorrelationFactSchema.parse({ state: "present", reasonCode: "snapshot_stable" })).toEqual({
      state: "present",
      reasonCode: "snapshot_stable",
    });
    expect(ReceiptLifecycleFactSchema.parse({
      lifecycle: "stale",
      reasonCode: "exact_payload_owner_absent",
      certificateId: "certificate-receipt",
    }).lifecycle).toBe("stale");
    expect(() => ReceiptLifecycleFactSchema.parse({ lifecycle: "absent" })).toThrow();
  });

  it("legacy target executable не проходит как actionable safe view", () => {
    const safeView = {
      schemaVersion: 2,
      findingId: "finding-synthetic-a",
      auditRevision: 1,
      correlationRevisionId: revision.correlationRevisionId,
      ownerBindingState: "resolved",
      ownerBindingSourceClass: "signed_history",
      requirementProfileId: profile.profileId,
      facts: {
        artifactExistence: { state: "present", reasonCode: "snapshot_stable" },
        ownerApplication: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-owner-app" },
        ownerExecutable: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-owner-executable" },
        activity: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-activity" },
        openFile: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-open" },
        startupTarget: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-startup" },
        officialUninstaller: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-uninstaller" },
        dependency: { state: "unknown", reasonCode: "not_applicable" },
      },
      receiptLifecycle: {
        lifecycle: "stale",
        reasonCode: "exact_payload_owner_absent",
        certificateId: "certificate-receipt",
      },
      requirementApplicability: Object.fromEntries(
        profile.requirements.map(({ requirementId, applicability }) => [requirementId, applicability]),
      ),
      coverageSummary: { completeSourceCount: 7, gapCount: 0, gapCodes: [] },
      staleDuringAudit: false,
      blockingReasonCodes: [],
      allowedActions: ["inspect", "reveal", "exclude", "prepare_move"],
    } as const;

    expect(CorrelationRevisionSchema.parse(revision)).toEqual(revision);
    expect(SafeCorrelationViewSchema.parse(safeView)).toEqual(safeView);
    expect(() =>
      SafeCorrelationViewSchema.parse({
        ...safeView,
        facts: { ...safeView.facts, targetExecutable: { state: "present", reasonCode: "positive_relation" } },
      }),
    ).toThrow();
    expect(() => SafeCorrelationViewSchema.parse({ ...safeView, profileId: "client-selected" })).toThrow();
    expect(JSON.stringify(SafeCorrelationViewSchema.parse(safeView))).not.toMatch(
      /path|bundle|package|signing|inventory|token|secret|personal/i,
    );
  });
});

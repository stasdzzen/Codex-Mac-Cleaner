import { describe, expect, it } from "vitest";

import {
  CorrelationEdgeSchema,
  CorrelationFactSchema,
  CorrelationRevisionSchema,
  CorrelationSubjectSchema,
  CoverageCertificateSchema,
  SafeCorrelationViewSchema,
  SourceProvenanceSchema,
} from "../src/index.js";

const digest = (value: string) => `hmac-sha256:v1:${value.repeat(64)}`;
const fingerprint = (value: string) => `sha256:v1:${value.repeat(64)}`;
const observedAt = "2026-07-18T00:00:00.000Z";

const provenance = {
  schemaVersion: 1,
  provenanceId: "provenance-synthetic-a",
  sourceAdapter: "application_inventory",
  sourceSchemaVersion: 1,
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
  schemaVersion: 1,
  certificateId: "certificate-synthetic-a",
  sourceAdapter: "application_inventory",
  queryScope: "installed_apps",
  subjectId: digest("a"),
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

const revision = {
  schemaVersion: 1,
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
  ruleSetVersion: 1,
  policyVersion: 1,
  exclusionStateVersion: 1,
  staleDuringAudit: false,
  createdAt: observedAt,
} as const;

describe("exact correlation schemas", () => {
  it("принимает server-only subject/edge и отклоняет transport/raw поля", () => {
    const subject = {
      schemaVersion: 1,
      subjectId: digest("a"),
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
    const edge = {
      schemaVersion: 1,
      edgeId: "edge-synthetic-a",
      fromSubjectId: digest("a"),
      toSubjectId: digest("e"),
      relation: "installed_as",
      ruleId: "CORRELATION_INSTALLED_APP_V1",
      ruleVersion: 1,
      claimKinds: ["bundle", "signing", "executable"],
      strength: "corroborated",
      resolutionState: "resolved",
      provenanceIds: [provenance.provenanceId],
      snapshotId: provenance.snapshotId,
      edgeFingerprint: fingerprint("e"),
    } as const;

    expect(CorrelationSubjectSchema.parse(subject)).toEqual(subject);
    expect(CorrelationEdgeSchema.parse(edge)).toEqual(edge);
    expect(() => CorrelationSubjectSchema.parse({ ...subject, targetRef: "legacy" })).toThrow();
    expect(() =>
      CorrelationSubjectSchema.parse({
        ...subject,
        path: ["", "synthetic", "private"].join("/"),
      }),
    ).toThrow();
    expect(() => CorrelationEdgeSchema.parse({ ...edge, score: 0.99 })).toThrow();
    expect(() => CorrelationEdgeSchema.parse({ ...edge, resolutionState: "best_match" })).toThrow();
  });

  it("валидирует provenance, certificate и same-snapshot completeness", () => {
    expect(SourceProvenanceSchema.parse(provenance)).toEqual(provenance);
    expect(CoverageCertificateSchema.parse(certificate)).toEqual(certificate);
    expect(() => CoverageCertificateSchema.parse({ ...certificate, partial: true })).toThrow();
    expect(() => CoverageCertificateSchema.parse({ ...certificate, completionState: "partial" })).toThrow();
    expect(() => SourceProvenanceSchema.parse({ ...provenance, stderr: "synthetic" })).toThrow();
  });

  it("разрешает absent только со ссылкой на certificate", () => {
    expect(
      CorrelationFactSchema.parse({
        state: "absent",
        reasonCode: "complete_empty",
        certificateId: certificate.certificateId,
      }).state,
    ).toBe("absent");
    expect(() =>
      CorrelationFactSchema.parse({ state: "absent", reasonCode: "complete_empty" }),
    ).toThrow();
    expect(() =>
      CorrelationFactSchema.parse({
        state: "unknown",
        reasonCode: "permission_denied",
        certificateId: certificate.certificateId,
      }),
    ).toThrow();
  });

  it("фиксирует immutable revision shape и privacy-safe external view", () => {
    const safeView = {
      schemaVersion: 1,
      findingId: "finding-synthetic-a",
      auditRevision: 1,
      correlationRevisionId: revision.correlationRevisionId,
      facts: {
        installedApp: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-installed" },
        activity: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-activity" },
        openFile: { state: "unknown", reasonCode: "permission_denied" },
        startupTarget: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-startup" },
        targetExecutable: { state: "present", reasonCode: "positive_relation" },
        receipt: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-receipt" },
        officialUninstaller: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-uninstaller" },
        dependency: { state: "absent", reasonCode: "complete_empty", certificateId: "certificate-dependency" },
      },
      coverageSummary: {
        completeSourceCount: 6,
        gapCount: 1,
        gapCodes: ["permission_denied"],
      },
      staleDuringAudit: false,
      blockingReasonCodes: ["coverage_incomplete"],
      allowedActions: ["inspect"],
    } as const;

    expect(CorrelationRevisionSchema.parse(revision)).toEqual(revision);
    expect(SafeCorrelationViewSchema.parse(safeView)).toEqual(safeView);
    expect(() =>
      SafeCorrelationViewSchema.parse({
        ...safeView,
        path: ["", "synthetic", "private"].join("/"),
      }),
    ).toThrow();
    expect(() => SafeCorrelationViewSchema.parse({ ...safeView, token: "synthetic-token" })).toThrow();
    expect(() =>
      SafeCorrelationViewSchema.parse({
        ...safeView,
        allowedActions: ["inspect", "prepare_move"],
      }),
    ).toThrow();
    expect(JSON.stringify(SafeCorrelationViewSchema.parse(safeView))).not.toMatch(
      /path|bundle|package|signing|inventory|token|secret|personal/i,
    );
  });
});

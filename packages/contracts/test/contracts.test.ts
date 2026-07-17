import { describe, expect, it } from "vitest";

import {
  AuditCancelInputSchema,
  AuditReportSchema,
  AuditResultsInputSchema,
  AuditRunSchema,
  AuditRunStateSchema,
  AuditStartInputSchema,
  DiskObservationSchema,
  StorageSummarySchema,
  ToolErrorSchema,
} from "../src/index.js";
import { completedAuditFixture, findingFixture } from "./fixtures.js";

describe("контракты аудита", () => {
  it("отклоняет неизвестные и path-поля во входах", () => {
    expect(() =>
      AuditStartInputSchema.parse({
        requestId: "request-1",
        profile: "application_remnants",
        path: "/synthetic/input",
      }),
    ).toThrow();
    expect(() =>
      AuditCancelInputSchema.parse({
        auditId: "audit-1",
        requestId: "request-2",
        path: "/synthetic/input",
      }),
    ).toThrow();
    expect(() =>
      AuditResultsInputSchema.parse({
        auditId: "audit-1",
        revision: 1,
        cursor: null,
        filters: {},
        shell: "synthetic-command",
      }),
    ).toThrow();
  });

  it("принимает канонические состояния и завершённую ревизию", () => {
    expect(AuditRunStateSchema.parse("cancelling")).toBe("cancelling");
    expect(AuditRunStateSchema.parse("cancelled")).toBe("cancelled");
    expect(AuditRunSchema.parse(completedAuditFixture).revision).toBe(1);
  });

  it("не делает отменённый отчёт actionable", () => {
    const cancelledAudit = {
      ...completedAuditFixture,
      state: "cancelled",
      revision: null,
      cancelRequestedAt: "2026-07-17T00:00:30.000Z",
    };
    const actionableFinding = findingFixture;

    expect(() =>
      AuditReportSchema.parse({ audit: cancelledAudit, findings: [actionableFinding] }),
    ).toThrow();
    expect(
      AuditReportSchema.parse({
        audit: cancelledAudit,
        findings: [
          {
            ...findingFixture,
            model: { ...findingFixture.model, allowedActions: [] },
          },
        ],
      }).audit.state,
    ).toBe("cancelled");
  });
});

describe("server-owned метрики и ошибки", () => {
  it("принимает только неотрицательные safe integers", () => {
    expect(
      StorageSummarySchema.parse({
        candidateLogicalBytes: 84,
        candidatePhysicalBytes: 42,
        quarantinePhysicalBytes: 10,
        purgedPhysicalBytes: 7,
        stateVersion: 3,
      }).purgedPhysicalBytes,
    ).toBe(7);
    expect(() =>
      StorageSummarySchema.parse({
        candidateLogicalBytes: -1,
        candidatePhysicalBytes: 0,
        quarantinePhysicalBytes: 0,
        purgedPhysicalBytes: 0,
        stateVersion: 0,
      }),
    ).toThrow();
    expect(
      DiskObservationSchema.parse({
        availableBytes: 1000,
        totalBytes: 2000,
        observedAt: "2026-07-17T00:00:00.000Z",
        source: "statfs",
      }).source,
    ).toBe("statfs");
  });

  it("отклоняет небезопасные details ошибки", () => {
    expect(() =>
      ToolErrorSchema.parse({
        errorCode: "INTERNAL_ERROR",
        severity: "fatal",
        scope: "server",
        message: "Ошибка обработки",
        recommendedAction: "Повторить безопасную проверку",
        retryable: false,
        correlationId: "correlation-1",
        details: [{ code: "RAW", message: "token=synthetic-secret" }],
      }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import {
  AuditCancelInputSchema,
  AuditStatusOutputSchema,
  DashboardOpenInputSchema,
  DashboardOpenOutputSchema,
  AuditReportSchema,
  AuditResultsInputSchema,
  AuditRunSchema,
  AuditRunStateSchema,
  AuditStartInputSchema,
  DiskObservationSchema,
  ModelSafeTextSchema,
  StorageSummarySchema,
  ToolErrorSchema,
} from "../src/index.js";
import { completedAuditFixture, findingFixture } from "./fixtures.js";

const syntheticMacHome = ["", "Users", "demo", "private"].join("/");
const syntheticWindowsHome = ["C:", "Users", "demo", "private"].join("\\");
const unsafeModelTexts = [
  `path:${syntheticMacHome}`,
  `file://${syntheticMacHome}`,
  `path=${syntheticWindowsHome}`,
  '{"token":"synthetic-token"}',
  '{"password":"synthetic-password"}',
  '{"secret":"synthetic-secret"}',
  '{"api_key":"synthetic-key"}',
  '{"subscription_url":"synthetic-url"}',
  "Authorization: Bearer synthetic-token",
];

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

  it("разрешает безопасный Dashboard до появления actionable revision", () => {
    expect(
      DashboardOpenInputSchema.parse({ auditId: "audit-live-1", revision: null }),
    ).toEqual({ auditId: "audit-live-1", revision: null });
    expect(() =>
      DashboardOpenInputSchema.parse({
        auditId: "audit-live-1",
        revision: null,
        path: "/synthetic/private",
      }),
    ).toThrow();

    const progress = {
      phase: "discovering_candidates",
      completedSteps: 0,
      totalSteps: 2,
      processedCandidates: 0,
      totalCandidates: 0,
    } as const;
    expect(
      AuditStatusOutputSchema.parse({
        auditId: "audit-live-1",
        state: "running",
        stateVersion: 1,
        progress,
        coverageWarningCodes: [],
      }).progress,
    ).toEqual(progress);
    expect(
      DashboardOpenOutputSchema.parse({
        auditId: "audit-live-1",
        revision: null,
        state: "running",
        stateVersion: 1,
        resourceUri: "ui://codex-mac-cleaner/dashboard-v2.html",
        storageSummary: {
          candidateLogicalBytes: 0,
          candidatePhysicalBytes: 0,
          quarantinePhysicalBytes: 0,
          purgedPhysicalBytes: 0,
          stateVersion: 0,
        },
        diskObservation: {
          availableBytes: 1,
          totalBytes: 1,
          observedAt: "2026-07-21T00:00:00.000Z",
          source: "statfs",
        },
        excludedCount: 0,
        findings: [],
      }).revision,
    ).toBeNull();
  });

  it.each([
    ["queued", null, null, null],
    ["running", "2026-07-17T00:00:00.000Z", null, null],
    [
      "cancelling",
      "2026-07-17T00:00:00.000Z",
      null,
      "2026-07-17T00:00:30.000Z",
    ],
    [
      "cancelled",
      "2026-07-17T00:00:00.000Z",
      "2026-07-17T00:01:00.000Z",
      "2026-07-17T00:00:30.000Z",
    ],
    [
      "failed",
      "2026-07-17T00:00:00.000Z",
      "2026-07-17T00:01:00.000Z",
      null,
    ],
  ] as const)(
    "%s отчёт запрещает любые allowedActions",
    (state, startedAt, finishedAt, cancelRequestedAt) => {
      const audit = {
        ...completedAuditFixture,
        state,
        startedAt,
        finishedAt,
        cancelRequestedAt,
        revision: null,
      };
      const findingWithAction = {
        ...findingFixture,
        model: { ...findingFixture.model, allowedActions: ["inspect"] },
      };

      expect(() =>
        AuditReportSchema.parse({ audit, findings: [findingWithAction] }),
      ).toThrow();
      expect(
        AuditReportSchema.parse({
          audit,
          findings: [
            {
              ...findingFixture,
              model: { ...findingFixture.model, allowedActions: [] },
            },
          ],
        }).audit.state,
      ).toBe(state);
    },
  );

  it.each(["completed", "completed_with_warnings"] as const)(
    "%s отчёт сохраняет разрешённые actions",
    (state) => {
      expect(
        AuditReportSchema.parse({
          audit: { ...completedAuditFixture, state },
          findings: [findingFixture],
        }).findings[0]?.model.allowedActions,
      ).toEqual(findingFixture.model.allowedActions);
    },
  );
});

describe("model-visible текст", () => {
  it.each(unsafeModelTexts)("fail closed отклоняет %j", (unsafeText) => {
    expect(() => ModelSafeTextSchema.parse(unsafeText)).toThrow();
  });

  it("сохраняет обычный безопасный русский текст", () => {
    expect(ModelSafeTextSchema.parse("Аудит завершён без предупреждений")).toBe(
      "Аудит завершён без предупреждений",
    );
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

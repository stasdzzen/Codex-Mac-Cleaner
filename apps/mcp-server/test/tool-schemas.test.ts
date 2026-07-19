import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  APP_VISIBLE_TOOL_DEFINITIONS,
  MODEL_VISIBLE_TOOL_DEFINITIONS,
  buildToolResult,
  createMcpServer,
} from "../src/server.js";

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

const expectedAnnotations = {
  audit_start: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  audit_status: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  audit_cancel: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  audit_results: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  dashboard_open: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  finding_inspect: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  finding_reveal: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  schedule_intent_get: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  schedule_intent_complete: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} as const;

describe("model-visible MCP skeleton", () => {
  const findingModel = {
    findingId: "finding-1",
    displayName: "Синтетический кэш",
    category: "cache",
    supportLevel: "candidate",
    logicalSize: 84,
    physicalSize: 42,
    label: "orphaned",
    confidence: "high",
    risk: "low",
    allowedActions: ["inspect"],
    safeMetadata: {
      format: "plist",
      parseStatus: "parsed",
      byteLength: 128,
      modifiedAt: "2026-07-17T00:00:00.000Z",
      sensitivityFlags: [],
    },
    blockingReasons: [],
  } as const;

  it("регистрирует все канонические model-visible tools с точными annotations", () => {
    expect(Object.keys(MODEL_VISIBLE_TOOL_DEFINITIONS)).toEqual([
      "audit_start",
      "audit_status",
      "audit_cancel",
      "audit_results",
      "dashboard_open",
      "finding_inspect",
      "finding_reveal",
      "schedule_intent_get",
      "schedule_intent_complete",
    ]);
    for (const [name, annotations] of Object.entries(expectedAnnotations)) {
      expect(MODEL_VISIBLE_TOOL_DEFINITIONS[name as keyof typeof expectedAnnotations].annotations).toEqual(
        annotations,
      );
    }
  });

  it("реальный SDK tools/list видит те же strict schemas", async () => {
    const server = createMcpServer({
      platform: "darwin",
      arch: "arm64",
      release: "26.0.0",
    });
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      const listed = await client.listTools();
      const modelTools = listed.tools.filter(
        (tool) =>
          (
            tool._meta as
              | { ui?: { visibility?: readonly string[] } }
              | undefined
          )?.ui?.visibility?.includes("app") !== true,
      );
      expect(modelTools.map((tool) => tool.name)).toEqual(
        Object.keys(MODEL_VISIBLE_TOOL_DEFINITIONS),
      );
      for (const tool of modelTools) {
        expect(tool.annotations).toEqual(
          expectedAnnotations[tool.name as keyof typeof expectedAnnotations],
        );
        expect(tool.inputSchema).toMatchObject({
          type: "object",
          additionalProperties: false,
        });
        expect(tool.outputSchema).toMatchObject({
          type: "object",
          additionalProperties: false,
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("audit_cancel принимает только auditId/requestId", () => {
    const schema = MODEL_VISIBLE_TOOL_DEFINITIONS.audit_cancel.inputSchema;
    expect(schema.parse({ auditId: "audit-1", requestId: "request-1" })).toEqual({
      auditId: "audit-1",
      requestId: "request-1",
    });
    for (const forbidden of ["path", "profile", "revision", "operationId"] as const) {
      expect(() =>
        schema.parse({
          auditId: "audit-1",
          requestId: "request-1",
          [forbidden]: "synthetic",
        }),
      ).toThrow();
    }
  });

  it("каждый tool имеет strict input и точный output schema", () => {
    for (const definition of Object.values(MODEL_VISIBLE_TOOL_DEFINITIONS)) {
      expect(definition.inputSchema).toBeDefined();
      expect(definition.outputSchema).toBeDefined();
      expect(() => definition.inputSchema.parse({ unknown: true })).toThrow();
      expect(() => definition.outputSchema.parse({ unknown: true })).toThrow();
    }
  });

  it("legacy previewToken field описан только как opaque action handle", () => {
    const inputHandle =
      APP_VISIBLE_TOOL_DEFINITIONS.quarantine_move.inputSchema.shape.previewToken;
    const outputHandle =
      APP_VISIBLE_TOOL_DEFINITIONS.quarantine_prepare_move.outputSchema.shape
        .previewToken;
    expect(inputHandle.description).toMatch(/opaque action handle/u);
    expect(outputHandle.description).toMatch(/opaque action handle/u);
    expect(inputHandle.description).toMatch(/core token server-only/u);
  });

  it("проверяет platform guard до создания server", () => {
    expect(() =>
      createMcpServer({ platform: "linux", arch: "arm64", release: "26.0.0" }),
    ).toThrow("UNSUPPORTED_PLATFORM");
    expect(
      createMcpServer({ platform: "darwin", arch: "arm64", release: "26.0.0" }),
    ).toBeDefined();
  });

  it("не допускает full path и secret-like values в content/structuredContent", () => {
    const safeOutput = {
      auditId: "audit-1",
      state: "queued",
      stateVersion: 1,
    };
    expect(
      buildToolResult("audit_start", safeOutput, "Аудит поставлен в очередь"),
    ).toMatchObject({ structuredContent: safeOutput });
    expect(() =>
      buildToolResult("audit_start", safeOutput, "Объект: /synthetic/private/file"),
    ).toThrow();
    expect(() =>
      buildToolResult("audit_start", { ...safeOutput, path: "/synthetic/private" }, "Готово"),
    ).toThrow();
    expect(() =>
      buildToolResult("audit_start", safeOutput, "token=synthetic-secret"),
    ).toThrow();
    expect(() =>
      buildToolResult("audit_start", safeOutput, "Готово", {
        widget: { canonicalPath: "/synthetic/token=synthetic-secret" },
      }),
    ).toThrow();
  });

  it.each(unsafeModelTexts)("отклоняет утечку %j во всех model-visible каналах", (unsafeText) => {
    expect(() =>
      buildToolResult(
        "audit_start",
        { auditId: "audit-1", state: "queued", stateVersion: 1 },
        unsafeText,
      ),
    ).toThrow();
    expect(() =>
      buildToolResult(
        "finding_inspect",
        {
          findingId: "finding-1",
          auditRevision: 1,
          stateVersion: 1,
          finding: findingModel,
          evidenceSummaries: [unsafeText],
          stale: false,
        },
        "Проверка завершена",
      ),
    ).toThrow();
  });

  it.each([
    '/synthetic/{"token":"synthetic-token"}',
    "/synthetic/Authorization: Bearer synthetic-token",
  ])("запрещает secret-like widget meta %j", (canonicalPath) => {
    expect(() =>
      buildToolResult(
        "audit_start",
        { auditId: "audit-1", state: "queued", stateVersion: 1 },
        "Аудит поставлен в очередь",
        { widget: { canonicalPath } },
      ),
    ).toThrow();
  });

  it.each([
    "rawConfig",
    "configValue",
    "personalInventory",
    "applicationInventory",
    "exclusionIdentities",
    "protectedDetails",
  ])("запрещает приватное поле widget meta %s", (privateField) => {
    expect(() =>
      buildToolResult(
        "audit_start",
        { auditId: "audit-1", state: "queued", stateVersion: 1 },
        "Аудит поставлен в очередь",
        { widget: { [privateField]: "synthetic-value" } },
      ),
    ).toThrow("PRIVATE_WIDGET_META_FIELD");
  });

  it("разрешает canonicalPath только в widget-only _meta", () => {
    const result = buildToolResult(
      "audit_start",
      { auditId: "audit-1", state: "queued", stateVersion: 1 },
      "Аудит поставлен в очередь",
      { widget: { canonicalPath: syntheticMacHome } },
    );

    expect(JSON.stringify(result.structuredContent)).not.toContain(syntheticMacHome);
    expect(result._meta).toEqual({
      widget: { canonicalPath: syntheticMacHome },
    });
  });
});

import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { RuntimeActionHandleRegistry } from "../src/runtime.js";

function moveBinding(secret: string, expiresAt: string) {
  return {
    action: "move" as const,
    uiSessionId: "ui-session-primary",
    findingId: "finding-primary",
    auditRevision: 7,
    secret,
    expiresAt,
  };
}

function entryBinding(
  action: "restore" | "purge",
  operationId: string,
  secret: string,
  expiresAt: string,
) {
  return {
    action,
    uiSessionId: "ui-session-primary",
    operationId,
    secret,
    expiresAt,
  };
}

describe("server-only preview token и opaque action handle", () => {
  it("возвращает отдельный handle, а core secret оставляет только в registry", () => {
    const secret = `core-preview-${randomUUID()}`;
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => "action-handle-primary",
    });

    const handle = registry.issue(
      moveBinding(secret, "2026-07-19T06:05:00.000Z"),
    );

    expect(handle === secret).toBe(false);
    const consumed = registry.consume(handle, {
      action: "move",
      uiSessionId: "ui-session-primary",
    });
    expect(consumed === secret).toBe(true);
  });

  it("fail-closed отклоняет forged и replayed handle", () => {
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => "action-handle-replay",
    });
    const expected = { action: "move" as const, uiSessionId: "ui-session-primary" };
    expect(() => registry.consume("action-handle-forged", expected)).toThrow(
      "ACTION_HANDLE_INVALID",
    );

    const handle = registry.issue(
      moveBinding(`core-preview-${randomUUID()}`, "2026-07-19T06:05:00.000Z"),
    );
    registry.consume(handle, expected);
    expect(() => registry.consume(handle, expected)).toThrow("ACTION_HANDLE_INVALID");
  });

  it("fail-closed отклоняет cross-action, cross-object и cross-session reuse", () => {
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => "action-handle-binding",
    });
    const handle = registry.issue(
      entryBinding(
        "restore",
        "operation-primary",
        `core-preview-${randomUUID()}`,
        "2026-07-19T06:05:00.000Z",
      ),
    );

    expect(() =>
      registry.consume(handle, {
        action: "purge",
        uiSessionId: "ui-session-primary",
        operationId: "operation-primary",
      }),
    ).toThrow("ACTION_HANDLE_BINDING_MISMATCH");
    expect(() =>
      registry.consume(handle, {
        action: "restore",
        uiSessionId: "ui-session-primary",
        operationId: "operation-secondary",
      }),
    ).toThrow("ACTION_HANDLE_BINDING_MISMATCH");
    expect(() =>
      registry.consume(handle, {
        action: "restore",
        uiSessionId: "ui-session-secondary",
        operationId: "operation-primary",
      }),
    ).toThrow("ACTION_HANDLE_BINDING_MISMATCH");
  });

  it("fail-closed отклоняет expired handle", () => {
    let now = Date.parse("2026-07-19T06:00:00.000Z");
    const registry = new RuntimeActionHandleRegistry({
      now: () => now,
      createHandle: () => "action-handle-expired",
    });
    const handle = registry.issue(
      entryBinding(
        "purge",
        "operation-expired",
        `core-preview-${randomUUID()}`,
        "2026-07-19T06:01:00.000Z",
      ),
    );
    now = Date.parse("2026-07-19T06:01:00.001Z");

    expect(() =>
      registry.consume(handle, {
        action: "purge",
        uiSessionId: "ui-session-primary",
        operationId: "operation-expired",
      }),
    ).toThrow("ACTION_HANDLE_EXPIRED");
  });
});

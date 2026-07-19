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
  it("возвращает отдельный handle, а core secret передаёт только внутреннему executor", async () => {
    const secret = `core-preview-${randomUUID()}`;
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => "action-handle-primary",
    });
    const handle = registry.issue(
      moveBinding(secret, "2026-07-19T06:05:00.000Z"),
    );

    expect(handle === secret).toBe(false);
    const result = await registry.execute(
      handle,
      {
        action: "move",
        uiSessionId: "ui-session-primary",
        operationId: "operation-primary",
      },
      async (resolvedSecret) => ({ accepted: resolvedSecret === secret }),
    );

    expect(result).toEqual({ accepted: true });
  });

  it("объединяет concurrent exact calls и кеширует successful replay", async () => {
    let releaseExecution: (() => void) | undefined;
    const executionGate = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    let executionCount = 0;
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => "action-handle-concurrent",
    });
    const handle = registry.issue(
      moveBinding(`core-preview-${randomUUID()}`, "2026-07-19T06:05:00.000Z"),
    );
    const expected = {
      action: "move" as const,
      uiSessionId: "ui-session-primary",
      operationId: "operation-concurrent",
    };
    const executor = async () => {
      executionCount += 1;
      await executionGate;
      return { stateVersion: 11, state: "moved" } as const;
    };

    const first = registry.execute(handle, expected, executor);
    const concurrent = registry.execute(handle, expected, executor);
    await Promise.resolve();
    expect(executionCount).toBe(1);
    releaseExecution?.();
    const [firstResult, concurrentResult] = await Promise.all([
      first,
      concurrent,
    ]);
    const replayedResult = await registry.execute(handle, expected, async () => {
      throw new Error("EXECUTOR_MUST_NOT_REPEAT");
    });

    expect(concurrentResult).toEqual(firstResult);
    expect(replayedResult).toEqual(firstResult);
    expect(executionCount).toBe(1);
  });

  it.each(["restore", "purge"] as const)(
    "возвращает cached result для exact %s replay без второго executor call",
    async (action) => {
      let executionCount = 0;
      const registry = new RuntimeActionHandleRegistry({
        now: () => Date.parse("2026-07-19T06:00:00.000Z"),
        createHandle: () => `action-handle-${action}`,
      });
      const handle = registry.issue(
        entryBinding(
          action,
          "operation-entry",
          `core-preview-${randomUUID()}`,
          "2026-07-19T06:05:00.000Z",
        ),
      );
      const expected = {
        action,
        uiSessionId: "ui-session-primary",
        operationId: "operation-entry",
      };
      const executor = async () => {
        executionCount += 1;
        return { stateVersion: 12, state: action };
      };

      const first = await registry.execute(handle, expected, executor);
      const replayed = await registry.execute(handle, expected, executor);

      expect(replayed).toEqual(first);
      expect(executionCount).toBe(1);
    },
  );

  it("возвращает successful exact replay после истечения preview expiry", async () => {
    let now = Date.parse("2026-07-19T06:00:00.000Z");
    let executionCount = 0;
    const registry = new RuntimeActionHandleRegistry({
      now: () => now,
      createHandle: () => "action-handle-successful-expiry",
    });
    const handle = registry.issue(
      entryBinding(
        "restore",
        "operation-successful-expiry",
        `core-preview-${randomUUID()}`,
        "2026-07-19T06:01:00.000Z",
      ),
    );
    const expected = {
      action: "restore" as const,
      uiSessionId: "ui-session-primary",
      operationId: "operation-successful-expiry",
    };
    const executor = async () => {
      executionCount += 1;
      return { stateVersion: 13, state: "restored" } as const;
    };
    const first = await registry.execute(handle, expected, executor);
    now = Date.parse("2026-07-19T06:01:00.001Z");

    const replayed = await registry.execute(handle, expected, executor);

    expect(replayed).toEqual(first);
    expect(executionCount).toBe(1);
  });

  it("привязывает move handle к первому operationId и блокирует другой handle", async () => {
    const handles = ["action-handle-first", "action-handle-second"];
    const registry = new RuntimeActionHandleRegistry({
      now: () => Date.parse("2026-07-19T06:00:00.000Z"),
      createHandle: () => handles.shift() ?? "action-handle-exhausted",
    });
    const firstHandle = registry.issue(
      moveBinding(`core-preview-${randomUUID()}`, "2026-07-19T06:05:00.000Z"),
    );
    const secondHandle = registry.issue(
      moveBinding(`core-preview-${randomUUID()}`, "2026-07-19T06:05:00.000Z"),
    );
    await registry.execute(
      firstHandle,
      {
        action: "move",
        uiSessionId: "ui-session-primary",
        operationId: "operation-bound",
      },
      async () => ({ state: "moved" as const }),
    );

    await expect(
      registry.execute(
        firstHandle,
        {
          action: "move",
          uiSessionId: "ui-session-primary",
          operationId: "operation-other",
        },
        async () => ({ state: "must-not-run" }),
      ),
    ).rejects.toThrow("ACTION_HANDLE_BINDING_MISMATCH");
    await expect(
      registry.execute(
        secondHandle,
        {
          action: "move",
          uiSessionId: "ui-session-primary",
          operationId: "operation-bound",
        },
        async () => ({ state: "must-not-run" }),
      ),
    ).rejects.toThrow("ACTION_HANDLE_OPERATION_CONFLICT");
  });

  it("fail-closed отклоняет forged, cross-action, cross-object и cross-session handle", async () => {
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
    const mustNotRun = async () => ({ state: "must-not-run" });

    await expect(
      registry.execute(
        "action-handle-forged",
        {
          action: "restore",
          uiSessionId: "ui-session-primary",
          operationId: "operation-primary",
        },
        mustNotRun,
      ),
    ).rejects.toThrow("ACTION_HANDLE_INVALID");
    await expect(
      registry.execute(
        handle,
        {
          action: "purge",
          uiSessionId: "ui-session-primary",
          operationId: "operation-primary",
        },
        mustNotRun,
      ),
    ).rejects.toThrow("ACTION_HANDLE_BINDING_MISMATCH");
    await expect(
      registry.execute(
        handle,
        {
          action: "restore",
          uiSessionId: "ui-session-primary",
          operationId: "operation-secondary",
        },
        mustNotRun,
      ),
    ).rejects.toThrow("ACTION_HANDLE_BINDING_MISMATCH");
    await expect(
      registry.execute(
        handle,
        {
          action: "restore",
          uiSessionId: "ui-session-secondary",
          operationId: "operation-primary",
        },
        mustNotRun,
      ),
    ).rejects.toThrow("ACTION_HANDLE_BINDING_MISMATCH");
  });

  it("после failed execution сохраняет fail-closed expiry semantics", async () => {
    let now = Date.parse("2026-07-19T06:00:00.000Z");
    let executionCount = 0;
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
    const expected = {
      action: "purge" as const,
      uiSessionId: "ui-session-primary",
      operationId: "operation-expired",
    };
    await expect(
      registry.execute(handle, expected, async () => {
        executionCount += 1;
        throw new Error("CORE_REJECTED");
      }),
    ).rejects.toThrow("CORE_REJECTED");
    now = Date.parse("2026-07-19T06:01:00.001Z");

    await expect(
      registry.execute(handle, expected, async () => {
        executionCount += 1;
        return { state: "must-not-run" };
      }),
    ).rejects.toThrow("ACTION_HANDLE_EXPIRED");
    expect(executionCount).toBe(1);
  });
});

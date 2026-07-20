import { describe, expect, it } from "vitest";

import {
  ScheduleIntentCompleteInputSchema,
  ScheduleIntentCoordinator,
} from "../../apps/mcp-server/src/tools/schedule.js";

describe("CMC-10: inert schedule compatibility skeleton v0.1", () => {
  it("schema отклоняет успешный host outcome и automation ID", () => {
    expect(
      ScheduleIntentCompleteInputSchema.safeParse({
        intentId: "intent-synthetic-1",
        requestId: "request-synthetic-1",
        outcome: "completed",
        automationId: "automation:v1:syntheticAutomationId123",
      }).success,
    ).toBe(false);
  });

  it("любая lifecycle-команда остаётся unavailable и не создаёт pending host action", async () => {
    let hostCalls = 0;
    const coordinator = new ScheduleIntentCoordinator({
      now: () => new Date("2026-07-20T00:00:00.000Z"),
      createId: () => "intent-synthetic-1",
      onHostAutomationCall: () => {
        hostCalls += 1;
      },
    });

    const result = await coordinator.request({
      requestId: "request-synthetic-1",
      action: "enable",
      dayOfMonth: 15,
      localTime: "10:30",
    });
    expect(result).toMatchObject({
      state: "capability_unavailable",
      requiresHostCapability: true,
    });
    expect(await coordinator.state({})).toEqual({
      enabled: false,
      dayOfMonth: null,
      localTime: null,
      nextRunAt: null,
      lastRunAt: null,
      capabilityState: "unavailable",
      pendingIntentId: null,
      stateVersion: 1,
    });
    expect(hostCalls).toBe(0);
  });
});

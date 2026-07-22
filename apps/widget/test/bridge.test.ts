import { afterEach, describe, expect, it, vi } from "vitest";

import { createStandaloneBridge } from "@/lib/bridge";

afterEach(() => {
  Reflect.deleteProperty(window, "openai");
});

describe("display-mode bridge", () => {
  it("не объявляет capability без host API", () => {
    expect(createStandaloneBridge().requestDisplayMode).toBeUndefined();
  });

  it("передаёт пользовательский запрос в документированный host API", async () => {
    const requestDisplayMode = vi.fn(async () => ({ mode: "fullscreen" }));
    Object.defineProperty(window, "openai", {
      configurable: true,
      value: { requestDisplayMode },
    });

    const bridge = createStandaloneBridge();
    await bridge.requestDisplayMode?.("fullscreen");

    expect(requestDisplayMode).toHaveBeenCalledTimes(1);
    expect(requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
  });
});

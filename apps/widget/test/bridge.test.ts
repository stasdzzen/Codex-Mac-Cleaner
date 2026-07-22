import { afterEach, describe, expect, it, vi } from "vitest";

import { createStandaloneBridge } from "@/lib/bridge";

afterEach(() => {
  Reflect.deleteProperty(window, "openai");
});

describe("display-mode bridge", () => {
  it("не объявляет capability без host API", () => {
    expect(createStandaloneBridge().requestDisplayMode).toBeUndefined();
    expect(createStandaloneBridge().openExternal).toBeUndefined();
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

  it("передаёт разрешённую внешнюю ссылку в host и отклоняет произвольную", async () => {
    const openExternal = vi.fn(async () => undefined);
    Object.defineProperty(window, "openai", {
      configurable: true,
      value: { openExternal },
    });

    const bridge = createStandaloneBridge();
    await bridge.openExternal?.("https://dzzen.com/support");

    expect(openExternal).toHaveBeenCalledWith({ href: "https://dzzen.com/support" });
    await expect(
      bridge.openExternal?.("https://example.invalid" as never),
    ).rejects.toThrow("EXTERNAL_URL_NOT_ALLOWED");
  });
});

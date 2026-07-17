import { describe, expect, it } from "vitest";

import { assertSupportedPlatform } from "../src/assert-supported-platform.js";

describe("assertSupportedPlatform", () => {
  it.each(["26.0.0", "27.1.0"])(
    "принимает darwin arm64 с release %s",
    (release) => {
      expect(() =>
        assertSupportedPlatform({ platform: "darwin", arch: "arm64", release }),
      ).not.toThrow();
    },
  );

  it("отклоняет архитектуру x64", () => {
    expect(() =>
      assertSupportedPlatform({ platform: "darwin", arch: "x64", release: "26.0.0" }),
    ).toThrow("UNSUPPORTED_ARCH");
  });

  it("отклоняет Linux", () => {
    expect(() =>
      assertSupportedPlatform({ platform: "linux", arch: "arm64", release: "26.0.0" }),
    ).toThrow("UNSUPPORTED_PLATFORM");
  });

  it("отклоняет macOS major 25", () => {
    expect(() =>
      assertSupportedPlatform({ platform: "darwin", arch: "arm64", release: "25.9.0" }),
    ).toThrow("UNSUPPORTED_MACOS");
  });

  it.each(["", "not-a-release", "26beta", "26..1"])(
    "fail-closed отклоняет некорректный release %j",
    (release) => {
      expect(() =>
        assertSupportedPlatform({ platform: "darwin", arch: "arm64", release }),
      ).toThrow("UNSUPPORTED_MACOS");
    },
  );
});

import { describe, expect, it } from "vitest";

import { formatBytes } from "@/lib/utils";

describe("formatBytes", () => {
  it.each([
    [0, "0 МБ"],
    [1, "< 0,01 МБ"],
    [9_999, "< 0,01 МБ"],
    [10_000, "0,01 МБ"],
    [1_500_000, "1,5 МБ"],
    [999_990_000, "999,99 МБ"],
    [1_000_000_000, "1 ГБ"],
    [1_250_000_000, "1,25 ГБ"],
  ] as const)("показывает %i байт как %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

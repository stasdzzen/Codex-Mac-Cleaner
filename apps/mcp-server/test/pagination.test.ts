import { describe, expect, it } from "vitest";

import {
  BoundedCursorPager,
  normalizeAuditFilters,
  type PaginationBinding,
} from "../src/runtime.js";

const binding: PaginationBinding = {
  auditId: "audit-synthetic-pagination",
  revision: 1,
  channel: "model",
  filterKey: "{}",
};

describe("ограниченная постраничная выдача", () => {
  it("нормализует порядок и повторы filters", () => {
    expect(
      normalizeAuditFilters({
        categories: ["log", "cache", "log"],
        supportLevels: ["analysis_only", "candidate", "analysis_only"],
        labels: ["unknown", "orphaned", "unknown"],
        risks: ["high", "low", "high"],
      }),
    ).toEqual({
      categories: ["cache", "log"],
      supportLevels: ["analysis_only", "candidate"],
      labels: ["orphaned", "unknown"],
      risks: ["high", "low"],
    });
  });

  it("выдаёт 2 767 объектов за 28 страниц без пропусков и дублей", () => {
    let nextId = 0;
    const pager = new BoundedCursorPager(() => `cursor-${++nextId}`);
    const source = Array.from({ length: 2_767 }, (_, index) => ({
      findingId: `finding-${index.toString().padStart(4, "0")}`,
      displayName: `Объект ${index}`,
    }));
    const received: typeof source = [];
    const sizes: number[] = [];
    let cursor: string | null = null;

    do {
      const page: {
        readonly findings: readonly (typeof source)[number][];
        readonly nextCursor: string | null;
      } = pager.page({
        items: source,
        cursor,
        binding,
        toOutput: (finding) => finding,
      });
      sizes.push(page.findings.length);
      received.push(...page.findings);
      expect(page.findings.length).toBeLessThanOrEqual(100);
      expect(
        Buffer.byteLength(JSON.stringify(page.findings), "utf8"),
      ).toBeLessThanOrEqual(512 * 1024);
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(sizes).toEqual([...Array.from({ length: 27 }, () => 100), 67]);
    expect(received).toEqual(source);
    expect(new Set(received.map(({ findingId }) => findingId)).size).toBe(2_767);
  });

  it("соблюдает лимит байтов и повторяет страницу идемпотентно", () => {
    let nextId = 0;
    const pager = new BoundedCursorPager(() => `cursor-${++nextId}`);
    const source = Array.from({ length: 200 }, (_, index) => ({
      findingId: `finding-${index}`,
      explanation: "x".repeat(10_000),
    }));

    const first = pager.page({
      items: source,
      cursor: null,
      binding,
      toOutput: (finding) => finding,
    });
    const repeatedFirst = pager.page({
      items: source,
      cursor: null,
      binding,
      toOutput: (finding) => finding,
    });

    expect(first.findings.length).toBeGreaterThan(0);
    expect(first.findings.length).toBeLessThan(100);
    expect(Buffer.byteLength(JSON.stringify(first.findings), "utf8")).toBeLessThanOrEqual(
      512 * 1024,
    );
    expect(repeatedFirst).toEqual(first);

    const second = pager.page({
      items: source,
      cursor: first.nextCursor,
      binding,
      toOutput: (finding) => finding,
    });
    const repeatedSecond = pager.page({
      items: source,
      cursor: first.nextCursor,
      binding,
      toOutput: (finding) => finding,
    });
    expect(repeatedSecond).toEqual(second);
  });

  it("учитывает скобки массива в лимите одиночной записи", () => {
    const pager = new BoundedCursorPager(() => "cursor-unused");
    const serializedAtLimit = "x".repeat(512 * 1024 - 2);
    expect(Buffer.byteLength(JSON.stringify(serializedAtLimit), "utf8")).toBe(
      512 * 1024,
    );
    expect(() =>
      pager.page({
        items: [serializedAtLimit],
        cursor: null,
        binding,
        toOutput: (value) => value,
      }),
    ).toThrow("INTERNAL_ERROR");
  });

  it("отклоняет подмену и повтор cursor в другом канале, аудите, ревизии или фильтре", () => {
    const pager = new BoundedCursorPager(() => "cursor-safe");
    const source = Array.from({ length: 101 }, (_, index) => index);
    const first = pager.page({
      items: source,
      cursor: null,
      binding,
      toOutput: (finding) => finding,
    });
    expect(first.nextCursor).toBe("cursor-safe");

    const invalidBindings: PaginationBinding[] = [
      { ...binding, auditId: "audit-other" },
      { ...binding, revision: 2 },
      { ...binding, channel: "dashboard" },
      { ...binding, filterKey: '{"risks":["high"]}' },
    ];
    for (const invalid of invalidBindings) {
      expect(() =>
        pager.page({
          items: source,
          cursor: first.nextCursor,
          binding: invalid,
          toOutput: (finding) => finding,
        }),
      ).toThrow("AUDIT_STALE");
    }
    expect(() =>
      pager.page({
        items: source,
        cursor: "cursor-forged",
        binding,
        toOutput: (finding) => finding,
      }),
    ).toThrow("AUDIT_STALE");
  });
});

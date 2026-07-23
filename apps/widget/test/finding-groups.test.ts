import { describe, expect, it } from "vitest";

import { groupDashboardFindings } from "@/lib/finding-groups";

import { dashboardFixture } from "./fixtures";

describe("группировка находок Dashboard", () => {
  it("объединяет кеши в одну строку и суммирует размеры/actionable count", () => {
    const cache = dashboardFixture.findings[0]!;
    const groups = groupDashboardFindings([
      cache,
      {
        ...cache,
        findingId: "finding-synthetic-cache-2",
        displayName: "Synthetic Cache 2",
        componentDisplayName: "Another Studio",
        logicalSize: 2_000,
        physicalSize: 1_000,
        allowedActions: ["inspect"],
      },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      groupId: "category:cache",
      title: "Кеши приложений",
      actionableCount: 1,
      logicalSize: cache.logicalSize + 2_000,
      physicalSize: cache.physicalSize + 1_000,
    });
    expect(groups[0]!.findings).toHaveLength(2);
  });

  it("объединяет остатки одного удалённого приложения отдельно от других групп", () => {
    const remnant = dashboardFixture.findings[2]!;
    const groups = groupDashboardFindings([
      remnant,
      {
        ...remnant,
        findingId: "finding-synthetic-helper-2",
        displayName: "Synthetic Shared Helper 2",
      },
      dashboardFixture.findings[1]!,
    ]);

    expect(groups.map(({ title }) => title)).toContain("Example Network Tool");
    expect(
      groups.find(({ title }) => title === "Example Network Tool")?.findings,
    ).toHaveLength(2);
  });
});

import type { DashboardFinding } from "@/lib/dashboard-types";

export interface DashboardFindingGroup {
  readonly groupId: string;
  readonly title: string;
  readonly description: string;
  readonly findings: readonly DashboardFinding[];
  readonly logicalSize: number;
  readonly physicalSize: number;
  readonly actionableCount: number;
}

function groupIdentity(finding: DashboardFinding): {
  readonly groupId: string;
  readonly title: string;
  readonly description: string;
} {
  if (finding.category === "cache") {
    return {
      groupId: "category:cache",
      title: "Кеши приложений",
      description: "Временные данные объединены в одну понятную группу.",
    };
  }
  if (finding.category === "log") {
    return {
      groupId: "category:log",
      title: "Журналы приложений",
      description: "Файлы журналов объединены в одну группу.",
    };
  }
  if (
    finding.findingFacts.mainBundleState === "absent" ||
    finding.label === "orphaned"
  ) {
    return {
      groupId: `removed-app:${finding.componentDisplayName}`,
      title: finding.componentDisplayName,
      description: "Остатки удалённого приложения.",
    };
  }
  return {
    groupId: `component:${finding.componentDisplayName}:${finding.category}`,
    title: finding.componentDisplayName,
    description: "Связанные файлы одного компонента.",
  };
}

export function groupDashboardFindings(
  findings: readonly DashboardFinding[],
): readonly DashboardFindingGroup[] {
  const groups = new Map<
    string,
    {
      title: string;
      description: string;
      findings: DashboardFinding[];
      logicalSize: number;
      physicalSize: number;
      actionableCount: number;
    }
  >();

  for (const finding of findings) {
    const identity = groupIdentity(finding);
    const current = groups.get(identity.groupId) ?? {
      title: identity.title,
      description: identity.description,
      findings: [],
      logicalSize: 0,
      physicalSize: 0,
      actionableCount: 0,
    };
    current.findings.push(finding);
    current.logicalSize += finding.logicalSize;
    current.physicalSize += finding.physicalSize;
    if (finding.allowedActions.includes("prepare_move")) {
      current.actionableCount += 1;
    }
    groups.set(identity.groupId, current);
  }

  return [...groups.entries()]
    .map(([groupId, group]) => ({
      groupId,
      ...group,
      findings: [...group.findings].sort(
        (left, right) =>
          right.physicalSize - left.physicalSize ||
          left.displayName.localeCompare(right.displayName, "ru"),
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.actionableCount > 0) - Number(left.actionableCount > 0) ||
        right.physicalSize - left.physicalSize ||
        left.title.localeCompare(right.title, "ru"),
    );
}

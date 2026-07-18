import { AlertTriangleIcon, FileSearchIcon } from "lucide-react";
import type { ReactElement } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DashboardFinding } from "@/lib/dashboard-types";
import { formatBytes } from "@/lib/utils";

interface FindingSheetProps {
  readonly finding: DashboardFinding | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function stateLine(label: string, value: string): ReactElement {
  return (
    <li>
      {label}: {value}
    </li>
  );
}

export function FindingSheet({ finding, open, onOpenChange }: FindingSheetProps) {
  if (finding === null) {
    return null;
  }

  const reasons = Array.from(
    new Set([...finding.blockingReasons, ...finding.findingFacts.blockingReasons]),
  );
  const flags = finding.findingFacts.sensitivityFlags;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{finding.displayName}</SheetTitle>
          <SheetDescription>
            FindingFacts, доказательства и server-owned решение текущей ревизии.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
          <section aria-labelledby="finding-facts-title" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileSearchIcon aria-hidden="true" />
              <h3 id="finding-facts-title" className="font-medium">
                FindingFacts
              </h3>
            </div>
            <ul className="flex list-none flex-col gap-1 p-0 text-sm">
              {stateLine("Компонент", finding.componentDisplayName)}
              {stateLine("Категория", finding.category)}
              {stateLine("Последнее наблюдение", finding.findingFacts.lastObservedAt)}
              {stateLine("Временная классификация", finding.findingFacts.temporalKind)}
              {stateLine("Состояние приложения", finding.findingFacts.mainBundleState)}
              {stateLine("Активность", finding.findingFacts.activityState)}
              {stateLine("Открытые файлы", finding.findingFacts.openFileState)}
              {stateLine(
                "Автозапуск",
                finding.findingFacts.startupKinds.length > 0
                  ? finding.findingFacts.startupKinds.join(", ")
                  : "не обнаружен",
              )}
              {stateLine("Target executable", finding.findingFacts.targetExecutableState)}
              {stateLine("Receipt", finding.findingFacts.receiptState)}
              {stateLine("Зависимости", finding.findingFacts.dependencyState)}
              {stateLine("Чувствительные данные", flags.length > 0 ? flags.join(", ") : "нет")}
              {stateLine("Метка", finding.label)}
              {stateLine("Уверенность", finding.confidence)}
              {stateLine("Риск", finding.risk)}
              {stateLine(
                "Рекомендуемый способ",
                finding.findingFacts.recommendedRemovalMethod,
              )}
            </ul>
          </section>

          <section aria-labelledby="reclaim-estimate-title" className="flex flex-col gap-2">
            <h3 id="reclaim-estimate-title" className="font-medium">
              ReclaimEstimate
            </h3>
            <p>
              Оценка освобождения: {formatBytes(finding.reclaimEstimate.estimatedPhysicalBytes)};
              уверенность: {finding.reclaimEstimate.confidence}; основа: {finding.reclaimEstimate.basis}.
            </p>
            <p>Оценка наблюдалась: {finding.reclaimEstimate.observedAt}</p>
            <p className="text-muted-foreground">
              Ограничения: {finding.reclaimEstimate.limitations.map((item) => item.replaceAll("_", " ")).join(", ")}.
              Это snapshot-оценка, а не обещание изменения свободного места.
            </p>
          </section>

          {reasons.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangleIcon aria-hidden="true" />
              <AlertTitle>Действие недоступно</AlertTitle>
              <AlertDescription>
                {reasons.map((reason) => (
                  <p key={reason}>Действие недоступно: {reason}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="evidence-title" className="flex flex-col gap-2">
            <h3 id="evidence-title" className="font-medium">
              Доказательства
            </h3>
            {finding.evidence.map((evidence) => (
              <div key={evidence.evidenceId} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{evidence.outcome}</Badge>
                  <span>{evidence.sourceAdapter}</span>
                </div>
                <p>{evidence.summary}</p>
                <p>Вход правила: {evidence.ruleInputType}</p>
                <p className="text-muted-foreground">{evidence.observedAt}</p>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

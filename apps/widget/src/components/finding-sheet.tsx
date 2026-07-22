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
import {
  blockingReasonLabel,
  categoryLabel,
  confidenceLabel,
  evidenceInputLabel,
  evidenceOutcomeLabel,
  evidenceSourceLabel,
  evidenceSummary,
  findingLabel,
  formatDateTime,
  presenceLabel,
  reclaimBasisLabel,
  reclaimLimitationLabel,
  removalMethodLabel,
  riskLabel,
  sensitivityLabel,
  startupKindLabel,
  temporalLabel,
} from "@/lib/presentation";
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
            Что проверено, почему объект найден и какое действие сейчас безопасно.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
          <section aria-labelledby="finding-facts-title" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FileSearchIcon aria-hidden="true" />
              <h3 id="finding-facts-title" className="font-medium">
                Что проверено
              </h3>
            </div>
            <ul className="flex list-none flex-col gap-1 p-0 text-sm">
              {stateLine("Компонент", finding.componentDisplayName)}
              {stateLine("Категория", categoryLabel(finding.category))}
              {stateLine("Проверено", formatDateTime(finding.findingFacts.lastObservedAt))}
              {stateLine("Актуальность", temporalLabel(finding.findingFacts.temporalKind))}
              {stateLine("Приложение-владелец", presenceLabel(finding.findingFacts.mainBundleState))}
              {stateLine("Активный процесс", presenceLabel(finding.findingFacts.activityState))}
              {stateLine("Открытые файлы", presenceLabel(finding.findingFacts.openFileState))}
              {stateLine(
                "Автозапуск",
                finding.findingFacts.startupKinds.length > 0
                  ? finding.findingFacts.startupKinds.map(startupKindLabel).join(", ")
                  : "не обнаружен",
              )}
              {stateLine("Исполняемый файл владельца", presenceLabel(finding.findingFacts.targetExecutableState))}
              {stateLine("Сведения установщика", presenceLabel(finding.findingFacts.receiptState))}
              {stateLine("Зависимости", presenceLabel(finding.findingFacts.dependencyState))}
              {stateLine("Чувствительные данные", flags.length > 0 ? flags.map(sensitivityLabel).join(", ") : "не обнаружены")}
              {stateLine("Что это", findingLabel(finding.label))}
              {stateLine("Насколько надёжен вывод", confidenceLabel(finding.confidence))}
              {stateLine("Риск", riskLabel(finding.risk))}
              {stateLine(
                "Рекомендуемый способ",
                removalMethodLabel(finding.findingFacts.recommendedRemovalMethod),
              )}
            </ul>
          </section>

          <section aria-labelledby="reclaim-estimate-title" className="flex flex-col gap-2">
            <h3 id="reclaim-estimate-title" className="font-medium">
              Оценка места на диске
            </h3>
            <p>
              Объект занимает примерно {formatBytes(finding.reclaimEstimate.estimatedPhysicalBytes)};
              уверенность оценки: {confidenceLabel(finding.reclaimEstimate.confidence)};
              основа: {reclaimBasisLabel(finding.reclaimEstimate.basis)}.
            </p>
            <p>Данные получены: {formatDateTime(finding.reclaimEstimate.observedAt)}</p>
            <p className="text-muted-foreground">
              Ограничения: {finding.reclaimEstimate.limitations.map(reclaimLimitationLabel).join(", ")}.
              Это оценка текущего состояния, а не обещание точного прироста свободного места.
            </p>
          </section>

          {reasons.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangleIcon aria-hidden="true" />
              <AlertTitle>Действие недоступно</AlertTitle>
              <AlertDescription>
                {reasons.map((reason) => (
                  <p key={reason}>Причина: {blockingReasonLabel(reason)}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <section aria-labelledby="evidence-title" className="flex flex-col gap-2">
            <h3 id="evidence-title" className="font-medium">
              Почему так решили
            </h3>
            {finding.evidence.map((evidence) => (
              <div key={evidence.evidenceId} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{evidenceOutcomeLabel(evidence.outcome)}</Badge>
                  <span>{evidenceSourceLabel(evidence.sourceAdapter)}</span>
                </div>
                <p>{evidenceSummary(evidence.ruleInputType)}</p>
                <p>Проверка: {evidenceInputLabel(evidence.ruleInputType)}</p>
                <p className="text-muted-foreground">{formatDateTime(evidence.observedAt)}</p>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

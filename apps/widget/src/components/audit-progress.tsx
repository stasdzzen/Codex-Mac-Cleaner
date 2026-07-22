import { BanIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSnapshot } from "@/lib/dashboard-types";

interface AuditProgressProps {
  readonly snapshot: DashboardSnapshot;
  readonly onCancel: () => void;
}

const PHASE_LABELS: Readonly<Record<DashboardSnapshot["progress"]["phase"], string>> = {
  queued: "Ожидание запуска",
  discovering_candidates: "Поиск возможных остатков приложений",
  collecting_global_evidence: "Проверка владельцев, процессов и установщика",
  correlating_candidates: "Проверка связей найденных объектов",
  finalizing: "Подготовка безопасного результата",
  completed: "Проверка завершена",
  cancelled: "Проверка отменена",
  failed: "Проверка остановлена с ошибкой",
};

export function AuditProgress({ snapshot, onCancel }: AuditProgressProps) {
  const { completedSteps, totalSteps } = snapshot.progress;
  const value = totalSteps === 0 ? 0 : (completedSteps / totalSteps) * 100;
  const isActive = snapshot.state === "running" || snapshot.state === "queued";
  const isCancelling = snapshot.state === "cancelling";
  const hasActiveMotion = isActive || isCancelling;

  return (
    <Card
      data-audit-active={hasActiveMotion ? "true" : "false"}
      aria-live={hasActiveMotion ? "polite" : "off"}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="audit-status-mark" aria-hidden="true" />
          Проверка остатков приложений
        </CardTitle>
        <CardDescription>
          Этап: {PHASE_LABELS[snapshot.progress.phase]}. Выполнено шагов: {completedSteps} из {totalSteps}.
        </CardDescription>
        {(isActive || isCancelling) && (
          <CardAction>
            <Button
              variant="outline"
              disabled={isCancelling}
              onClick={onCancel}
              aria-label={isCancelling ? "Проверка останавливается" : "Остановить проверку"}
            >
              {isCancelling ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <BanIcon data-icon="inline-start" />
              )}
              {isCancelling ? "Останавливаем" : "Остановить проверку"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Общий прогресс</p>
            <p className="audit-progress-value tabular-nums">{Math.round(value)}%</p>
          </div>
          {snapshot.progress.totalCandidates > 0 && (
            <p className="text-sm text-muted-foreground">
              Объектов проверено: {snapshot.progress.processedCandidates} из {snapshot.progress.totalCandidates}.
            </p>
          )}
        </div>
        {totalSteps === 0 ? (
          <Skeleton className="h-2 w-full" aria-label="Ожидание прогресса" />
        ) : (
          <Progress
            className="audit-progress-track h-2"
            value={value}
            aria-label={`Прогресс проверки: ${Math.round(value)}%`}
          />
        )}
      </CardContent>
    </Card>
  );
}

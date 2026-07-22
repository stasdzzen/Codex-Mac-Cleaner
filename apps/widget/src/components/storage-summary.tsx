import type { CSSProperties } from "react";
import { HardDriveIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardSnapshot } from "@/lib/dashboard-types";
import { formatDateTime } from "@/lib/presentation";
import { formatBytes } from "@/lib/utils";

interface StorageSummaryProps {
  readonly storageSummary: DashboardSnapshot["storageSummary"];
  readonly diskObservation: DashboardSnapshot["diskObservation"];
}

export function StorageSummary({
  storageSummary,
  diskObservation,
}: StorageSummaryProps) {
  const metrics = [
    {
      label: "Размер найденных файлов",
      value: storageSummary.candidateLogicalBytes,
      tone: "1",
    },
    {
      label: "Занимают на диске",
      value: storageSummary.candidatePhysicalBytes,
      tone: "2",
    },
    {
      label: "Хранится в карантине",
      value: storageSummary.quarantinePhysicalBytes,
      tone: "3",
    },
    {
      label: "Удалено из карантина",
      value: storageSummary.purgedPhysicalBytes,
      tone: "4",
    },
  ] as const;
  const maximumValue = Math.max(1, ...metrics.map(({ value }) => value));
  const comparisonLabel = `Относительное сравнение размеров: ${metrics
    .map(({ label, value }) => `${label} — ${formatBytes(value)}`)
    .join("; ")}.`;

  return (
    <section aria-labelledby="storage-summary-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HardDriveIcon aria-hidden="true" />
        <h2 id="storage-summary-title" className="text-base font-medium">
          Место на диске
        </h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(16rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Что занимает место</CardTitle>
            <CardDescription>
              Сравнение размеров по состоянию на момент проверки.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <figure role="img" aria-label={comparisonLabel} className="flex flex-col gap-4">
              <ul className="flex flex-col gap-4">
                {metrics.map(({ label, value, tone }) => {
                  const width = (value / maximumValue) * 100;
                  const style = {
                    "--storage-bar-width": `${width}%`,
                    "--storage-bar-min-width": value > 0 ? "0.35rem" : "0",
                  } as CSSProperties;
                  return (
                    <li key={label} data-storage-bar className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatBytes(value)}
                        </span>
                      </div>
                      <div className="storage-comparison-track" aria-hidden="true">
                        <span
                          className="storage-comparison-bar"
                          data-chart-tone={tone}
                          style={style}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <figcaption className="text-xs text-muted-foreground">
                Показатели не нужно складывать. APFS может хранить общие блоки, поэтому
                фактическое свободное место после удаления может измениться иначе.
              </figcaption>
            </figure>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Свободно на диске</CardTitle>
            <CardDescription>Текущее состояние диска Mac</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="audit-progress-value tabular-nums">
              {formatBytes(diskObservation.availableBytes)}
            </p>
            <p className="text-sm text-muted-foreground">
              Общий объём: {formatBytes(diskObservation.totalBytes)}
            </p>
          </CardContent>
          <CardFooter className="flex-col items-start gap-1 text-xs text-muted-foreground">
            <p>Проверено: {formatDateTime(diskObservation.observedAt)}</p>
            <p>Значение macOS может обновиться не сразу.</p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

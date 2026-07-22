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
      label: "Логический размер находок",
      value: storageSummary.candidateLogicalBytes,
      source: "Источник: StorageSummary",
      tone: "1",
    },
    {
      label: "Физический размер находок",
      value: storageSummary.candidatePhysicalBytes,
      source: "Источник: StorageSummary",
      tone: "2",
    },
    {
      label: "В карантине",
      value: storageSummary.quarantinePhysicalBytes,
      source: "Источник: StorageSummary",
      tone: "3",
    },
    {
      label: "Удалено навсегда",
      value: storageSummary.purgedPhysicalBytes,
      source: "Источник: append-only journal",
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
          Server-owned показатели
        </h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(16rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Сравнение snapshot</CardTitle>
            <CardDescription>
              Четыре независимые метрики в масштабе крупнейшего значения.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <figure role="img" aria-label={comparisonLabel} className="flex flex-col gap-4">
              <ul className="flex flex-col gap-4">
                {metrics.map(({ label, value, source, tone }) => {
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
                      <span className="text-xs text-muted-foreground">{source}</span>
                    </li>
                  );
                })}
              </ul>
              <figcaption className="text-xs text-muted-foreground">
                Шкала сравнивает значения отдельно: показатели не суммируются и не
                выражают изменение доступного объёма на APFS.
              </figcaption>
            </figure>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Свободно на диске</CardTitle>
            <CardDescription>Источник: DiskObservation</CardDescription>
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
            <p>Наблюдение диска: {diskObservation.observedAt}</p>
            <p>Источник: {diskObservation.source}</p>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

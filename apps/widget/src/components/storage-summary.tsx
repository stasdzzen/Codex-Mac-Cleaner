import { HardDriveIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
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
    ["Логический размер находок", storageSummary.candidateLogicalBytes, "Источник: StorageSummary"],
    ["Физический размер находок", storageSummary.candidatePhysicalBytes, "Источник: StorageSummary"],
    ["В карантине", storageSummary.quarantinePhysicalBytes, "Источник: StorageSummary"],
    ["Удалено навсегда", storageSummary.purgedPhysicalBytes, "Источник: append-only journal"],
    ["Свободно на диске", diskObservation.availableBytes, "Источник: DiskObservation"],
  ] as const;

  return (
    <section aria-labelledby="storage-summary-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HardDriveIcon aria-hidden="true" />
        <h2 id="storage-summary-title" className="text-base font-medium">
          Server-owned показатели
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, source]) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>{source}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium tabular-nums">{formatBytes(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p>Наблюдение диска: {diskObservation.observedAt}</p>
        <p>
          Источник: {diskObservation.source}. Значения показываются раздельно и не
          связываются причинно с последней операцией.
        </p>
      </div>
    </section>
  );
}

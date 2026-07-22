import {
  ArchiveRestoreIcon,
  LoaderCircleIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WidgetBridge } from "@/lib/bridge";
import type { QuarantineEntry } from "@/lib/dashboard-types";
import { formatDateTime, quarantineStateLabel } from "@/lib/presentation";
import { formatBytes } from "@/lib/utils";

interface QuarantineCenterProps {
  readonly entries: readonly QuarantineEntry[];
  readonly bridge: WidgetBridge;
}

interface PreviewResult {
  readonly previewToken: string;
}

function EntryActionDialog({
  entry,
  bridge,
  action,
}: {
  entry: QuarantineEntry;
  bridge: WidgetBridge;
  action: "restore" | "purge";
}) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const isPurge = action === "purge";

  async function prepareAction(): Promise<void> {
    setPreparing(true);
    setPreviewToken(null);
    try {
      const preview = await bridge.callTool<PreviewResult>(
        `quarantine_prepare_${action}`,
        { operationId: entry.entryId },
      );
      setPreviewToken(preview.previewToken);
    } catch {
      toast.error("Не удалось подготовить действие. Обновите состояние карантина.");
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  async function confirmAction(): Promise<void> {
    if (previewToken === null) {
      return;
    }
    try {
      await bridge.callTool(`quarantine_${action}`, {
        previewToken,
        operationId: entry.entryId,
      });
      toast.success(isPurge ? "Запись удалена навсегда." : "Восстановление запрошено.");
      setOpen(false);
    } catch {
      toast.error("Действие не выполнено. Обновите состояние карантина.");
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setPreviewToken(null);
          setPreparing(false);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant={isPurge ? "destructive" : "outline"}
            aria-label={`${isPurge ? "Удалить навсегда" : "Восстановить"}: ${entry.displayName}`}
            onClick={() => {
              void prepareAction();
            }}
          />
        }
      >
          {isPurge ? (
            <Trash2Icon data-icon="inline-start" />
          ) : (
            <ArchiveRestoreIcon data-icon="inline-start" />
          )}
          {isPurge ? "Удалить навсегда" : "Восстановить"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {isPurge ? (
              <ShieldAlertIcon aria-hidden="true" />
            ) : (
              <ArchiveRestoreIcon aria-hidden="true" />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isPurge ? "Удалить навсегда" : "Восстановить"}: {entry.displayName}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isPurge
              ? "Будет необратимо удалён только один объект из карантина. После подтверждения восстановить его нельзя."
              : "Будет восстановлен только этот объект. Если исходное место занято или изменилось, восстановление остановится без перезаписи файлов."}
            {preparing && " Проверяем состояние объекта перед подтверждением."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant={isPurge ? "destructive" : "default"}
            disabled={previewToken === null}
            onClick={() => {
              void confirmAction();
            }}
          >
            {preparing && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
            {isPurge ? "Удалить одну запись" : "Восстановить одну запись"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function QuarantineCenter({ entries, bridge }: QuarantineCenterProps) {
  if (entries.length === 0) {
    return (
      <Alert>
        <ArchiveRestoreIcon aria-hidden="true" />
        <AlertTitle>Карантин пуст</AlertTitle>
        <AlertDescription>Перемещённых объектов нет.</AlertDescription>
      </Alert>
    );
  }

  return (
    <section aria-labelledby="quarantine-center-title" className="flex flex-col gap-3">
      <div>
        <h2 id="quarantine-center-title" className="text-base font-medium">
          Карантин
        </h2>
        <p className="text-sm text-muted-foreground">
          Каждое действие относится только к одной записи и подтверждается отдельно.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {entries.map((entry) => (
          <Card key={entry.entryId}>
            <CardHeader>
              <CardTitle>{entry.displayName}</CardTitle>
              <CardDescription>Перемещено: {formatDateTime(entry.movedAt)}</CardDescription>
              <CardAction>
                <Badge variant="secondary">{quarantineStateLabel(entry.state)}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p>Занимает на диске: {formatBytes(entry.physicalBytes)}</p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <EntryActionDialog entry={entry} bridge={bridge} action="restore" />
              <EntryActionDialog entry={entry} bridge={bridge} action="purge" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

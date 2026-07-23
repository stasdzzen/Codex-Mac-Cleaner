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
  onComplete,
}: {
  entry: QuarantineEntry;
  bridge: WidgetBridge;
  action: "restore" | "purge";
  onComplete: (entryId: string) => void;
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
      toast.error("Не удалось проверить объект. Закройте окно и откройте карантин снова.");
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  async function confirmAction(): Promise<void> {
    if (previewToken === null) {
      return;
    }
    setPreparing(true);
    setPreviewToken(null);
    try {
      await bridge.callTool(`quarantine_${action}`, {
        previewToken,
        operationId: entry.entryId,
      });
      toast.success(isPurge ? "Объект удалён из карантина навсегда." : "Объект восстановлен.");
      onComplete(entry.entryId);
      setOpen(false);
    } catch {
      toast.error("Действие не выполнено. Закройте окно и откройте карантин снова.");
      setOpen(false);
    } finally {
      setPreparing(false);
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
            {isPurge ? "Удалить навсегда" : "Восстановить"} «{entry.displayName}»?
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
            {isPurge ? "Удалить этот объект" : "Восстановить этот объект"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SequentialPurgeDialog({
  entries,
  bridge,
  onComplete,
}: {
  readonly entries: readonly QuarantineEntry[];
  readonly bridge: WidgetBridge;
  readonly onComplete: (entryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [queue, setQueue] = useState<readonly QuarantineEntry[]>([]);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const current = queue[index];

  async function prepare(entry: QuarantineEntry): Promise<void> {
    setPreparing(true);
    setPreviewToken(null);
    try {
      const preview = await bridge.callTool<PreviewResult>(
        "quarantine_prepare_purge",
        { operationId: entry.entryId },
      );
      setPreviewToken(preview.previewToken);
    } catch {
      toast.error(
        "Не удалось проверить текущую запись. Уже удалённые записи не изменились.",
      );
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  async function confirmCurrent(): Promise<void> {
    if (current === undefined || previewToken === null) return;
    setPreparing(true);
    setPreviewToken(null);
    try {
      await bridge.callTool("quarantine_purge", {
        previewToken,
        operationId: current.entryId,
      });
      onComplete(current.entryId);
      const nextIndex = index + 1;
      const next = queue[nextIndex];
      if (next === undefined) {
        toast.success("Все подтверждённые записи удалены из карантина.");
        setOpen(false);
        return;
      }
      setIndex(nextIndex);
      await prepare(next);
    } catch {
      toast.error(
        "Текущая запись не удалена. Очистка остановлена, остальные записи сохранены.",
      );
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setIndex(0);
          setQueue([]);
          setPreviewToken(null);
          setPreparing(false);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            onClick={() => {
              const first = entries[0];
              if (first !== undefined) {
                setQueue(entries);
                setIndex(0);
                void prepare(first);
              }
            }}
          />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Очистить карантин
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ShieldAlertIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Очистить карантин: объект {index + 1} из {queue.length}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Каждая запись подтверждается отдельно. Сейчас будет необратимо удалён
            только «{current?.displayName ?? "объект"}». Закройте окно, чтобы
            остановить последовательность и сохранить остальные записи.
            {preparing && " Проверяем текущее состояние записи."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Остановить очистку</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={previewToken === null}
            onClick={(event) => {
              event.preventDefault();
              void confirmCurrent();
            }}
          >
            {preparing ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : null}
            Удалить этот объект
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function QuarantineCenter({ entries, bridge }: QuarantineCenterProps) {
  const [completedEntryIds, setCompletedEntryIds] = useState<readonly string[]>(
    [],
  );
  const visibleEntries = entries.filter(
    (entry) => !completedEntryIds.includes(entry.entryId),
  );
  const complete = (entryId: string) =>
    setCompletedEntryIds((current) =>
      Array.from(new Set([...current, entryId])),
    );

  if (visibleEntries.length === 0) {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="quarantine-center-title" className="text-base font-medium">
            Карантин
          </h2>
          <p className="text-sm text-muted-foreground">
            Каждое действие относится только к одной записи и подтверждается
            отдельно.
          </p>
        </div>
        <SequentialPurgeDialog
          entries={visibleEntries}
          bridge={bridge}
          onComplete={complete}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visibleEntries.map((entry) => (
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
              <EntryActionDialog
                entry={entry}
                bridge={bridge}
                action="restore"
                onComplete={complete}
              />
              <EntryActionDialog
                entry={entry}
                bridge={bridge}
                action="purge"
                onComplete={complete}
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

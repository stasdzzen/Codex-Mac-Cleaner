import { useState } from "react";
import { ArchiveRestoreIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import type { WidgetBridge } from "@/lib/bridge";
import { createRequestId } from "@/lib/bridge";
import type { DashboardFinding } from "@/lib/dashboard-types";
import { formatBytes } from "@/lib/utils";

interface MovePreview {
  readonly previewToken: string;
}

interface ActionDialogProps {
  readonly finding: DashboardFinding;
  readonly auditRevision: number;
  readonly bridge: WidgetBridge;
}

export function ActionDialog({ finding, auditRevision, bridge }: ActionDialogProps) {
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [open, setOpen] = useState(false);

  async function prepareMove(): Promise<void> {
    setPreparing(true);
    setPreviewToken(null);
    try {
      const preview = await bridge.callTool<MovePreview>("quarantine_prepare_move", {
        findingId: finding.findingId,
        auditRevision,
      });
      setPreviewToken(preview.previewToken);
    } catch {
      toast.error("Не удалось подготовить безопасное перемещение.");
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  async function confirmMove(): Promise<void> {
    if (previewToken === null) {
      return;
    }
    try {
      await bridge.callTool("quarantine_move", {
        previewToken,
        operationId: createRequestId("move"),
      });
      toast.success("Объект перемещён в карантин.");
      setOpen(false);
    } catch {
      toast.error("Перемещение не выполнено. Обновите ревизию и повторите проверку.");
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
            variant="destructive"
            onClick={() => {
              void prepareMove();
            }}
          />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ArchiveRestoreIcon aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Переместить в карантин: {finding.displayName}</AlertDialogTitle>
          <AlertDialogDescription
            render={<div className="flex flex-col gap-2" />}
          >
              <p>
                Будет перемещён в карантин ровно один объект. Это не прямое удаление исходника.
              </p>
              <p>
                Оценка physical size: {formatBytes(finding.reclaimEstimate.estimatedPhysicalBytes)}.
                Риск: {finding.risk}.
              </p>
              <p>Объект можно восстановить в исходное место, если оно остаётся свободным.</p>
              {preparing && <p>Сервер повторно проверяет policy и fingerprint…</p>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={previewToken === null}
            onClick={() => {
              void confirmMove();
            }}
          >
            {preparing && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
            Переместить один объект
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

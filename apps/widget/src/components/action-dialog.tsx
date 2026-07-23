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
import { riskLabel } from "@/lib/presentation";
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
    setPreparing(true);
    setPreviewToken(null);
    try {
      await bridge.callTool("quarantine_move", {
        previewToken,
        operationId: createRequestId("move"),
      });
      toast.success("Объект перемещён в карантин.");
      setOpen(false);
    } catch {
      toast.error("Объект изменился после проверки. Запустите проверку ещё раз.");
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
            variant="destructive"
            aria-label={`Удалить: ${finding.displayName}`}
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
          <AlertDialogTitle>Удалить «{finding.displayName}»?</AlertDialogTitle>
          <AlertDialogDescription
            render={<div className="flex flex-col gap-2" />}
          >
              <p>
                Ровно один объект будет безопасно перемещён в карантин, а не удалён
                напрямую.
              </p>
              <p>
                Занимает на диске примерно {formatBytes(finding.reclaimEstimate.estimatedPhysicalBytes)}.
                Риск: {riskLabel(finding.risk)}.
              </p>
              <p>Объект можно восстановить в исходное место, если оно остаётся свободным.</p>
              {preparing && <p>Проверяем, что объект не изменился и его безопасно переместить…</p>}
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
            Переместить в карантин
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

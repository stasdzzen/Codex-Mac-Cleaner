import { useEffect, useMemo, useRef, useState } from "react";
import {
  BanIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  EyeIcon,
  ListFilterIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  PictureInPicture2Icon,
  ShieldCheckIcon,
  SkipForwardIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ActionDialog } from "@/components/action-dialog";
import { AuditProgress } from "@/components/audit-progress";
import { ExclusionsTab } from "@/components/exclusions-tab";
import { FindingSheet } from "@/components/finding-sheet";
import { QuarantineCenter } from "@/components/quarantine-center";
import { StorageSummary } from "@/components/storage-summary";
import { SupportLevel } from "@/components/support-level";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  acceptSnapshot,
  createRequestId,
  type DashboardTab,
  type WidgetBridge,
  type WidgetDisplayMode,
  type WidgetViewState,
} from "@/lib/bridge";
import type { DashboardFinding, DashboardSnapshot } from "@/lib/dashboard-types";
import { formatBytes } from "@/lib/utils";

interface AuditDashboardProps {
  readonly snapshot: DashboardSnapshot;
  readonly bridge: WidgetBridge;
}

const INITIAL_VIEW_STATE: WidgetViewState = {
  activeTab: "overview",
  filter: "",
  selectedFindingId: null,
  selectedQuarantineEntryId: null,
  panel: "none",
  skippedFindingIds: [],
};

const TAB_LABELS: ReadonlyArray<{ value: DashboardTab; label: string }> = [
  { value: "overview", label: "Обзор" },
  { value: "findings", label: "Находки" },
  { value: "quarantine", label: "Карантин" },
  { value: "exclusions", label: "Исключения" },
  { value: "schedule", label: "Расписание" },
];

function revisionKey(snapshot: DashboardSnapshot): string {
  return `${snapshot.auditId}:${snapshot.revision ?? "partial"}`;
}

export function AuditDashboard({ snapshot, bridge }: AuditDashboardProps) {
  const [acceptedSnapshot, setAcceptedSnapshot] = useState(snapshot);
  const [viewState, setViewState] = useState<WidgetViewState>(INITIAL_VIEW_STATE);
  const [exclusionRefreshKey, setExclusionRefreshKey] = useState(0);
  const [pendingDisplayMode, setPendingDisplayMode] =
    useState<WidgetDisplayMode | null>(null);
  const previousRevisionKey = useRef(revisionKey(snapshot));
  const tabRefs = useRef(new Map<DashboardTab, HTMLButtonElement>());

  useEffect(() => {
    setAcceptedSnapshot((current) =>
      acceptSnapshot(current.stateVersion, snapshot.stateVersion) ? snapshot : current,
    );
  }, [snapshot]);

  useEffect(() => {
    if (
      acceptedSnapshot.state !== "queued" &&
      acceptedSnapshot.state !== "running" &&
      acceptedSnapshot.state !== "cancelling"
    ) {
      return;
    }
    let stopped = false;
    let requestInFlight = false;
    const refresh = async (): Promise<void> => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const status = await bridge.callTool<{
          auditId: string;
          state: DashboardSnapshot["state"];
          stateVersion: number;
          progress: DashboardSnapshot["progress"];
          coverageWarningCodes: readonly string[];
        }>("audit_status", { auditId: acceptedSnapshot.auditId });
        if (stopped || status.auditId !== acceptedSnapshot.auditId) return;
        setAcceptedSnapshot((current) => {
          if (
            current.auditId !== status.auditId ||
            !acceptSnapshot(current.stateVersion, status.stateVersion)
          ) {
            return current;
          }
          return {
            ...current,
            state: status.state,
            stateVersion: status.stateVersion,
            progress: status.progress,
            coverage:
              status.coverageWarningCodes.length === 0
                ? current.coverage
                : {
                    ...current.coverage,
                    warnings: status.coverageWarningCodes.map(
                      (code) => `Источник проверен не полностью: ${code}.`,
                    ),
                  },
          };
        });
      } catch {
        // Начальный snapshot остаётся видимым; следующий polling tick повторит запрос.
      } finally {
        requestInFlight = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [acceptedSnapshot.auditId, acceptedSnapshot.state, bridge]);

  useEffect(() => {
    const nextRevisionKey = revisionKey(acceptedSnapshot);
    if (previousRevisionKey.current === nextRevisionKey) {
      return;
    }
    previousRevisionKey.current = nextRevisionKey;
    setViewState((current) => {
      const reset: WidgetViewState = {
        ...current,
        selectedFindingId: null,
        selectedQuarantineEntryId: null,
        panel: "none",
        skippedFindingIds: [],
      };
      bridge.setViewState(reset);
      return reset;
    });
  }, [acceptedSnapshot, bridge]);

  const visibleFindings = useMemo(
    () =>
      acceptedSnapshot.findings.filter(
        (finding) => !viewState.skippedFindingIds.includes(finding.findingId),
      ),
    [acceptedSnapshot.findings, viewState.skippedFindingIds],
  );
  const selectedFinding =
    acceptedSnapshot.findings.find(
      (finding) => finding.findingId === viewState.selectedFindingId,
    ) ?? null;
  const isActionableRevision =
    acceptedSnapshot.revision !== null &&
    (acceptedSnapshot.state === "completed" ||
      acceptedSnapshot.state === "completed_with_warnings");

  function commitViewState(update: (current: WidgetViewState) => WidgetViewState): void {
    setViewState((current) => {
      const next = update(current);
      bridge.setViewState(next);
      return next;
    });
  }

  function selectTab(activeTab: DashboardTab): void {
    commitViewState((current) => ({ ...current, activeTab }));
  }

  function inspectFinding(finding: DashboardFinding): void {
    commitViewState((current) => ({
      ...current,
      selectedFindingId: finding.findingId,
      panel: "evidence",
    }));
  }

  function skipFinding(finding: DashboardFinding): void {
    commitViewState((current) => ({
      ...current,
      selectedFindingId: null,
      panel: "none",
      skippedFindingIds: Array.from(
        new Set([...current.skippedFindingIds, finding.findingId]),
      ),
    }));
    toast("Находка скрыта только до следующей ревизии аудита.");
  }

  async function cancelAudit(): Promise<void> {
    try {
      await bridge.callTool("audit_cancel", {
        auditId: acceptedSnapshot.auditId,
        requestId: createRequestId("cancel"),
      });
    } catch {
      toast.error("Запрос отмены не принят. Обновите состояние аудита.");
    }
  }

  async function startManualAudit(): Promise<void> {
    try {
      await bridge.callTool("audit_start", {
        requestId: createRequestId("manual-audit"),
        profile: "application_remnants",
      });
      toast.success("Ручной read-only аудит запущен.");
    } catch {
      toast.error("Не удалось запустить ручной read-only аудит.");
    }
  }

  async function excludeFinding(finding: DashboardFinding): Promise<void> {
    if (acceptedSnapshot.revision === null) return;
    await bridge.callTool("exclusion_create", {
      findingId: finding.findingId,
      auditRevision: acceptedSnapshot.revision,
      requestId: createRequestId("exclusion-create"),
      reasonCategory: "user_choice",
    });
    commitViewState((current) => ({
      ...current,
      skippedFindingIds: Array.from(
        new Set([...current.skippedFindingIds, finding.findingId]),
      ),
    }));
    setExclusionRefreshKey((current) => current + 1);
  }

  async function requestDisplayMode(mode: "fullscreen" | "pip"): Promise<void> {
    if (bridge.requestDisplayMode === undefined) {
      toast.error(
        "Эта версия Codex не поддерживает переключение режима. Dashboard остаётся в чате.",
      );
      return;
    }
    setPendingDisplayMode(mode);
    try {
      await bridge.requestDisplayMode(mode);
    } catch {
      toast.error(
        mode === "pip"
          ? "Codex не открыл мини-окно. Dashboard остаётся в текущем режиме."
          : "Codex не развернул Dashboard. Он остаётся в текущем режиме.",
      );
    } finally {
      setPendingDisplayMode(null);
    }
  }

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Codex Mac Cleaner</p>
            <h1 className="text-2xl font-semibold tracking-tight">Audit Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pendingDisplayMode !== null}
              onClick={() => void requestDisplayMode("fullscreen")}
            >
              {pendingDisplayMode === "fullscreen" ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
              ) : (
                <Maximize2Icon data-icon="inline-start" />
              )}
              Развернуть
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pendingDisplayMode !== null}
              onClick={() => void requestDisplayMode("pip")}
            >
              {pendingDisplayMode === "pip" ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
              ) : (
                <PictureInPicture2Icon data-icon="inline-start" />
              )}
              Мини-окно
            </Button>
            <Badge variant="outline">stateVersion: {acceptedSnapshot.stateVersion}</Badge>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Локальный read-only аудит. Решения, policy и показатели приходят с сервера;
          интерфейс только показывает их и собирает поэлементные подтверждения.
        </p>
      </header>

      {acceptedSnapshot.state === "failed" ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Аудит остановлен</AlertTitle>
          <AlertDescription>
            Проверка завершилась с безопасной ошибкой. Файлы не изменялись, а действия
            над находками недоступны. Запустите новый аудит.
          </AlertDescription>
        </Alert>
      ) : acceptedSnapshot.state === "cancelled" ? (
        <Alert variant="destructive">
          <BanIcon aria-hidden="true" />
          <AlertTitle>Аудит отменён</AlertTitle>
          <AlertDescription>
            Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно.
            Начните новый аудит.
          </AlertDescription>
        </Alert>
      ) : (
        acceptedSnapshot.coverage.warnings.map((warning) => (
          <Alert key={warning}>
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Часть областей не проверена</AlertTitle>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))
      )}

      <Tabs
        value={viewState.activeTab}
        onValueChange={(value) => {
          selectTab(value as DashboardTab);
        }}
      >
        <TabsList className="max-w-full overflow-x-auto" aria-label="Разделы Audit Dashboard">
          {TAB_LABELS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              ref={(node) => {
                if (node === null) {
                  tabRefs.current.delete(tab.value);
                } else {
                  tabRefs.current.set(tab.value, node);
                }
              }}
              onClick={() => selectTab(tab.value)}
              onKeyDown={(event) => {
                const index = TAB_LABELS.findIndex((item) => item.value === tab.value);
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % TAB_LABELS.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + TAB_LABELS.length) % TAB_LABELS.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = TAB_LABELS.length - 1;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextTab = TAB_LABELS[nextIndex];
                if (nextTab === undefined) return;
                selectTab(nextTab.value);
                tabRefs.current.get(nextTab.value)?.focus();
              }}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-5">
          <AuditProgress snapshot={acceptedSnapshot} onCancel={() => void cancelAudit()} />
          <StorageSummary
            storageSummary={acceptedSnapshot.storageSummary}
            diskObservation={acceptedSnapshot.diskObservation}
          />
          <Card>
            <CardHeader>
              <CardTitle>Краткая сводка находок</CardTitle>
              <CardDescription>
                Найдено: {acceptedSnapshot.findings.length}; исключено: {acceptedSnapshot.excludedCount}; проверено источников: {acceptedSnapshot.coverage.checkedSourceCount};
                пропущено: {acceptedSnapshot.coverage.skippedSourceCount}.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {acceptedSnapshot.findings.map((finding) => (
                <Badge key={finding.findingId} variant="secondary">
                  {finding.displayName}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="flex flex-col gap-4">
          <FindingsTable
            findings={visibleFindings}
            revision={acceptedSnapshot.revision}
            actionable={isActionableRevision}
            bridge={bridge}
            onInspect={inspectFinding}
            onExclude={excludeFinding}
            onSkip={skipFinding}
          />
        </TabsContent>

        <TabsContent value="quarantine">
          <QuarantineCenter entries={acceptedSnapshot.quarantineEntries} bridge={bridge} />
        </TabsContent>

        <TabsContent value="exclusions">
          <ExclusionsTab bridge={bridge} refreshKey={exclusionRefreshKey} />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleFallbackCard onManualRun={startManualAudit} />
        </TabsContent>
      </Tabs>

      <FindingSheet
        finding={selectedFinding}
        open={viewState.panel === "evidence" && selectedFinding !== null}
        onOpenChange={(open) => {
          if (!open) {
            commitViewState((current) => ({
              ...current,
              selectedFindingId: null,
              panel: "none",
            }));
          }
        }}
      />
      </main>
    </TooltipProvider>
  );
}

interface FindingsTableProps {
  readonly findings: readonly DashboardFinding[];
  readonly revision: number | null;
  readonly actionable: boolean;
  readonly bridge: WidgetBridge;
  readonly onInspect: (finding: DashboardFinding) => void;
  readonly onExclude: (finding: DashboardFinding) => Promise<void>;
  readonly onSkip: (finding: DashboardFinding) => void;
}

function FindingsTable({
  findings,
  revision,
  actionable,
  bridge,
  onInspect,
  onExclude,
  onSkip,
}: FindingsTableProps) {
  if (findings.length === 0) {
    return (
      <Alert>
        <ListFilterIcon aria-hidden="true" />
        <AlertTitle>Нет видимых находок</AlertTitle>
        <AlertDescription>
          Находки могут отсутствовать в snapshot или быть пропущены для текущей ревизии.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Находки текущей ревизии</CardTitle>
        <CardDescription>
          Risk, coverage и состояние действия всегда продублированы текстом.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Объект</TableHead>
              <TableHead>Классификация</TableHead>
              <TableHead>Размер</TableHead>
              <TableHead>Состояние действия</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => {
              const canMove =
                actionable &&
                revision !== null &&
                finding.allowedActions.includes("prepare_move");
              const canSkip = actionable && revision !== null;
              const canExclude =
                actionable &&
                revision !== null &&
                finding.allowedActions.includes("exclude");
              const reasons = Array.from(
                new Set([
                  ...finding.blockingReasons,
                  ...finding.findingFacts.blockingReasons,
                ]),
              );

              return (
                <TableRow key={finding.findingId}>
                  <TableCell>
                    <div className="flex min-w-52 flex-col gap-1 whitespace-normal">
                      <span className="font-medium">{finding.displayName}</span>
                      <span className="text-muted-foreground">{finding.componentDisplayName}</span>
                      <SupportLevel level={finding.supportLevel} />
                      {finding.supportLevel === "unsupported_manual" && (
                        <span className="text-muted-foreground">Требует расширенного режима</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 whitespace-normal">
                      <span>Метка: {finding.label}</span>
                      <span>Уверенность: {finding.confidence}</span>
                      <span>Риск: {finding.risk}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>Logical: {formatBytes(finding.logicalSize)}</span>
                      <span>Physical: {formatBytes(finding.physicalSize)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canMove ? (
                      <span>Доступно: перемещение одного объекта в карантин</span>
                    ) : reasons.length > 0 ? (
                      <span>Действие недоступно: {reasons.join(", ")}</span>
                    ) : (
                      <span>Filesystem mutation недоступна</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-56 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        aria-label={`Подробнее: ${finding.displayName}`}
                        onClick={() => onInspect(finding)}
                      >
                        <EyeIcon data-icon="inline-start" />
                        Подробнее
                      </Button>
                      {canMove && revision !== null && (
                        <ActionDialog
                          finding={finding}
                          auditRevision={revision}
                          bridge={bridge}
                        />
                      )}
                      {canExclude && (
                        <ExclusionAction finding={finding} onExclude={onExclude} />
                      )}
                      {canSkip && finding.supportLevel === "candidate" && (
                        <Button variant="ghost" onClick={() => onSkip(finding)}>
                          <SkipForwardIcon data-icon="inline-start" />
                          Пропустить сейчас
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExclusionAction({
  finding,
  onExclude,
}: {
  readonly finding: DashboardFinding;
  readonly onExclude: (finding: DashboardFinding) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      aria-label={`Исключить: ${finding.displayName}`}
      onClick={() => {
        setPending(true);
        void onExclude(finding)
          .then(() => toast.success("Находка добавлена в постоянные исключения."))
          .catch(() => toast.error("Не удалось сохранить исключение."))
          .finally(() => setPending(false));
      }}
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <ShieldCheckIcon data-icon="inline-start" />
      )}
      Исключить
    </Button>
  );
}

interface ScheduleFallbackCardProps {
  readonly onManualRun: () => Promise<void>;
}

function ScheduleFallbackCard({ onManualRun }: ScheduleFallbackCardProps) {
  const [pending, setPending] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Автоматическое расписание недоступно</CardTitle>
        <CardDescription>
          Автоматическое расписание недоступно в v0.1. Запустите обычный read-only
          аудит вручную.
        </CardDescription>
        <CardAction>
          <CalendarClockIcon aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">disabled v0.1</Badge>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void onManualRun().finally(() => setPending(false));
          }}
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            <CalendarClockIcon data-icon="inline-start" />
          )}
          Запустить аудит вручную
        </Button>
      </CardContent>
    </Card>
  );
}

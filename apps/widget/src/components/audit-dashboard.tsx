import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  BanIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  Code2Icon,
  EyeIcon,
  HeartHandshakeIcon,
  ListFilterIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  MessageSquarePlusIcon,
  Minimize2Icon,
  ShieldCheckIcon,
  SkipForwardIcon,
} from "lucide-react";
import { toast } from "sonner";

import pluginIconUrl from "@/assets/codex-mac-cleaner-icon.png?inline";
import {
  ActionDialog,
  type MoveResult,
} from "@/components/action-dialog";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  acceptSnapshot,
  createRequestId,
  type DashboardTab,
  type WidgetDisplayMode,
  type WidgetBridge,
  type WidgetViewState,
} from "@/lib/bridge";
import type { DashboardFinding, DashboardSnapshot } from "@/lib/dashboard-types";
import {
  groupDashboardFindings,
  type DashboardFindingGroup,
} from "@/lib/finding-groups";
import { PROJECT_LINKS, type WidgetExternalUrl } from "@/lib/project-links";
import {
  blockingReasonLabel,
  confidenceLabel,
  findingLabel,
  riskLabel,
} from "@/lib/presentation";
import { formatBytes } from "@/lib/utils";

interface AuditDashboardProps {
  readonly snapshot: DashboardSnapshot;
  readonly bridge: WidgetBridge;
}

const INITIAL_VIEW_STATE: WidgetViewState = {
  activeTab: "overview",
  selectedFindingId: null,
  panel: "none",
  skippedFindingIds: [],
};

const TAB_LABELS: ReadonlyArray<{ value: DashboardTab; label: string }> = [
  { value: "overview", label: "Обзор" },
  { value: "quarantine", label: "Карантин" },
  { value: "exclusions", label: "Оставленные" },
  { value: "schedule", label: "Автопроверка" },
];

function revisionKey(snapshot: DashboardSnapshot): string {
  return `${snapshot.auditId}:${snapshot.revision ?? "partial"}`;
}

export function AuditDashboard({ snapshot, bridge }: AuditDashboardProps) {
  const [acceptedSnapshot, setAcceptedSnapshot] = useState(snapshot);
  const [viewState, setViewState] = useState<WidgetViewState>(INITIAL_VIEW_STATE);
  const [exclusionRefreshKey, setExclusionRefreshKey] = useState(0);
  const [pagePending, setPagePending] = useState(false);
  const [isFullscreenPending, setFullscreenPending] = useState(false);
  const [displayMode, setDisplayMode] = useState<WidgetDisplayMode>(
    () => bridge.getDisplayMode?.() ?? "inline",
  );
  const previousRevisionKey = useRef(revisionKey(snapshot));
  const tabRefs = useRef(new Map<DashboardTab, HTMLButtonElement>());

  useEffect(() => {
    setAcceptedSnapshot((current) => {
      if (!acceptSnapshot(current.stateVersion, snapshot.stateVersion)) {
        return current;
      }
      if (revisionKey(current) !== revisionKey(snapshot)) {
        return snapshot;
      }
      const keepCurrentStorage =
        current.storageSummary.stateVersion >
        snapshot.storageSummary.stateVersion;
      return {
        ...snapshot,
        stateVersion: Math.max(current.stateVersion, snapshot.stateVersion),
        findings: current.findings,
        nextCursor: current.nextCursor,
        storageSummary: keepCurrentStorage
          ? current.storageSummary
          : snapshot.storageSummary,
        diskObservation: keepCurrentStorage
          ? current.diskObservation
          : snapshot.diskObservation,
        quarantineEntries: keepCurrentStorage
          ? current.quarantineEntries
          : snapshot.quarantineEntries,
      };
    });
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
    setPagePending(false);
    setViewState((current) => {
      const reset: WidgetViewState = {
        ...current,
        selectedFindingId: null,
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
    toast("Объект пропущен до следующей проверки.");
  }

  async function cancelAudit(): Promise<void> {
    try {
      await bridge.callTool("audit_cancel", {
        auditId: acceptedSnapshot.auditId,
        requestId: createRequestId("cancel"),
      });
    } catch {
      toast.error("Не удалось остановить проверку. Подождите немного и повторите.");
    }
  }

  async function loadNextPage(): Promise<void> {
    const cursor = acceptedSnapshot.nextCursor;
    const revision = acceptedSnapshot.revision;
    if (cursor === null || revision === null || pagePending) return;
    setPagePending(true);
    try {
      const page = await bridge.callTool<{
        auditId: string;
        revision: number;
        stateVersion: number;
        findingSummary: DashboardSnapshot["findingSummary"];
        findings: readonly DashboardFinding[];
        nextCursor: string | null;
      }>("dashboard_page", {
        auditId: acceptedSnapshot.auditId,
        revision,
        cursor,
        filters: {},
      });
      if (
        page.auditId !== acceptedSnapshot.auditId ||
        page.revision !== revision ||
        page.findingSummary.totalCount !==
          acceptedSnapshot.findingSummary.totalCount ||
        page.findingSummary.matchingCount !==
          acceptedSnapshot.findingSummary.matchingCount
      ) {
        throw new Error("AUDIT_STALE");
      }
      setAcceptedSnapshot((current) => {
        if (
          current.auditId !== page.auditId ||
          current.revision !== page.revision ||
          current.nextCursor !== cursor
        ) {
          return current;
        }
        const known = new Set(
          current.findings.map((finding) => finding.findingId),
        );
        const appended = page.findings.filter(
          (finding) => !known.has(finding.findingId),
        );
        return {
          ...current,
          stateVersion: Math.max(current.stateVersion, page.stateVersion),
          findings: [...current.findings, ...appended],
          nextCursor: page.nextCursor,
        };
      });
    } catch {
      toast.error(
        "Не удалось загрузить следующую страницу. Уже показанные результаты сохранены.",
      );
    } finally {
      setPagePending(false);
    }
  }

  async function startManualAudit(): Promise<void> {
    try {
      await bridge.callTool("audit_start", {
        requestId: createRequestId("manual-audit"),
        profile: "application_remnants",
      });
      toast.success("Проверка запущена. Она только читает данные и ничего не удаляет.");
    } catch {
      toast.error("Не удалось запустить проверку. Попробуйте ещё раз.");
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

  function recordMovedFinding(
    findingId: string,
    result: MoveResult,
  ): void {
    setAcceptedSnapshot((current) => ({
      ...current,
      stateVersion: Math.max(current.stateVersion, result.stateVersion),
      storageSummary: result.storageSummary,
      diskObservation: result.diskObservation,
      findings: current.findings.filter(
        (finding) => finding.findingId !== findingId,
      ),
      quarantineEntries: [
        ...current.quarantineEntries.filter(
          (entry) =>
            entry.entryId !== result.quarantineEntry.quarantineEntryId,
        ),
        {
          entryId: result.quarantineEntry.quarantineEntryId,
          displayName: result.quarantineEntry.displayName,
          physicalBytes: result.quarantineEntry.physicalBytes,
          movedAt: result.quarantineEntry.movedAt,
          state: result.quarantineEntry.state,
        },
      ],
    }));
    commitViewState((current) => ({
      ...current,
      selectedFindingId:
        current.selectedFindingId === findingId
          ? null
          : current.selectedFindingId,
      panel:
        current.selectedFindingId === findingId ? "none" : current.panel,
    }));
  }

  async function toggleDisplayMode(): Promise<void> {
    if (bridge.requestDisplayMode === undefined) {
      toast.error(
        "Эта версия Codex не умеет разворачивать окно. Проверка остаётся доступна здесь.",
      );
      return;
    }
    setFullscreenPending(true);
    const requestedMode =
      displayMode === "fullscreen" ? "inline" : "fullscreen";
    try {
      setDisplayMode(await bridge.requestDisplayMode(requestedMode));
    } catch {
      toast.error(
        requestedMode === "fullscreen"
          ? "Codex не развернул окно. Проверка остаётся доступна здесь."
          : "Codex не свернул окно. Проверка остаётся открыта.",
      );
    } finally {
      setFullscreenPending(false);
    }
  }

  return (
    <TooltipProvider>
      <main className="dashboard-enter mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <header>
        <Card className="dashboard-hero [--card-spacing:--spacing(5)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <img
                src={pluginIconUrl}
                alt=""
                aria-hidden="true"
                className="size-12 shrink-0 rounded-xl"
              />
              <div>
                <p className="text-sm text-muted-foreground">Codex Mac Cleaner</p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Очистка MacBook от мусора
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">Свободно</span>
                  <span className="tabular-nums">
                    {formatBytes(acceptedSnapshot.diskObservation.availableBytes)}
                  </span>
                  <span className="text-muted-foreground">
                    из {formatBytes(acceptedSnapshot.diskObservation.totalBytes)}
                  </span>
                </div>
              </div>
            </div>
            <CardAction className="flex flex-wrap items-center gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-3 max-sm:justify-self-start">
              <Button
                type="button"
                variant="outline"
                disabled={isFullscreenPending}
                onClick={() => void toggleDisplayMode()}
              >
                {isFullscreenPending ? (
                  <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                ) : displayMode === "fullscreen" ? (
                  <Minimize2Icon data-icon="inline-start" />
                ) : (
                  <Maximize2Icon data-icon="inline-start" />
                )}
                {displayMode === "fullscreen" ? "Свернуть" : "Развернуть"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Плагин проверяет Mac локально и ничего не удаляет сам. Вы решаете, что
              оставить, переместить в карантин, восстановить или удалить навсегда.
            </p>
          </CardContent>
        </Card>
      </header>

      {acceptedSnapshot.state === "failed" ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>Проверка остановлена</AlertTitle>
          <AlertDescription>
            Файлы не изменялись. Действия над найденными объектами недоступны — запустите
            проверку ещё раз.
          </AlertDescription>
        </Alert>
      ) : acceptedSnapshot.state === "cancelled" ? (
        <Alert variant="destructive">
          <BanIcon aria-hidden="true" />
          <AlertTitle>Проверка отменена</AlertTitle>
          <AlertDescription>
            Результаты неполные, поэтому перемещение в карантин недоступно. Начните новую
            проверку.
          </AlertDescription>
        </Alert>
      ) : (
        acceptedSnapshot.coverage.warnings.length > 0 && (
          <Alert>
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>Часть областей не проверена</AlertTitle>
            <AlertDescription>
              macOS не дала прочитать некоторые источники. Плагин не предлагает действия
              для объектов, которые не удалось проверить полностью.
            </AlertDescription>
          </Alert>
        )
      )}

      <Tabs
        value={viewState.activeTab}
        onValueChange={(value) => {
          selectTab(value as DashboardTab);
        }}
      >
        <TabsList
          variant="line"
          className="max-w-full overflow-x-auto"
          aria-label="Разделы проверки Mac"
        >
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

        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <AuditProgress snapshot={acceptedSnapshot} onCancel={() => void cancelAudit()} />
            </div>
            <Card className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
              <CardHeader>
                <CardTitle>Итог проверки</CardTitle>
                <CardDescription>
                  Найдено объектов: {acceptedSnapshot.findingSummary.totalCount}.
                  Загружено: {acceptedSnapshot.findings.length}. Оставлено по вашему
                  выбору: {acceptedSnapshot.excludedCount}. Источников проверено:{" "}
                  {acceptedSnapshot.coverage.checkedSourceCount}; недоступно:{" "}
                  {acceptedSnapshot.coverage.skippedSourceCount}.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Можно рассмотреть:{" "}
                  {acceptedSnapshot.findingSummary.supportLevelCounts.candidate}
                </Badge>
                <Badge variant="secondary">
                  Только анализ:{" "}
                  {acceptedSnapshot.findingSummary.supportLevelCounts.analysisOnly}
                </Badge>
                <Badge variant="secondary">
                  Нужна ручная проверка:{" "}
                  {
                    acceptedSnapshot.findingSummary.supportLevelCounts
                      .unsupportedManual
                  }
                </Badge>
              </CardContent>
            </Card>
            {isActionableRevision ? (
              <div className="flex flex-col gap-4 lg:col-span-12">
                <FindingsTable
                  findings={visibleFindings}
                  revision={acceptedSnapshot.revision}
                  actionable={isActionableRevision}
                  bridge={bridge}
                  onInspect={inspectFinding}
                  onExclude={excludeFinding}
                  onSkip={skipFinding}
                  onMoved={recordMovedFinding}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Показано {acceptedSnapshot.findings.length} из{" "}
                    {acceptedSnapshot.findingSummary.matchingCount}
                  </p>
                  {acceptedSnapshot.nextCursor !== null ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pagePending}
                      onClick={() => void loadNextPage()}
                    >
                      {pagePending ? "Загружаем…" : "Показать ещё"}
                    </Button>
                  ) : null}
                </div>
                <StorageSummary
                  storageSummary={acceptedSnapshot.storageSummary}
                />
              </div>
            ) : null}
          </div>
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

      <ProjectFooter bridge={bridge} />

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

function ProjectFooter({ bridge }: { readonly bridge: WidgetBridge }) {
  async function openProjectLink(url: WidgetExternalUrl): Promise<void> {
    if (bridge.openExternal === undefined) {
      toast.error("Эта версия Codex не поддерживает открытие внешних ссылок.");
      return;
    }
    try {
      await bridge.openExternal(url);
    } catch {
      toast.error("Codex не открыл внешнюю ссылку. Интерфейс проверки остаётся доступен.");
    }
  }

  return (
    <footer className="mt-auto flex flex-col gap-3 pt-2">
      <Separator />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          © 2026 Dzzen · Codex Mac Cleaner
        </p>
        <nav
          aria-label="Ссылки проекта"
          className="flex flex-wrap items-center gap-2"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Открыть GitHub проекта"
                  onClick={() => void openProjectLink(PROJECT_LINKS.repository)}
                />
              }
            >
              <GitHubMarkIcon />
            </TooltipTrigger>
            <TooltipContent side="top">GitHub проекта</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void openProjectLink(PROJECT_LINKS.ideas)}
          >
            <MessageSquarePlusIcon data-icon="inline-start" />
            Поделиться идеей
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void openProjectLink(PROJECT_LINKS.developer)}
          >
            <Code2Icon data-icon="inline-start" />
            Разработчик
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void openProjectLink(PROJECT_LINKS.support)}
          >
            <HeartHandshakeIcon data-icon="inline-start" />
            Поддержать проект
          </Button>
        </nav>
      </div>
    </footer>
  );
}

function GitHubMarkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.305-5.466-1.335-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.62-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297Z"
      />
    </svg>
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
  readonly onMoved: (findingId: string, result: MoveResult) => void;
}

function FindingsTable({
  findings,
  revision,
  actionable,
  bridge,
  onInspect,
  onExclude,
  onSkip,
  onMoved,
}: FindingsTableProps) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<readonly string[]>(
    [],
  );
  const groups = useMemo(() => groupDashboardFindings(findings), [findings]);

  if (findings.length === 0) {
    return (
      <Alert>
        <ListFilterIcon aria-hidden="true" />
        <AlertTitle>Нет видимых находок</AlertTitle>
        <AlertDescription>
          Проверка не нашла подходящих объектов, либо вы временно скрыли их.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium">Найденный мусор</h2>
        <CardDescription>
          Результаты объединены по типу и приложению. Раскройте группу, чтобы
          проверить и удалить отдельный объект через карантин.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[min(46vh,34rem)] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Группа</TableHead>
              <TableHead>Объектов</TableHead>
              <TableHead>На диске</TableHead>
              <TableHead>Доступно</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const expanded = expandedGroupIds.includes(group.groupId);
              return (
                <Fragment key={group.groupId}>
                  <TableRow>
                    <TableCell>
                      <div className="flex min-w-48 flex-col gap-1 whitespace-normal">
                        <span className="font-medium">{group.title}</span>
                        <span className="text-muted-foreground">
                          {group.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {group.findings.length}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatBytes(group.physicalSize)}
                    </TableCell>
                    <TableCell>
                      {group.actionableCount > 0
                        ? `Можно удалить: ${group.actionableCount}`
                        : "Только просмотр"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedGroupIds((current) =>
                            expanded
                              ? current.filter((id) => id !== group.groupId)
                              : [...current, group.groupId],
                          )
                        }
                      >
                        <EyeIcon data-icon="inline-start" />
                        {expanded ? "Скрыть" : "Показать объекты"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow key={`${group.groupId}:details`}>
                      <TableCell colSpan={5}>
                        <FindingGroupDetails
                          group={group}
                          revision={revision}
                          actionable={actionable}
                          bridge={bridge}
                          onInspect={onInspect}
                          onExclude={onExclude}
                          onSkip={onSkip}
                          onMoved={onMoved}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FindingGroupDetails({
  group,
  revision,
  actionable,
  bridge,
  onInspect,
  onExclude,
  onSkip,
  onMoved,
}: {
  readonly group: DashboardFindingGroup;
  readonly revision: number | null;
  readonly actionable: boolean;
  readonly bridge: WidgetBridge;
  readonly onInspect: (finding: DashboardFinding) => void;
  readonly onExclude: (finding: DashboardFinding) => Promise<void>;
  readonly onSkip: (finding: DashboardFinding) => void;
  readonly onMoved: (findingId: string, result: MoveResult) => void;
}) {
  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
      {group.findings.map((finding) => {
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
          <article
            key={finding.findingId}
            className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{finding.displayName}</span>
                <SupportLevel level={finding.supportLevel} />
              </div>
              <span className="text-muted-foreground">
                {findingLabel(finding.label)} · {formatBytes(finding.physicalSize)} ·
                риск {riskLabel(finding.risk)}
              </span>
              <span className="text-muted-foreground">
                Надёжность вывода: {confidenceLabel(finding.confidence)}
              </span>
              {!canMove && reasons.length > 0 ? (
                <span className="text-muted-foreground">
                  Почему нельзя удалить:{" "}
                  {reasons.map(blockingReasonLabel).join(", ")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                aria-label={`Подробнее: ${finding.displayName}`}
                onClick={() => onInspect(finding)}
              >
                Подробнее
              </Button>
              {canMove && revision !== null ? (
                <ActionDialog
                  finding={finding}
                  auditRevision={revision}
                  bridge={bridge}
                  onMoved={onMoved}
                />
              ) : null}
              {canExclude ? (
                <ExclusionAction finding={finding} onExclude={onExclude} />
              ) : null}
              {canSkip && finding.supportLevel === "candidate" ? (
                <Button variant="ghost" onClick={() => onSkip(finding)}>
                  <SkipForwardIcon data-icon="inline-start" />
                  Пропустить
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
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
      aria-label={`Оставить: ${finding.displayName}`}
      onClick={() => {
        setPending(true);
        void onExclude(finding)
          .then(() => toast.success("Объект оставлен и больше не будет предлагаться для очистки."))
          .catch(() => toast.error("Не удалось сохранить ваш выбор. Попробуйте ещё раз."))
          .finally(() => setPending(false));
      }}
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <ShieldCheckIcon data-icon="inline-start" />
      )}
      Оставить
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
        <CardTitle>Автопроверка появится позже</CardTitle>
        <CardDescription>
          В этой версии проверку запускает пользователь. Плагин не работает в фоне.
        </CardDescription>
        <CardAction>
          <CalendarClockIcon aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">Не работает в фоне</Badge>
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
          Проверить сейчас
        </Button>
      </CardContent>
    </Card>
  );
}

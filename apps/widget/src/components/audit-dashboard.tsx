import { useEffect, useMemo, useRef, useState } from "react";
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
  ShieldCheckIcon,
  SkipForwardIcon,
} from "lucide-react";
import { toast } from "sonner";

import pluginIconUrl from "@/assets/codex-mac-cleaner-icon.png?inline";
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
  type WidgetBridge,
  type WidgetViewState,
} from "@/lib/bridge";
import type { DashboardFinding, DashboardSnapshot } from "@/lib/dashboard-types";
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
  filter: "",
  selectedFindingId: null,
  selectedQuarantineEntryId: null,
  panel: "none",
  skippedFindingIds: [],
};

const TAB_LABELS: ReadonlyArray<{ value: DashboardTab; label: string }> = [
  { value: "overview", label: "Обзор" },
  { value: "findings", label: "Найдено" },
  { value: "quarantine", label: "Карантин" },
  { value: "exclusions", label: "Исключения" },
  { value: "schedule", label: "Автопроверка" },
];

function revisionKey(snapshot: DashboardSnapshot): string {
  return `${snapshot.auditId}:${snapshot.revision ?? "partial"}`;
}

export function AuditDashboard({ snapshot, bridge }: AuditDashboardProps) {
  const [acceptedSnapshot, setAcceptedSnapshot] = useState(snapshot);
  const [viewState, setViewState] = useState<WidgetViewState>(INITIAL_VIEW_STATE);
  const [exclusionRefreshKey, setExclusionRefreshKey] = useState(0);
  const [isFullscreenPending, setFullscreenPending] = useState(false);
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
    toast("Объект скрыт до следующей проверки.");
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

  async function startManualAudit(): Promise<void> {
    try {
      await bridge.callTool("audit_start", {
        requestId: createRequestId("manual-audit"),
        profile: "application_remnants",
      });
      toast.success("Проверка запущена. Она только читает данные и ничего не удаляет.");
    } catch {
      toast.error("Не удалось запустить проверку.");
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

  async function requestFullscreen(): Promise<void> {
    if (bridge.requestDisplayMode === undefined) {
      toast.error(
        "Эта версия Codex не умеет разворачивать окно. Проверка остаётся доступна здесь.",
      );
      return;
    }
    setFullscreenPending(true);
    try {
      await bridge.requestDisplayMode("fullscreen");
    } catch {
      toast.error("Codex не развернул окно. Проверка остаётся доступна здесь.");
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
                <h1 className="text-2xl font-semibold tracking-tight">Проверка Mac</h1>
              </div>
            </div>
            <CardAction className="flex flex-wrap items-center gap-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-3 max-sm:justify-self-start">
              <Button
                type="button"
                variant="outline"
                disabled={isFullscreenPending}
                onClick={() => void requestFullscreen()}
              >
                {isFullscreenPending ? (
                  <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Maximize2Icon data-icon="inline-start" />
                )}
                Развернуть
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
            <div className="lg:col-span-12 lg:row-start-2">
              <StorageSummary
                storageSummary={acceptedSnapshot.storageSummary}
                diskObservation={acceptedSnapshot.diskObservation}
              />
            </div>
          <Card className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <CardHeader>
              <CardTitle>Краткая сводка находок</CardTitle>
              <CardDescription>
                Найдено объектов: {acceptedSnapshot.findings.length}. В исключениях: {acceptedSnapshot.excludedCount}.
                Источников проверено: {acceptedSnapshot.coverage.checkedSourceCount}; недоступно: {acceptedSnapshot.coverage.skippedSourceCount}.
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
          </div>
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
          Проверка не нашла подходящих объектов, либо вы временно скрыли их.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Найденные объекты</CardTitle>
        <CardDescription>
          Для каждого объекта показаны причина, риск и доступное действие.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Объект</TableHead>
              <TableHead>Почему найден</TableHead>
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
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 whitespace-normal">
                      <span>Вывод: {findingLabel(finding.label)}</span>
                      <span>Уверенность: {confidenceLabel(finding.confidence)}</span>
                      <span>Риск: {riskLabel(finding.risk)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>Размер файлов: {formatBytes(finding.logicalSize)}</span>
                      <span>Занимает на диске: {formatBytes(finding.physicalSize)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canMove ? (
                      <span>Доступно: перемещение одного объекта в карантин</span>
                    ) : reasons.length > 0 ? (
                      <span>Действие недоступно: {reasons.map(blockingReasonLabel).join(", ")}</span>
                    ) : (
                      <span>Изменение файлов недоступно</span>
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

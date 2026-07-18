import type { ExclusionListItem } from "@codex-mac-cleaner/contracts";
import {
  LoaderCircleIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { createRequestId, type WidgetBridge } from "@/lib/bridge";

interface ExclusionsTabProps {
  readonly bridge: WidgetBridge;
  readonly refreshKey: number;
}

interface ExclusionListResult {
  readonly exclusions: readonly ExclusionListItem[];
  readonly stateVersion: number;
}

interface ResetPrepareResult {
  readonly resetToken: string;
  readonly exclusionCount: number;
  readonly expiresAt: string;
  readonly stateVersion: number;
}

const REASON_FILTERS = [
  "user_choice",
  "false_positive",
  "keep_data",
  "other",
] as const;

export function ExclusionsTab({ bridge, refreshKey }: ExclusionsTabProps) {
  const [entries, setEntries] = useState<readonly ExclusionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPreparing, setResetPreparing] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void bridge
      .callTool<ExclusionListResult>("exclusion_list", {})
      .then((result) => {
        if (active) setEntries(result.exclusions);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bridge, refreshKey]);

  const visibleEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru-RU");
    return entries.filter((entry) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [entry.ruleId, entry.artifactKind, entry.reasonCategory]
          .join(" ")
          .toLocaleLowerCase("ru-RU")
          .includes(normalizedSearch);
      const matchesReason =
        reasonFilter === "all" || entry.reasonCategory === reasonFilter;
      return matchesSearch && matchesReason;
    });
  }, [entries, reasonFilter, search]);

  async function removeEntry(entry: ExclusionListItem): Promise<void> {
    try {
      await bridge.callTool("exclusion_remove", {
        exclusionId: entry.exclusionId,
        requestId: createRequestId("exclusion-remove"),
      });
      setEntries((current) =>
        current.filter((candidate) => candidate.exclusionId !== entry.exclusionId),
      );
      toast.success("Исключение удалено. Объект снова будет проверяться.");
    } catch {
      toast.error("Не удалось удалить исключение. Обновите список.");
    }
  }

  async function prepareReset(): Promise<void> {
    setResetPreparing(true);
    setResetToken(null);
    try {
      const result = await bridge.callTool<ResetPrepareResult>(
        "exclusion_reset_prepare",
        { requestId: createRequestId("exclusion-reset-prepare") },
      );
      setResetToken(result.resetToken);
    } catch {
      toast.error("Не удалось подготовить подтверждение сброса.");
      setResetOpen(false);
    } finally {
      setResetPreparing(false);
    }
  }

  async function confirmReset(): Promise<void> {
    if (resetToken === null) return;
    try {
      await bridge.callTool("exclusion_reset", {
        resetToken,
        requestId: createRequestId("exclusion-reset"),
      });
      setEntries([]);
      setResetOpen(false);
      setResetToken(null);
      toast.success("Все пользовательские исключения сброшены.");
    } catch {
      toast.error("Сброс не выполнен. Подготовьте новое подтверждение.");
    }
  }

  if (loadFailed) {
    return (
      <Alert variant="destructive">
        <ShieldCheckIcon aria-hidden="true" />
        <AlertTitle>Состояние исключений недоступно</AlertTitle>
        <AlertDescription>
          Findings остаются видимыми, а destructive tokens заблокированы до восстановления
          local state.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section aria-labelledby="exclusions-title" className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle id="exclusions-title">Пользовательские исключения</CardTitle>
          <CardDescription>
            Локальные identity-based правила не ослабляют protected scopes и не разрешают
            mutation.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">Всего: {entries.length}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-3 sm:flex-row">
            <Field className="flex-1">
              <FieldLabel htmlFor="exclusion-search">Поиск исключений</FieldLabel>
              <Input
                id="exclusion-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rule, тип или причина"
              />
            </Field>
            <Field className="sm:w-auto">
              <FieldLabel htmlFor="exclusion-reason-filter">
                Фильтр по причине
              </FieldLabel>
              <NativeSelect
                id="exclusion-reason-filter"
                className="w-full sm:min-w-52"
                value={reasonFilter}
                onChange={(event) => setReasonFilter(event.target.value)}
              >
                <NativeSelectOption value="all">Все причины</NativeSelectOption>
                {REASON_FILTERS.map((reason) => (
                  <NativeSelectOption key={reason} value={reason}>
                    {reason}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <AlertDialog
            open={resetOpen}
            onOpenChange={(open) => {
              setResetOpen(open);
              if (!open) {
                setResetToken(null);
                setResetPreparing(false);
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={entries.length === 0 || loading}
                onClick={() => void prepareReset()}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Сбросить все исключения
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <RotateCcwIcon aria-hidden="true" />
                </AlertDialogMedia>
                <AlertDialogTitle>
                  Сбросить все пользовательские исключения?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Будут удалены только локальные правила исключений. Это не изменяет
                  исключённые файлы и не запускает mutation. Следующий аудит снова проверит
                  объекты.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={resetToken === null}
                  onClick={() => void confirmReset()}
                >
                  {resetPreparing && (
                    <LoaderCircleIcon
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  Подтвердить сброс
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      {loading ? (
        <Alert>
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          <AlertTitle>Загрузка исключений</AlertTitle>
          <AlertDescription>Читается локальное versioned state.</AlertDescription>
        </Alert>
      ) : entries.length === 0 ? (
        <Alert>
          <ShieldCheckIcon aria-hidden="true" />
          <AlertTitle>Пользовательских исключений нет.</AlertTitle>
          <AlertDescription>Новые аудиты проверяют все доступные findings.</AlertDescription>
        </Alert>
      ) : visibleEntries.length === 0 ? (
        <Alert>
          <SearchIcon aria-hidden="true" />
          <AlertTitle>Исключения по выбранным фильтрам не найдены.</AlertTitle>
          <AlertDescription>Измените поиск или фильтр причины.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleEntries.map((entry) => (
            <Card key={entry.exclusionId}>
              <CardHeader>
                <CardTitle>{entry.ruleId}</CardTitle>
                <CardDescription>Создано: {entry.createdAt}</CardDescription>
                <CardAction>
                  <Badge variant="secondary">{entry.artifactKind}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p>Причина: <span>{entry.reasonCategory}</span></p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  aria-label={`Снова проверять: ${entry.ruleId}`}
                  onClick={() => void removeEntry(entry)}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Снова проверять
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

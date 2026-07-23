import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditDashboard } from "@/components/audit-dashboard";
import type { WidgetBridge, WidgetViewState } from "@/lib/bridge";
import { acceptSnapshot } from "@/lib/bridge";

import {
  cancelledFixture,
  cancellingFixture,
  dashboardFixture,
  runningFixture,
} from "./fixtures";

function createBridge() {
  let lastViewState: WidgetViewState | null = null;
  const requestDisplayMode = vi.fn(async () => undefined);
  const openExternal = vi.fn(async () => undefined);
  const callTool = vi.fn(async (name: string, _input: Record<string, unknown>) => {
    if (name === "quarantine_prepare_move") {
      return { previewToken: "preview-synthetic-001" };
    }
    if (name === "exclusion_list") {
      return { exclusions: [], stateVersion: 20 };
    }
    return { stateVersion: 20 };
  });
  const bridge: WidgetBridge = {
    async callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
      return (await callTool(name, input)) as T;
    },
    setViewState: vi.fn((state: WidgetViewState) => {
      lastViewState = state;
    }),
    requestDisplayMode,
    openExternal,
  };
  return {
    bridge,
    callTool,
    requestDisplayMode,
    openExternal,
    getLastViewState: () => lastViewState,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("интерфейс проверки Mac", () => {
  it("запрашивает только fullscreen после отдельного нажатия пользователя", async () => {
    const { bridge, requestDisplayMode } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    expect(requestDisplayMode).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Мини-окно" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Развернуть" }));
    await waitFor(() => expect(requestDisplayMode).toHaveBeenCalledWith("fullscreen"));
    expect(requestDisplayMode).toHaveBeenCalledTimes(1);
  });

  it("сохраняет интерфейс в чате и объясняет отсутствие полноэкранного режима", () => {
    const errorToast = vi.spyOn(toast, "error");
    const { bridge } = createBridge();
    const bridgeWithoutDisplayMode: WidgetBridge = {
      callTool: bridge.callTool,
      setViewState: bridge.setViewState,
    };

    render(
      <AuditDashboard snapshot={dashboardFixture} bridge={bridgeWithoutDisplayMode} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Развернуть" }));

    expect(errorToast).toHaveBeenCalledWith(
      "Эта версия Codex не умеет разворачивать окно. Проверка остаётся доступна здесь.",
    );
  });

  it("безопасно обрабатывает отказ Codex развернуть окно", async () => {
    const errorToast = vi.spyOn(toast, "error");
    const { bridge, requestDisplayMode } = createBridge();
    vi.mocked(requestDisplayMode).mockRejectedValueOnce(new Error("HOST_REJECTED"));

    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("button", { name: "Развернуть" }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        "Codex не развернул окно. Проверка остаётся доступна здесь.",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Очистка MacBook от мусора" }),
    ).toBeVisible();
  });

  it("показывает подвал и открывает только фиксированные ссылки по клику", async () => {
    const { bridge, callTool, openExternal } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    expect(screen.getByText("© 2026 Dzzen · Codex Mac Cleaner")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Открыть GitHub проекта" }));
    fireEvent.click(screen.getByRole("button", { name: "Поделиться идеей" }));
    fireEvent.click(screen.getByRole("button", { name: "Разработчик" }));
    fireEvent.click(screen.getByRole("button", { name: "Поддержать проект" }));

    await waitFor(() =>
      expect(openExternal).toHaveBeenNthCalledWith(
        1,
        "https://github.com/stasdzzen/Codex-Mac-Cleaner",
      ),
    );
    expect(openExternal).toHaveBeenNthCalledWith(
      2,
      "https://github.com/stasdzzen/Codex-Mac-Cleaner/discussions/new?category=ideas",
    );
    expect(openExternal).toHaveBeenNthCalledWith(3, "https://dzzen.com");
    expect(openExternal).toHaveBeenNthCalledWith(4, "https://dzzen.com/support");
    expect(callTool).not.toHaveBeenCalled();
  });

  it("безопасно объясняет отсутствие host API для внешних ссылок", () => {
    const errorToast = vi.spyOn(toast, "error");
    const { bridge } = createBridge();
    const bridgeWithoutExternal: WidgetBridge = {
      callTool: bridge.callTool,
      setViewState: bridge.setViewState,
      ...(bridge.requestDisplayMode === undefined
        ? {}
        : { requestDisplayMode: bridge.requestDisplayMode }),
    };

    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridgeWithoutExternal} />);
    fireEvent.click(screen.getByRole("button", { name: "Поделиться идеей" }));

    expect(errorToast).toHaveBeenCalledWith(
      "Эта версия Codex не поддерживает открытие внешних ссылок.",
    );
    expect(
      screen.getByRole("heading", { name: "Очистка MacBook от мусора" }),
    ).toBeVisible();
  });

  it("показывает пять вкладок, исключения и запуск проверки пользователем", async () => {
    const { bridge, callTool } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    for (const name of ["Обзор", "Найдено", "Карантин", "Оставленные", "Автопроверка"]) {
      expect(screen.getByRole("tab", { name })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("tab", { name: "Оставленные" }));
    expect(await screen.findByText("Оставленных объектов нет")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Автопроверка" }));
    expect(
      screen.getByText(
        "В этой версии проверку запускает пользователь. Плагин не работает в фоне.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Проверить сейчас" }));
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("audit_start", {
        requestId: expect.any(String),
        profile: "application_remnants",
      }),
    );
  });

  it("загружает следующую страницу только после нажатия и сохраняет общий итог", async () => {
    const state = createBridge();
    const initialFinding = dashboardFixture.findings[0]!;
    const nextFinding = dashboardFixture.findings[1]!;
    state.callTool.mockImplementation(async (name) => {
      if (name === "dashboard_page") {
        return {
          auditId: dashboardFixture.auditId,
          revision: dashboardFixture.revision,
          stateVersion: dashboardFixture.stateVersion,
          findingSummary: {
            totalCount: 2_767,
            matchingCount: 2_767,
            supportLevelCounts: {
              candidate: 112,
              analysisOnly: 2_655,
              unsupportedManual: 0,
            },
          },
          findings: [initialFinding, nextFinding],
          nextCursor: null,
        };
      }
      if (name === "exclusion_list") {
        return { exclusions: [], stateVersion: 20 };
      }
      return { stateVersion: 20 };
    });
    const { rerender } = render(
      <AuditDashboard
        snapshot={{
          ...dashboardFixture,
          findings: [initialFinding],
          findingSummary: {
            totalCount: 2_767,
            matchingCount: 2_767,
            supportLevelCounts: {
              candidate: 112,
              analysisOnly: 2_655,
              unsupportedManual: 0,
            },
          },
          nextCursor: "cursor-page-2",
        }}
        bridge={state.bridge}
      />,
    );

    expect(
      state.callTool.mock.calls.filter(([name]) => name === "dashboard_page"),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));
    expect(screen.getByText("Показано 1 из 2767")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await waitFor(() =>
      expect(state.callTool).toHaveBeenCalledWith("dashboard_page", {
        auditId: dashboardFixture.auditId,
        revision: dashboardFixture.revision,
        cursor: "cursor-page-2",
        filters: {},
      }),
    );
    expect(await screen.findByText("Показано 2 из 2767")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
    expect(screen.getAllByText(nextFinding.displayName)).toHaveLength(1);

    rerender(
      <AuditDashboard
        snapshot={{
          ...dashboardFixture,
          stateVersion: dashboardFixture.stateVersion + 1,
          findings: [initialFinding],
          findingSummary: {
            totalCount: 2_767,
            matchingCount: 2_767,
            supportLevelCounts: {
              candidate: 112,
              analysisOnly: 2_655,
              unsupportedManual: 0,
            },
          },
          nextCursor: "cursor-page-2",
        }}
        bridge={state.bridge}
      />,
    );
    expect(screen.getByText("Показано 2 из 2767")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
  });

  it("поддерживает клавиатурную навигацию по вкладкам", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    const overviewTab = screen.getByRole("tab", { name: "Обзор" });
    overviewTab.focus();
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Найдено" })).toHaveFocus();
  });

  it("понятно показывает полноту проверки, доказательства и причины запрета", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Часть областей не проверена");
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));

    expect(screen.getByText("можно проверить и переместить в карантин")).toBeVisible();
    expect(screen.getByText("только просмотр")).toBeVisible();
    expect(screen.getByText("нужна ручная проверка")).toBeVisible();
    expect(screen.queryByText(/sudo|launchctl|\brm\s/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Подробнее: Synthetic Database" }));
    const sheet = screen.getByRole("dialog", { name: "Synthetic Database" });
    expect(within(sheet).getByText("Компонент: Example Notes")).toBeVisible();
    expect(within(sheet).getByText("Категория: база данных")).toBeVisible();
    expect(within(sheet).getByText("Актуальность: данные актуальны")).toBeVisible();
    expect(within(sheet).getByText("Приложение-владелец: не удалось проверить")).toBeVisible();
    expect(within(sheet).getByText("Активный процесс: не удалось проверить")).toBeVisible();
    expect(within(sheet).getByText("Открытые файлы: не удалось проверить")).toBeVisible();
    expect(within(sheet).getByText("Сведения установщика: не удалось проверить")).toBeVisible();
    expect(within(sheet).getByText("Чувствительные данные: база данных, личные данные")).toBeVisible();
    expect(within(sheet).getByText("Что это: назначение не определено")).toBeVisible();
    expect(within(sheet).getByText("Насколько надёжен вывод: низкая")).toBeVisible();
    expect(within(sheet).getByText("Риск: высокий")).toBeVisible();
    expect(within(sheet).getByText("Причина: категория требует ручной проверки")).toBeVisible();
    expect(within(sheet).getByText("Проверено: тип данных.")).toBeVisible();
    expect(within(sheet).getByText(/Объект занимает примерно 0,26 МБ/)).toBeVisible();
    expect(within(sheet).getByText(/^Данные получены:/)).toBeVisible();
    expect(within(sheet).getByText(/оценка сделана по снимку состояния/)).toBeVisible();
    expect(within(sheet).getByText("Проверка: тип данных")).toBeVisible();
  });

  it("показывает пять показателей места без обещания точного прироста", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    for (const label of [
      "Размер найденных файлов",
      "Занимают на диске",
      "Хранится в карантине",
      "Удалено из карантина",
      "Свободно на диске",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText(/^Проверено:/)).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: /Относительное сравнение размеров.*1,57 МБ.*1,05 МБ.*0,52 МБ.*0,26 МБ/u,
      }),
    ).toBeVisible();
    expect(document.querySelectorAll("[data-storage-bar]")).toHaveLength(4);
    expect(screen.getByText(/Показатели не нужно складывать/u)).toBeVisible();
    expect(screen.queryByText(/освобождено после|прирост свободного места|APFS delta/i)).not.toBeInTheDocument();
  });

  it("показывает доступный прогресс без зависимости от декоративной анимации", () => {
    const { bridge } = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={runningFixture} bridge={bridge} />,
    );

    const runningProgress = screen.getByRole("progressbar", {
      name: "Прогресс проверки: 38%",
    });
    expect(runningProgress).toHaveAttribute("aria-valuenow", "37.5");
    expect(runningProgress.closest("[data-audit-active]")).toHaveAttribute(
      "data-audit-active",
      "true",
    );

    rerender(
      <AuditDashboard
        snapshot={{ ...dashboardFixture, stateVersion: runningFixture.stateVersion + 1 }}
        bridge={bridge}
      />,
    );

    expect(screen.getByRole("progressbar").closest("[data-audit-active]")).toHaveAttribute(
      "data-audit-active",
      "false",
    );
  });

  it("отменяет running-аудит, блокирует повторную отмену и оставляет cancelled read-only", async () => {
    const running = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={runningFixture} bridge={running.bridge} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Остановить проверку" }));
    await waitFor(() =>
      expect(running.callTool).toHaveBeenCalledWith("audit_cancel", {
        auditId: "audit-synthetic-001",
        requestId: expect.any(String),
      }),
    );
    expect(
      running.callTool.mock.calls.filter(([name]) => name === "audit_cancel"),
    ).toHaveLength(1);

    rerender(<AuditDashboard snapshot={cancellingFixture} bridge={running.bridge} />);
    expect(screen.getByRole("button", { name: "Проверка останавливается" })).toBeDisabled();

    rerender(<AuditDashboard snapshot={cancelledFixture} bridge={running.bridge} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Результаты неполные, поэтому перемещение в карантин недоступно. Начните новую проверку",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));
    expect(screen.queryByRole("button", { name: "В карантин" })).not.toBeInTheDocument();
  });

  it("сам обновляет живой прогресс через audit_status", async () => {
    vi.useFakeTimers();
    const callTool = vi.fn(async (
      _name: string,
      _input: Record<string, unknown>,
    ) => ({
      auditId: runningFixture.auditId,
      state: "running",
      stateVersion: runningFixture.stateVersion + 1,
      progress: {
        phase: "correlating_candidates",
        completedSteps: 5,
        totalSteps: 8,
        processedCandidates: 4,
        totalCandidates: 6,
      },
      coverageWarningCodes: [],
    }));
    const bridge: WidgetBridge = {
      callTool: async <T,>(name: string, input: Record<string, unknown>) =>
        (await callTool(name, input)) as T,
      setViewState: vi.fn(),
    };
    render(<AuditDashboard snapshot={runningFixture} bridge={bridge} />);

    await vi.advanceTimersByTimeAsync(1_100);

    expect(callTool).toHaveBeenCalledWith("audit_status", {
      auditId: runningFixture.auditId,
    });
    expect(screen.getByText(/Проверка связей найденных объектов/)).toBeVisible();
    expect(screen.getByText(/Объектов проверено: 4 из 6/)).toBeVisible();
  });

  it("показывает terminal failure без действий над находками", () => {
    const { bridge } = createBridge();
    render(
      <AuditDashboard
        snapshot={{
          ...runningFixture,
          state: "failed",
          stateVersion: runningFixture.stateVersion + 1,
          progress: { ...runningFixture.progress, phase: "failed" },
        }}
        bridge={bridge}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Файлы не изменялись. Действия над найденными объектами недоступны",
    );
    expect(screen.queryByRole("button", { name: "В карантин" })).not.toBeInTheDocument();
  });

  it("пропускает finding только в view state текущей ревизии и не вызывает tool", () => {
    const state = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));
    fireEvent.click(screen.getByRole("button", { name: "Пропустить сейчас" }));

    expect(state.callTool).not.toHaveBeenCalled();
    expect(state.getLastViewState()?.skippedFindingIds).toEqual(["finding-synthetic-cache"]);
    expect(Object.keys(state.getLastViewState() ?? {}).sort()).toEqual([
      "activeTab",
      "filter",
      "panel",
      "selectedFindingId",
      "selectedQuarantineEntryId",
      "skippedFindingIds",
    ]);
    expect(JSON.stringify(state.getLastViewState())).not.toMatch(/path|token|policy/i);

    rerender(
      <AuditDashboard
        snapshot={{ ...dashboardFixture, auditId: "audit-synthetic-002", revision: 8, stateVersion: 16 }}
        bridge={state.bridge}
      />,
    );
    expect(state.getLastViewState()?.skippedFindingIds).toEqual([]);
  });

  it("отбрасывает stale stateVersion", () => {
    const { bridge } = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={dashboardFixture} bridge={bridge} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));
    expect(screen.getByText("Synthetic Cache")).toBeVisible();

    rerender(
      <AuditDashboard
        snapshot={{ ...dashboardFixture, stateVersion: 11, findings: [] }}
        bridge={bridge}
      />,
    );
    expect(screen.getByText("Synthetic Cache")).toBeVisible();
    expect(acceptSnapshot(12, 11)).toBe(false);
    expect(acceptSnapshot(12, 12)).toBe(true);
  });

  it("открывает отдельное подтверждение карантина одного объекта и возвращает focus", async () => {
    const state = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Найдено" }));

    const trigger = screen.getByRole("button", { name: "В карантин" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("alertdialog", {
      name: "Переместить «Synthetic Cache» в карантин?",
    });
    expect(within(dialog).getByText(/ровно один объект/i)).toBeVisible();
    expect(within(dialog).getByText(/будет перемещён в карантин/i)).toBeVisible();
    expect(within(dialog).getByText(/можно восстановить в исходное место/i)).toBeVisible();
    expect(state.callTool).toHaveBeenCalledWith("quarantine_prepare_move", {
      findingId: "finding-synthetic-cache",
      auditRevision: 7,
    });
    expect(JSON.stringify(state.callTool.mock.calls)).not.toMatch(/path|direct_delete/i);

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

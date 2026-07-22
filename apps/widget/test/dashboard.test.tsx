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
  };
  return {
    bridge,
    callTool,
    requestDisplayMode,
    getLastViewState: () => lastViewState,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Audit Dashboard contract", () => {
  it("запрашивает fullscreen и PiP только после отдельного нажатия пользователя", async () => {
    const { bridge, requestDisplayMode } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    expect(requestDisplayMode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Развернуть" }));
    await waitFor(() => expect(requestDisplayMode).toHaveBeenCalledWith("fullscreen"));

    fireEvent.click(screen.getByRole("button", { name: "Мини-окно" }));
    await waitFor(() => expect(requestDisplayMode).toHaveBeenCalledWith("pip"));
  });

  it("сохраняет inline Dashboard и объясняет отсутствие display-mode capability", () => {
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
      "Эта версия Codex не поддерживает переключение режима. Dashboard остаётся в чате.",
    );
  });

  it("безопасно обрабатывает отказ хоста открыть PiP", async () => {
    const errorToast = vi.spyOn(toast, "error");
    const { bridge, requestDisplayMode } = createBridge();
    vi.mocked(requestDisplayMode).mockRejectedValueOnce(new Error("HOST_REJECTED"));

    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("button", { name: "Мини-окно" }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        "Codex не открыл мини-окно. Dashboard остаётся в текущем режиме.",
      ),
    );
    expect(screen.getByRole("heading", { name: "Audit Dashboard" })).toBeVisible();
  });

  it("показывает пять вкладок, рабочие Исключения и ручной fallback CMC-13", async () => {
    const { bridge, callTool } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    for (const name of ["Обзор", "Находки", "Карантин", "Исключения", "Расписание"]) {
      expect(screen.getByRole("tab", { name })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("tab", { name: "Исключения" }));
    expect(await screen.findByText("Пользовательских исключений нет.")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Расписание" }));
    expect(
      screen.getByText(
        "Автоматическое расписание недоступно в v0.1. Запустите обычный read-only аудит вручную.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Запустить аудит вручную" }));
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("audit_start", {
        requestId: expect.any(String),
        profile: "application_remnants",
      }),
    );
  });

  it("поддерживает клавиатурную навигацию по вкладкам", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    const overviewTab = screen.getByRole("tab", { name: "Обзор" });
    overviewTab.focus();
    fireEvent.keyDown(overviewTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Находки" })).toHaveFocus();
  });

  it("показывает coverage, FindingFacts, support levels, evidence и причины запрета текстом", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Часть областей не проверена");
    fireEvent.click(screen.getByRole("tab", { name: "Находки" }));

    expect(screen.getByText("Уровень поддержки: candidate")).toBeVisible();
    expect(screen.getByText("Уровень поддержки: analysis_only")).toBeVisible();
    expect(screen.getByText("Уровень поддержки: unsupported_manual")).toBeVisible();
    expect(screen.getByText("Требует расширенного режима")).toBeVisible();
    expect(screen.queryByText(/sudo|launchctl|\brm\s/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Подробнее: Synthetic Database" }));
    const sheet = screen.getByRole("dialog", { name: "Synthetic Database" });
    expect(within(sheet).getByText("Компонент: Example Notes")).toBeVisible();
    expect(within(sheet).getByText("Категория: database")).toBeVisible();
    expect(within(sheet).getByText("Временная классификация: current")).toBeVisible();
    expect(within(sheet).getByText("Состояние приложения: unknown")).toBeVisible();
    expect(within(sheet).getByText("Активность: unknown")).toBeVisible();
    expect(within(sheet).getByText("Открытые файлы: unknown")).toBeVisible();
    expect(within(sheet).getByText("Receipt: unknown")).toBeVisible();
    expect(within(sheet).getByText("Чувствительные данные: database, personal_data")).toBeVisible();
    expect(within(sheet).getByText("Метка: unknown")).toBeVisible();
    expect(within(sheet).getByText("Уверенность: low")).toBeVisible();
    expect(within(sheet).getByText("Риск: high")).toBeVisible();
    expect(within(sheet).getByText("Действие недоступно: POLICY_RISK_CATEGORY")).toBeVisible();
    expect(within(sheet).getByText("Обнаружены признаки пользовательской базы данных.")).toBeVisible();
    expect(within(sheet).getByText(/Оценка освобождения: 262 144 байт/)).toBeVisible();
    expect(within(sheet).getByText("Оценка наблюдалась: 2026-07-18T09:59:00.000Z")).toBeVisible();
    expect(within(sheet).getByText(/snapshot estimate/)).toBeVisible();
    expect(within(sheet).getByText("Вход правила: data_kind")).toBeVisible();
  });

  it("показывает пять server-owned показателей и timestamp без причинного APFS claim", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    for (const label of [
      "Логический размер находок",
      "Физический размер находок",
      "В карантине",
      "Удалено навсегда",
      "Свободно на диске",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
    expect(screen.getByText("Наблюдение диска: 2026-07-18T10:05:00.000Z")).toBeVisible();
    expect(screen.getByText("Источник: append-only journal")).toBeVisible();
    expect(screen.queryByText(/освобождено после|прирост свободного места|APFS delta/i)).not.toBeInTheDocument();
  });

  it("отменяет running-аудит, блокирует повторную отмену и оставляет cancelled read-only", async () => {
    const running = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={runningFixture} bridge={running.bridge} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Отменить аудит" }));
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
    expect(screen.getByRole("button", { name: "Отмена выполняется" })).toBeDisabled();

    rerender(<AuditDashboard snapshot={cancelledFixture} bridge={running.bridge} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно. Начните новый аудит",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Находки" }));
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
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
    expect(screen.getByText(/Сопоставление кандидатов/)).toBeVisible();
    expect(screen.getByText(/Кандидатов обработано: 4 из 6/)).toBeVisible();
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
      "Проверка завершилась с безопасной ошибкой. Файлы не изменялись",
    );
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("пропускает finding только в view state текущей ревизии и не вызывает tool", () => {
    const state = createBridge();
    const { rerender } = render(
      <AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Находки" }));
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
    fireEvent.click(screen.getByRole("tab", { name: "Находки" }));

    const trigger = screen.getByRole("button", { name: "Удалить" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("alertdialog", {
      name: "Переместить в карантин: Synthetic Cache",
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

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  const callTool = vi.fn(async (name: string, _input: Record<string, unknown>) => {
    if (name === "quarantine_prepare_move") {
      return { previewToken: "preview-synthetic-001" };
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
  };
  return { bridge, callTool, getLastViewState: () => lastViewState };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Audit Dashboard contract", () => {
  it("показывает пять вкладок и честные dependency states CMC-12/13", () => {
    const { bridge } = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);

    for (const name of ["Обзор", "Находки", "Карантин", "Исключения", "Расписание"]) {
      expect(screen.getByRole("tab", { name })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("tab", { name: "Исключения" }));
    expect(screen.getByText("Постоянные исключения появятся в CMC-12.")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Расписание" }));
    expect(screen.getByText("Расписание read-only аудита появится в CMC-13.")).toBeVisible();
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
    await waitFor(() => expect(running.callTool).toHaveBeenCalledOnce());
    expect(running.callTool).toHaveBeenCalledWith("audit_cancel", {
      auditId: "audit-synthetic-001",
      requestId: expect.any(String),
    });

    rerender(<AuditDashboard snapshot={cancellingFixture} bridge={running.bridge} />);
    expect(screen.getByRole("button", { name: "Отмена выполняется" })).toBeDisabled();

    rerender(<AuditDashboard snapshot={cancelledFixture} bridge={running.bridge} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Аудит отменён. Результаты неполные, поэтому перемещение в карантин недоступно. Начните новый аудит",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Находки" }));
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

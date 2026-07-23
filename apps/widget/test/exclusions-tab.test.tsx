import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuditDashboard } from "@/components/audit-dashboard";
import type { WidgetBridge } from "@/lib/bridge";

import { dashboardFixture } from "./fixtures";

const exclusions = [
  {
    exclusionId: "exclusion-synthetic-cache",
    ruleId: "RULE_SYNTHETIC_CACHE",
    artifactKind: "directory",
    createdAt: "2026-07-18T00:00:00.000Z",
    reasonCategory: "keep_data",
  },
  {
    exclusionId: "exclusion-synthetic-log",
    ruleId: "RULE_SYNTHETIC_LOG",
    artifactKind: "file",
    createdAt: "2026-07-17T00:00:00.000Z",
    reasonCategory: "false_positive",
  },
] as const;

function createBridge() {
  const callTool = vi.fn(async (name: string, input: Record<string, unknown>) => {
    if (name === "exclusion_list") return { exclusions, stateVersion: 3 };
    if (name === "exclusion_create") {
      return { exclusion: exclusions[0], stateVersion: 4 };
    }
    if (name === "exclusion_reset_prepare") {
      return {
        resetToken: "reset-synthetic-a",
        exclusionCount: 2,
        expiresAt: "2026-07-18T01:05:00.000Z",
        stateVersion: 4,
      };
    }
    if (name === "exclusion_reset") return { removedCount: 2, stateVersion: 5 };
    if (name === "exclusion_remove") {
      return { removedExclusionId: input.exclusionId, stateVersion: 5 };
    }
    return { stateVersion: 3 };
  });
  const bridge: WidgetBridge = {
    async callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
      return (await callTool(name, input)) as T;
    },
    setViewState: vi.fn(),
  };
  return { bridge, callTool };
}

describe("вкладка Оставленные", () => {
  it("создаёт exclusion из finding только по IDs и сохраняет его после remount", async () => {
    const state = createBridge();
    const { unmount } = render(
      <AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />,
    );
    const cacheRow = screen.getByText("Кеши приложений").closest("tr");
    expect(cacheRow).not.toBeNull();
    fireEvent.click(
      within(cacheRow!).getByRole("button", { name: "Показать объекты" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Оставить: Synthetic Cache" }));

    await waitFor(() =>
      expect(state.callTool).toHaveBeenCalledWith("exclusion_create", {
        findingId: "finding-synthetic-cache",
        auditRevision: 7,
        requestId: expect.any(String),
        reasonCategory: "user_choice",
      }),
    );
    expect(JSON.stringify(state.callTool.mock.calls)).not.toMatch(
      /path|glob|command|destination|owner|bundle|signing/i,
    );

    unmount();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Оставленные" }));
    expect((await screen.findAllByText("Сохранённый объект"))).toHaveLength(2);
  });

  it("поддерживает поиск, фильтр, причину, дату и поэлементное Снова проверять", async () => {
    const state = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Оставленные" }));

    expect((await screen.findAllByText("Сохранённый объект"))).toHaveLength(2);
    const searchControl = screen.getByLabelText("Поиск оставленных объектов");
    const filterControl = screen.getByLabelText("Причина");
    const fieldGroup = searchControl.closest('[data-slot="field-group"]');
    expect(fieldGroup).not.toBeNull();
    expect(searchControl.closest('[data-slot="field"]')).not.toBeNull();
    expect(filterControl.closest('[data-slot="field"]')).not.toBeNull();
    expect(filterControl.closest('[data-slot="field-group"]')).toBe(fieldGroup);
    expect(screen.getAllByText("сохранить данные").some((item) => item.tagName === "SPAN")).toBe(true);
    expect(screen.getAllByText(/Добавлено:/)).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Поиск оставленных объектов"), {
      target: { value: "файл" },
    });
    expect(screen.getAllByText("Сохранённый объект")).toHaveLength(1);
    expect(
      screen.getAllByText("объект определён ошибочно").some((item) => item.tagName === "SPAN"),
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Причина"), {
      target: { value: "keep_data" },
    });
    expect(screen.getByText("Ничего не найдено")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Поиск оставленных объектов"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Снова проверять этот объект" })[0]!);
    await waitFor(() =>
      expect(state.callTool).toHaveBeenCalledWith("exclusion_remove", {
        exclusionId: "exclusion-synthetic-cache",
        requestId: expect.any(String),
      }),
    );
  });

  it("reset all использует отдельное подтверждение и одноразовый token", async () => {
    const state = createBridge();
    render(<AuditDashboard snapshot={dashboardFixture} bridge={state.bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Оставленные" }));
    expect((await screen.findAllByText("Сохранённый объект"))).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Проверять все снова" }));
    await waitFor(() =>
      expect(state.callTool).toHaveBeenCalledWith("exclusion_reset_prepare", {
        requestId: expect.any(String),
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Снова проверять все оставленные объекты?",
    });
    expect(within(dialog).getByText(/не изменяет исключённые файлы/i)).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "Проверять все снова" }));
    await waitFor(() =>
      expect(state.callTool).toHaveBeenCalledWith("exclusion_reset", {
        resetToken: "reset-synthetic-a",
        requestId: expect.any(String),
      }),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

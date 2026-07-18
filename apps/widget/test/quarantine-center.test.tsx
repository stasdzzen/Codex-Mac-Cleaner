import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditDashboard } from "@/components/audit-dashboard";
import type { WidgetBridge } from "@/lib/bridge";

import { dashboardFixture } from "./fixtures";

const callTool = vi.fn(
  async (_name: string, _input: Record<string, unknown>) => ({
    previewToken: "preview-synthetic-quarantine",
  }),
);

const bridge: WidgetBridge = {
  async callTool<T>(name: string, input: Record<string, unknown>): Promise<T> {
    return (await callTool(name, input)) as T;
  },
  setViewState: vi.fn(),
};

describe("Quarantine Center contract", () => {
  beforeEach(() => {
    callTool.mockClear();
  });

  it("показывает только поэлементные restore/purge без bulk, select-all и auto purge", () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));

    expect(screen.getByRole("button", { name: "Восстановить: Synthetic Old Cache" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Удалить навсегда: Synthetic Old Cache" })).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/очистить всё|выбрать все|автоматическ.*очист/i)).not.toBeInTheDocument();
  });

  it("получает preview до подтверждения необратимого удаления одной записи", async () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить навсегда: Synthetic Old Cache" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Удалить навсегда: Synthetic Old Cache",
    });
    expect(within(dialog).getByText(/необратимо/i)).toBeVisible();
    expect(within(dialog).getByText(/одна запись карантина/i)).toBeVisible();

    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_prepare_purge", {
        quarantineEntryId: "quarantine-synthetic-001",
      }),
    );
    expect(callTool).not.toHaveBeenCalledWith(
      "quarantine_purge",
      expect.anything(),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить одну запись" }));
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_purge", {
        previewToken: "preview-synthetic-quarantine",
        operationId: expect.any(String),
      }),
    );
  });
});

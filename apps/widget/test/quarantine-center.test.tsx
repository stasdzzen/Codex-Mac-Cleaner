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

  it("показывает безопасную последовательную очистку без select-all и auto purge", () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));

    expect(screen.getByRole("button", { name: "Восстановить: Synthetic Old Cache" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Удалить навсегда: Synthetic Old Cache" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Очистить карантин" })).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/выбрать все|автоматическ.*очист/i)).not.toBeInTheDocument();
  });

  it("очистка карантина требует отдельного подтверждения текущей записи", async () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));
    fireEvent.click(screen.getByRole("button", { name: "Очистить карантин" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Очистить карантин: объект 1 из 1?",
    });
    expect(within(dialog).getByText(/каждая запись подтверждается отдельно/i)).toBeVisible();
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_prepare_purge", {
        operationId: "quarantine-synthetic-001",
      }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить этот объект" }));
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_purge", {
        previewToken: "preview-synthetic-quarantine",
        operationId: "quarantine-synthetic-001",
      }),
    );
  });

  it("последовательно подтверждает две записи и не создаёт общий purge-вызов", async () => {
    const first = dashboardFixture.quarantineEntries[0]!;
    render(
      <AuditDashboard
        snapshot={{
          ...dashboardFixture,
          quarantineEntries: [
            first,
            {
              ...first,
              entryId: "quarantine-synthetic-002",
              displayName: "Synthetic Old Log",
            },
          ],
        }}
        bridge={bridge}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));
    fireEvent.click(screen.getByRole("button", { name: "Очистить карантин" }));

    let dialog = screen.getByRole("alertdialog", {
      name: "Очистить карантин: объект 1 из 2?",
    });
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_prepare_purge", {
        operationId: "quarantine-synthetic-001",
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Удалить этот объект" }),
    );
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_prepare_purge", {
        operationId: "quarantine-synthetic-002",
      }),
    );

    dialog = screen.getByRole("alertdialog", {
      name: "Очистить карантин: объект 2 из 2?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Удалить этот объект" }),
    );
    await waitFor(() =>
      expect(callTool).toHaveBeenCalledWith("quarantine_purge", {
        previewToken: "preview-synthetic-quarantine",
        operationId: "quarantine-synthetic-002",
      }),
    );
    expect(
      callTool.mock.calls.filter(([name]) => name === "quarantine_purge"),
    ).toHaveLength(2);
    expect(
      callTool.mock.calls.some(([, input]) => "operationIds" in input),
    ).toBe(false);
  });

  it("использует operationId записи при prepare и execute восстановления", async () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));
    fireEvent.click(screen.getByRole("button", { name: "Восстановить: Synthetic Old Cache" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Восстановить «Synthetic Old Cache»?",
    });
    await waitFor(() => expect(callTool).toHaveBeenCalledOnce());
    expect(callTool.mock.calls).toEqual([
      [
        "quarantine_prepare_restore",
        { operationId: "quarantine-synthetic-001" },
      ],
    ]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Восстановить этот объект" }));
    await waitFor(() => expect(callTool).toHaveBeenCalledTimes(2));
    expect(callTool.mock.calls).toEqual([
      [
        "quarantine_prepare_restore",
        { operationId: "quarantine-synthetic-001" },
      ],
      [
        "quarantine_restore",
        {
          previewToken: "preview-synthetic-quarantine",
          operationId: "quarantine-synthetic-001",
        },
      ],
    ]);
    expect(JSON.stringify(callTool.mock.calls)).not.toMatch(/path|destination|requestId/i);
  });

  it("использует тот же operationId записи при prepare и execute purge", async () => {
    render(<AuditDashboard snapshot={dashboardFixture} bridge={bridge} />);
    fireEvent.click(screen.getByRole("tab", { name: "Карантин" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить навсегда: Synthetic Old Cache" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Удалить навсегда «Synthetic Old Cache»?",
    });
    expect(within(dialog).getByText(/необратимо/i)).toBeVisible();
    expect(within(dialog).getByText(/один объект из карантина/i)).toBeVisible();

    await waitFor(() => expect(callTool).toHaveBeenCalledOnce());
    expect(callTool.mock.calls).toEqual([
      [
        "quarantine_prepare_purge",
        { operationId: "quarantine-synthetic-001" },
      ],
    ]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить этот объект" }));
    await waitFor(() => expect(callTool).toHaveBeenCalledTimes(2));
    expect(callTool.mock.calls).toEqual([
      [
        "quarantine_prepare_purge",
        { operationId: "quarantine-synthetic-001" },
      ],
      [
        "quarantine_purge",
        {
          previewToken: "preview-synthetic-quarantine",
          operationId: "quarantine-synthetic-001",
        },
      ],
    ]);
    expect(JSON.stringify(callTool.mock.calls)).not.toMatch(/path|destination|requestId/i);
  });
});

import { describe, expect, it } from "vitest";

import {
  blockingReasonLabel,
  categoryLabel,
  confidenceLabel,
  exclusionReasonLabel,
  formatDateTime,
  riskLabel,
  supportLevelLabel,
} from "@/lib/presentation";

describe("русские подписи интерфейса", () => {
  it("переводит значения контрактов без показа внутренних кодов", () => {
    expect(categoryLabel("application_support")).toBe("служебные данные приложения");
    expect(supportLevelLabel("candidate")).toBe(
      "можно проверить и переместить в карантин",
    );
    expect(confidenceLabel("high")).toBe("высокая");
    expect(riskLabel("high")).toBe("высокий");
    expect(exclusionReasonLabel("keep_data")).toBe("сохранить данные");
    expect(blockingReasonLabel("POLICY_ACTIVE_PROCESS")).toBe(
      "приложение или связанный процесс сейчас запущен",
    );
  });

  it("не показывает незнакомый внутренний код пользователю", () => {
    expect(blockingReasonLabel("POLICY_FUTURE_RULE")).toBe(
      "действие заблокировано проверкой безопасности",
    );
    expect(blockingReasonLabel("Требуется расширенный режим")).toBe(
      "Требуется расширенный режим",
    );
  });

  it("форматирует дату для русскоязычного интерфейса", () => {
    expect(formatDateTime("2026-07-18T09:59:00.000Z")).not.toContain("T09:59");
    expect(formatDateTime("not-a-date")).toBe("дата не указана");
  });
});

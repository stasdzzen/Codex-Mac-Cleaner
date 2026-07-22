import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const STORAGE_VALUE_FORMATTER = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 МБ";
  if (value < 10_000) return "< 0,01 МБ";
  const gigabytes = value >= 1_000_000_000;
  const amount = value / (gigabytes ? 1_000_000_000 : 1_000_000);
  return `${STORAGE_VALUE_FORMATTER.format(amount)} ${gigabytes ? "ГБ" : "МБ"}`;
}

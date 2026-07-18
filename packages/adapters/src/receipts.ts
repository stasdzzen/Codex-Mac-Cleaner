import type { FileSystemFacade } from "./filesystem-facade.js";
import { createTargetedAdapter } from "./targeted.js";
import type { SourceAdapter } from "./types.js";

export function createReceiptsAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return createTargetedAdapter(filesystem, {
    id: "receipts",
    facadeSource: "receipts",
    source: "package_receipts",
    map: (record) => ({
      evidenceKind: record.kind === "official_uninstaller"
        ? "official_uninstaller"
        : record.stale === true
          ? "stale_receipt"
          : "receipt",
      supportLevel: "analysis_only",
      allowedActions: ["inspect"],
      safeExplanation: record.kind === "official_uninstaller"
        ? "Доступен официальный способ удаления"
        : record.stale === true
          ? "Receipt не подтверждён текущей установкой"
          : "Receipt учтён как read-only evidence",
      recommendedMethod: record.kind === "official_uninstaller"
        ? "official_uninstaller"
        : "inspect_only",
    }),
  });
}

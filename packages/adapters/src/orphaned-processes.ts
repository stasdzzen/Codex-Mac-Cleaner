import type { FileSystemFacade } from "./filesystem-facade.js";
import { createTargetedAdapter } from "./targeted.js";
import type { SourceAdapter } from "./types.js";

export function createOrphanedProcessAdapter(
  filesystem: FileSystemFacade,
): SourceAdapter {
  return createTargetedAdapter(filesystem, {
    id: "orphaned-processes",
    facadeSource: "orphaned_processes",
    source: "process_activity",
    map: (record) => ({
      evidenceKind: "process_activity",
      supportLevel:
        record.recommendedMethod === "advanced_mode"
          ? "unsupported_manual"
          : "analysis_only",
      allowedActions: ["inspect"],
      safeExplanation:
        "Активный процесс имеет отсутствующий executable и требует ручной диагностики",
      recommendedMethod:
        record.recommendedMethod === "advanced_mode"
          ? "advanced_mode"
          : "inspect_only",
    }),
  });
}

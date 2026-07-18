import type { FileSystemFacade } from "./filesystem-facade.js";
import { createTargetedAdapter } from "./targeted.js";
import type { SourceAdapter } from "./types.js";

export function createInspectionOnlyAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return createTargetedAdapter(filesystem, {
    id: "inspection-only",
    facadeSource: "inspection",
    source: "startup_items",
    map: (record) => ({
      source: record.kind === "snapshot" ? "disk_observation" : "startup_items",
      evidenceKind: "system_inspection",
      supportLevel: "unsupported_manual",
      allowedActions: ["inspect"],
      safeExplanation: "Требует расширенного режима",
      recommendedMethod: "advanced_mode",
    }),
  });
}

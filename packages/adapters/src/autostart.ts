import type { FileSystemFacade } from "./filesystem-facade.js";
import { createTargetedAdapter } from "./targeted.js";
import type { SourceAdapter } from "./types.js";

export function createAutostartAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return createTargetedAdapter(filesystem, {
    id: "autostart",
    facadeSource: "autostart",
    source: "startup_items",
    map: (record) => ({
      evidenceKind: record.executableState === "absent"
        ? "missing_executable"
        : "startup_item",
      supportLevel: "analysis_only",
      allowedActions: [],
      safeExplanation: record.executableState === "absent"
        ? "Целевой executable отсутствует"
        : "Элемент автозапуска учтён как read-only evidence",
    }),
  });
}

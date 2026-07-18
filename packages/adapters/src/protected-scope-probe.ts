import type { FileSystemFacade } from "./filesystem-facade.js";
import { createTargetedAdapter } from "./targeted.js";
import type { SourceAdapter } from "./types.js";

export function createProtectedContainerAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return createTargetedAdapter(filesystem, {
    id: "protected-containers",
    facadeSource: "protected_containers",
    source: "protected_containers",
    map: () => ({
      evidenceKind: "protected_container_metadata",
      supportLevel: "analysis_only",
      allowedActions: [],
      safeExplanation: "Доступна только безопасная оболочка метаданных контейнера",
      recommendedMethod: "inspect_only",
    }),
  });
}

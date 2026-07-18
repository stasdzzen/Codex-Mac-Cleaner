import {
  ALLOWLISTED_LIBRARY_ROOTS,
  type AdapterFileEntry,
  type FileSystemFacade,
  type LibraryRoot,
} from "./filesystem-facade.js";
import { makeObservation } from "./observation.js";
import type { Observation, SourceAdapter } from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

function isCandidate(entry: AdapterFileEntry): boolean {
  return entry.volumeKind === "internal_apfs" && entry.protection.length === 0;
}

function supportFor(root: LibraryRoot): Observation["supportLevel"] {
  return root === "Group Containers" || root === "Preferences"
    ? "analysis_only"
    : "candidate";
}

function capabilityFor(root: LibraryRoot): string {
  return `library:${root.toLocaleLowerCase("en-US").replaceAll(" ", "_")}`;
}

export function createLibraryRootsAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return {
    id: "library-roots",
    source: "user_library_artifacts",
    async scan({ signal }) {
      const observations: Observation[] = [];
      const warnings = [];
      for (const root of ALLOWLISTED_LIBRARY_ROOTS) {
        signal.throwIfAborted();
        let entries: readonly AdapterFileEntry[];
        try {
          entries = await filesystem.listLibraryRoot(root, signal);
        } catch (error) {
          if (isAbortError(error)) throw error;
          warnings.push(toAdapterWarning(error, "user_library_artifacts", capabilityFor(root)));
          continue;
        }
        for (const entry of entries) {
          if (!isCandidate(entry)) continue;
          const supportLevel = supportFor(root);
          observations.push(makeObservation({
            targetRef: entry.ref,
            source: "user_library_artifacts",
            evidenceKind: "library_artifact",
            displayName: entry.displayName,
            supportLevel,
            allowedActions: supportLevel === "candidate" ? ["inspect"] : [],
            observedAt: entry.modifiedAt,
            fingerprint: entry.fingerprint,
            logicalSize: entry.logicalSize,
            physicalSize: entry.physicalSize,
            safeExplanation: supportLevel === "candidate"
              ? "Артефакт находится в разрешённом пользовательском источнике"
              : "Источник доступен только для безопасного анализа",
          }));
        }
      }
      return { observations, warnings };
    },
  };
}

export { ALLOWLISTED_LIBRARY_ROOTS } from "./filesystem-facade.js";

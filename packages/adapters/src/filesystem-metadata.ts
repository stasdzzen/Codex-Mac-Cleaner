import type { FileSystemFacade, TargetedRecord } from "./filesystem-facade.js";
import { makeObservation } from "./observation.js";
import type { Observation, SourceAdapter } from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

function observationFor(record: TargetedRecord): Observation {
  const disk = record.kind === "apfs_observation" || record.kind === "time_machine_observation";
  return makeObservation({
    targetRef: record.ref,
    source: disk ? "disk_observation" : "filesystem_metadata",
    evidenceKind: record.kind === "time_machine_observation"
      ? "time_machine_observation"
      : record.kind === "apfs_observation"
        ? "apfs_observation"
        : "filesystem_metadata",
    displayName: record.displayName,
    supportLevel: "analysis_only",
    allowedActions: [],
    observedAt: record.modifiedAt,
    fingerprint: record.fingerprint,
    logicalSize: record.logicalSize,
    physicalSize: record.physicalSize,
    safeExplanation: disk
      ? "Наблюдение состояния диска не является причинной оценкой очистки"
      : "Файловые метаданные собраны без изменения объекта",
  });
}

export function createFilesystemMetadataAdapter(filesystem: FileSystemFacade): SourceAdapter {
  return {
    id: "filesystem-and-disk-observations",
    source: "filesystem_metadata",
    async scan({ signal }) {
      const observations: Observation[] = [];
      const warnings = [];
      for (const source of ["filesystem", "disk"] as const) {
        try {
          const records = await filesystem.listTargetedSource(source, signal);
          observations.push(...records.map(observationFor));
        } catch (error) {
          if (isAbortError(error)) throw error;
          warnings.push(toAdapterWarning(
            error,
            source === "disk" ? "disk_observation" : "filesystem_metadata",
            source,
          ));
        }
      }
      return { observations, warnings };
    },
  };
}

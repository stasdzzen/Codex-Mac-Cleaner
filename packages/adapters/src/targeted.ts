import type { FileSystemFacade, TargetedRecord } from "./filesystem-facade.js";
import { makeObservation } from "./observation.js";
import type {
  AuditSource,
  EvidenceKind,
  Observation,
  SourceAdapter,
} from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

export interface TargetedAdapterSpec {
  readonly id: string;
  readonly facadeSource: string;
  readonly source: AuditSource;
  map(record: TargetedRecord): Readonly<{
    source?: AuditSource;
    evidenceKind: EvidenceKind;
    supportLevel: Observation["supportLevel"];
    allowedActions: Observation["allowedActions"];
    safeExplanation: string;
    recommendedMethod?: Observation["recommendedMethod"] | undefined;
  }>;
}

export function createTargetedAdapter(
  filesystem: FileSystemFacade,
  spec: TargetedAdapterSpec,
): SourceAdapter {
  return {
    id: spec.id,
    source: spec.source,
    async scan({ signal }) {
      try {
        const records = await filesystem.listTargetedSource(spec.facadeSource, signal);
        const observations = records.map((record) => {
          const mapped = spec.map(record);
          return makeObservation({
            targetRef: record.ref,
            source: mapped.source ?? spec.source,
            evidenceKind: mapped.evidenceKind,
            displayName: record.displayName,
            supportLevel: mapped.supportLevel,
            allowedActions: mapped.allowedActions,
            observedAt: record.modifiedAt,
            fingerprint: record.fingerprint,
            logicalSize: record.logicalSize,
            physicalSize: record.physicalSize,
            sensitivityFlags: record.sensitivityFlags,
            safeExplanation: mapped.safeExplanation,
            recommendedMethod: mapped.recommendedMethod,
          });
        });
        return { observations, warnings: [] };
      } catch (error) {
        if (isAbortError(error)) throw error;
        return {
          observations: [],
          warnings: [toAdapterWarning(error, spec.source, spec.id)],
        };
      }
    },
  };
}

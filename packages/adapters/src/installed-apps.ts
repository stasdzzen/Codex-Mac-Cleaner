import type { CommandRunner } from "./command-runner.js";
import { makeObservation, opaqueRef, safeDisplayName } from "./observation.js";
import type { Observation, SourceAdapter } from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

const INVENTORY_QUERY = "kMDItemContentType == 'com.apple.application-bundle'";

export function createInstalledAppsAdapter(commands: CommandRunner): SourceAdapter {
  return {
    id: "installed-apps",
    source: "application_inventory",
    async scan({ signal }) {
      try {
        const output = await commands.run("/usr/bin/mdfind", [INVENTORY_QUERY], { signal });
        if (output.exitCode !== 0) {
          return {
            observations: [],
            warnings: [toAdapterWarning(
              Object.assign(new Error("CAPABILITY_UNAVAILABLE"), { code: "ENOTSUP" }),
              "application_inventory",
              "installed-apps",
            )],
          };
        }
        const observedAt = new Date().toISOString();
        const observations: Observation[] = output.stdout
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((rawPath) => {
            const targetRef = opaqueRef("application", rawPath);
            return makeObservation({
              targetRef,
              source: "application_inventory",
              evidenceKind: "installed_app",
              displayName: safeDisplayName(rawPath, "Installed application"),
              supportLevel: "analysis_only",
              allowedActions: [],
              observedAt,
              fingerprint: opaqueRef("inventory", rawPath),
              safeExplanation: "Установленное приложение учтено как контрдоказательство",
            });
          });
        return { observations, warnings: [] };
      } catch (error) {
        if (isAbortError(error)) throw error;
        return {
          observations: [],
          warnings: [toAdapterWarning(error, "application_inventory", "installed-apps")],
        };
      }
    },
  };
}

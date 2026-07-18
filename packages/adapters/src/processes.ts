import type { CommandRunner } from "./command-runner.js";
import { makeObservation, opaqueRef, safeDisplayName } from "./observation.js";
import type { AuditSource, EvidenceKind, Observation, SourceAdapter } from "./types.js";
import { isAbortError, toAdapterWarning } from "./types.js";

interface CommandSpec {
  readonly capability: string;
  readonly executable: string;
  readonly argv: readonly string[];
  readonly source: AuditSource;
  readonly evidenceKind: EvidenceKind;
  readonly fallbackName: string;
}

const COMMANDS: readonly CommandSpec[] = [
  {
    capability: "process-activity",
    executable: "/bin/ps",
    argv: ["-axo", "pid=,comm="],
    source: "process_activity",
    evidenceKind: "process_activity",
    fallbackName: "Active process",
  },
  {
    capability: "open-files",
    executable: "/usr/sbin/lsof",
    argv: ["-nP", "-Fn", "-d", "cwd,txt"],
    source: "open_files",
    evidenceKind: "open_file",
    fallbackName: "Open file",
  },
  {
    capability: "tcp-listeners",
    executable: "/usr/sbin/lsof",
    argv: ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fn"],
    source: "process_activity",
    evidenceKind: "tcp_listener",
    fallbackName: "TCP listener",
  },
];

function safeLines(stdout: string, spec: CommandSpec): string[] {
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (spec.evidenceKind === "process_activity") return /^\d+\s+/u.test(line);
      return line.startsWith("n") && line.length > 1;
    })
    .map((line) => spec.evidenceKind === "process_activity"
      ? line.replace(/^\d+\s+/u, "")
      : line.slice(1));
}

export function createProcessEvidenceAdapter(commands: CommandRunner): SourceAdapter {
  return {
    id: "process-evidence",
    source: "process_activity",
    async scan({ signal }) {
      const observations: Observation[] = [];
      const warnings = [];
      for (const spec of COMMANDS) {
        signal.throwIfAborted();
        try {
          const output = await commands.run(spec.executable, spec.argv, { signal });
          if (output.exitCode !== 0) {
            warnings.push(toAdapterWarning(
              Object.assign(new Error("CAPABILITY_UNAVAILABLE"), { code: "ENOTSUP" }),
              spec.source,
              spec.capability,
            ));
            continue;
          }
          const observedAt = new Date().toISOString();
          for (const raw of safeLines(output.stdout, spec)) {
            const targetRef = opaqueRef(spec.capability, raw);
            observations.push(makeObservation({
              targetRef,
              source: spec.source,
              evidenceKind: spec.evidenceKind,
              displayName: spec.evidenceKind === "tcp_listener"
                ? spec.fallbackName
                : safeDisplayName(raw, spec.fallbackName),
              supportLevel: "analysis_only",
              allowedActions: [],
              observedAt,
              fingerprint: opaqueRef("process-evidence", `${spec.capability}:${raw}`),
              safeExplanation: "Активность учтена только как read-only evidence",
            }));
          }
        } catch (error) {
          if (isAbortError(error)) throw error;
          warnings.push(toAdapterWarning(error, spec.source, spec.capability));
        }
      }
      return { observations, warnings };
    },
  };
}

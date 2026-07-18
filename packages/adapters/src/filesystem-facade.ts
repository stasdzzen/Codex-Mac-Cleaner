import type { SensitivityFlag } from "./types.js";

export const ALLOWLISTED_LIBRARY_ROOTS = [
  "Caches",
  "Application Support",
  "Containers",
  "Group Containers",
  "Preferences",
  "Logs",
  "HTTPStorages",
  "WebKit",
  "Saved Application State",
] as const;

export type LibraryRoot = (typeof ALLOWLISTED_LIBRARY_ROOTS)[number];

export type ProtectionClass =
  | "system_scope"
  | "credentials"
  | "browser_profile"
  | "personal_data"
  | "current_project"
  | "plugin_state"
  | "codex_state"
  | "quarantine_state"
  | "local_git_project"
  | "developer_artifact";

export interface AdapterFileEntry {
  readonly ref: string;
  readonly displayName: string;
  readonly kind: "file" | "directory" | "bundle" | "plist" | "unknown";
  readonly logicalSize: number;
  readonly physicalSize: number;
  readonly modifiedAt: string;
  readonly fingerprint: string;
  readonly volumeKind: "internal_apfs" | "external" | "network" | "read_only" | "other";
  readonly protection: readonly ProtectionClass[];
}

export type TargetedRecordKind =
  | "login_item"
  | "background_item"
  | "launch_item"
  | "receipt"
  | "official_uninstaller"
  | "filesystem_metadata"
  | "apfs_observation"
  | "time_machine_observation"
  | "protected_container"
  | "relocated_item"
  | "system_helper"
  | "launch_daemon"
  | "framework"
  | "printer_remnant"
  | "vpn_remnant"
  | "service"
  | "snapshot";

export interface TargetedRecord {
  readonly ref: string;
  readonly displayName: string;
  readonly kind: TargetedRecordKind;
  readonly modifiedAt: string;
  readonly fingerprint: string;
  readonly executableState?: "present" | "absent" | "unknown";
  readonly stale?: boolean;
  readonly recommendedMethod?: "official_uninstaller" | "advanced_mode" | "inspect_only";
  readonly logicalSize?: number;
  readonly physicalSize?: number;
  readonly sensitivityFlags?: readonly SensitivityFlag[];
}

/**
 * Read-only by construction: arbitrary paths and write operations are absent.
 */
export interface FileSystemFacade {
  listLibraryRoot(
    root: LibraryRoot,
    signal: AbortSignal,
  ): Promise<readonly AdapterFileEntry[]>;
  listTargetedSource(
    kind: string,
    signal: AbortSignal,
  ): Promise<readonly TargetedRecord[]>;
}

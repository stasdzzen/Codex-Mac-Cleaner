import type { Classification } from "@codex-mac-cleaner/classifier";
import type { EvidenceSet } from "@codex-mac-cleaner/evidence";
import type { ProtectedScopeKind } from "./protected-scopes.js";

export type AllowedAction =
  | "inspect"
  | "reveal"
  | "exclude"
  | "prepare_move"
  | "prepare_restore"
  | "prepare_purge";

export type FindingCategory =
  | "cache"
  | "log"
  | "webkit"
  | "http_storage"
  | "saved_state"
  | "application_support"
  | "container"
  | "group_container"
  | "preference"
  | "database"
  | "sync_data"
  | "vpn_data"
  | "personal_file"
  | "autostart"
  | "unknown";

export type SensitivityFlag =
  | "credentials"
  | "tokens"
  | "subscription_url"
  | "personal_data"
  | "database"
  | "local_project";

export interface SnapshotFingerprint {
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly size: number;
  readonly mtimeNs: string;
  readonly ctimeNs: string;
  readonly fileType: PathFileType;
  readonly mountId: string;
  readonly symbolicLink: boolean;
  readonly linkCount: number;
}

export type ExclusionMatch =
  | Readonly<{ status: "none" }>
  | Readonly<{ status: "matched"; exclusionId: string }>
  | Readonly<{
      status: "identity_mismatch";
      errorCode: "EXCLUSION_IDENTITY_MISMATCH";
    }>
  | Readonly<{
      status: "invalid";
      errorCode: "EXCLUSION_STATE_INVALID";
    }>;

export type PathGuardErrorCode =
  | "PATH_NOT_ABSOLUTE"
  | "PATH_NUL"
  | "PATH_TRAVERSAL"
  | "PATH_INVALID"
  | "PATH_OUTSIDE_ALLOWLIST"
  | "PATH_ANCESTRY_INCOMPLETE"
  | "PATH_ANCESTRY_NOT_DIRECTORY"
  | "PATH_UNKNOWN_FILE_TYPE"
  | "SYMLINK_BOUNDARY"
  | "PATH_OWNER_MISMATCH"
  | "PATH_TYPE_MISMATCH"
  | "HARDLINK_ANOMALY"
  | "MOUNT_POINT_DETECTED"
  | "CROSS_VOLUME"
  | "PROTECT_LOCAL_GIT_REPOSITORY";

export type PathValidationResult =
  | Readonly<{ ok: true; canonicalPath: string }>
  | Readonly<{ ok: false; errorCode: PathGuardErrorCode }>;

export interface PolicyInput {
  readonly classification: Classification;
  readonly evidenceSet: EvidenceSet;
  readonly supportLevel: "candidate" | "analysis_only" | "unsupported_manual";
  readonly category: FindingCategory;
  readonly sensitivityFlags: readonly SensitivityFlag[];
  readonly protectedScopeKinds: readonly ProtectedScopeKind[];
  readonly exclusionMatch: ExclusionMatch;
  readonly officialUninstallerApplicable: boolean;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly currentFingerprint: SnapshotFingerprint;
  readonly pathValidation: PathValidationResult;
}

export interface PolicyDecision {
  readonly allowedActions: readonly AllowedAction[];
  readonly blockingRuleIds: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedFingerprint: SnapshotFingerprint;
}

export type PathFileType =
  | "file"
  | "directory"
  | "bundle"
  | "plist"
  | "unknown";

export interface PathAncestryEntry {
  readonly canonicalPath: string;
  readonly uid: number;
  readonly device: string;
  readonly mountId: string;
  readonly fileType: PathFileType;
  readonly symbolicLink: boolean;
  readonly mountPoint: boolean;
  readonly linkCount: number;
  readonly gitMarker: "file" | "directory" | null;
}

export interface PathGuardInput {
  readonly root: string;
  readonly candidate: string;
  readonly expectedOwnerUid: number;
  readonly expectedDevice: string;
  readonly expectedMountId: string;
  readonly expectedFileType: PathFileType;
  readonly ancestry: readonly PathAncestryEntry[];
}

export type RecommendedRemovalMethod =
  | "quarantine"
  | "official_uninstaller"
  | "advanced_mode"
  | "inspect_only";

export interface UserExclusionCandidateIdentity {
  readonly ruleId: string;
  readonly artifactKind:
    | "file"
    | "directory"
    | "bundle"
    | "plist"
    | "launch_item"
    | "receipt"
    | "unknown";
  readonly normalizedTargetIdentity: string;
  readonly bundleId?: string | null | undefined;
  readonly packageId?: string | null | undefined;
  readonly signingIdentity?: string | null | undefined;
  readonly ownerTypeFingerprint: string;
}

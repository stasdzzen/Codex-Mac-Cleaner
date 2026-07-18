import type { Classification } from "@codex-mac-cleaner/classifier";

import type {
  PathGuardInput,
  PolicyInput,
  SnapshotFingerprint,
} from "../src/index.js";

export const syntheticRoot = "/synthetic/Library/Caches";
export const syntheticCandidate = `${syntheticRoot}/artifact-a`;

export const orphanedClassification: Classification = {
  label: "orphaned",
  confidence: "high",
  ruleIds: ["CLASSIFIER_V1_ORPHANED_COMPLETE_EVIDENCE"],
  explanation: "Полный независимый набор доказательств указывает на остаток",
  counterEvidence: [],
  missingEvidence: [],
};

export const snapshotFingerprint: SnapshotFingerprint = {
  device: "device-a",
  inode: "inode-a",
  mode: 0o700,
  uid: 501,
  gid: 20,
  size: 84,
  mtimeNs: "1000000",
  ctimeNs: "1000000",
  fileType: "directory",
  mountId: "mount-a",
  symbolicLink: false,
  linkCount: 2,
};

export const safePathGuardInput: PathGuardInput = {
  root: syntheticRoot,
  candidate: syntheticCandidate,
  expectedOwnerUid: 501,
  expectedDevice: "device-a",
  expectedMountId: "mount-a",
  expectedFileType: "directory",
  ancestry: [
    {
      canonicalPath: syntheticRoot,
      uid: 501,
      device: "device-a",
      mountId: "mount-a",
      fileType: "directory",
      symbolicLink: false,
      mountPoint: false,
      linkCount: 2,
      gitMarker: null,
    },
    {
      canonicalPath: syntheticCandidate,
      uid: 501,
      device: "device-a",
      mountId: "mount-a",
      fileType: "directory",
      symbolicLink: false,
      mountPoint: false,
      linkCount: 2,
      gitMarker: null,
    },
  ],
};

export const safeFinding: PolicyInput = {
  classification: orphanedClassification,
  supportLevel: "candidate",
  category: "cache",
  sensitivityFlags: [],
  ownerIdentityState: "confirmed",
  installedState: "absent",
  activityState: "absent",
  openFileState: "absent",
  targetExistenceState: "present",
  receiptState: "absent",
  dependencyState: "absent",
  temporalState: "current",
  dataKindState: "known",
  capabilityState: "available",
  protectedScopeKinds: [],
  exclusionMatch: { status: "none" },
  officialUninstallerApplicable: false,
  snapshotFingerprint,
  currentFingerprint: snapshotFingerprint,
  pathValidation: {
    ok: true,
    canonicalPath: syntheticCandidate,
  },
};

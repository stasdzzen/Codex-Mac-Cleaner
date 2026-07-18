import { posix } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validateMutationPath } from "../src/index.js";
import {
  safePathGuardInput,
  syntheticCandidate,
  syntheticRoot,
} from "./fixtures.js";

describe("validateMutationPath fail closed", () => {
  it("принимает валидную ancestry без follow-symlink", () => {
    expect(validateMutationPath(safePathGuardInput)).toEqual({
      ok: true,
      canonicalPath: syntheticCandidate,
    });
  });

  it.each([
    ["relative/path", "PATH_NOT_ABSOLUTE"],
    [`${syntheticRoot}/artifact\0escape`, "PATH_NUL"],
    [`${syntheticRoot}/../Preferences/artifact`, "PATH_TRAVERSAL"],
    ["/synthetic/outside/artifact", "PATH_OUTSIDE_ALLOWLIST"],
  ] as const)("блокирует path case %s", (candidate, errorCode) => {
    expect(validateMutationPath({ ...safePathGuardInput, candidate })).toEqual({
      ok: false,
      errorCode,
    });
  });

  it("блокирует symlink в ancestry", () => {
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === 0 ? { ...entry, symbolicLink: true } : entry,
    );

    expect(validateMutationPath({ ...safePathGuardInput, ancestry })).toEqual({
      ok: false,
      errorCode: "SYMLINK_BOUNDARY",
    });
  });

  it("блокирует hardlink anomaly обычного файла", () => {
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === safePathGuardInput.ancestry.length - 1
        ? { ...entry, fileType: "file" as const, linkCount: 2 }
        : entry,
    );

    expect(
      validateMutationPath({
        ...safePathGuardInput,
        expectedFileType: "file",
        ancestry,
      }),
    ).toEqual({ ok: false, errorCode: "HARDLINK_ANOMALY" });
  });

  it("блокирует unknown у final entry даже при совпавшем expectedFileType", () => {
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === safePathGuardInput.ancestry.length - 1
        ? { ...entry, fileType: "unknown" as const }
        : entry,
    );

    expect(
      validateMutationPath({
        ...safePathGuardInput,
        expectedFileType: "unknown",
        ancestry,
      }),
    ).toEqual({ ok: false, errorCode: "PATH_UNKNOWN_FILE_TYPE" });
  });

  it.each(["file", "plist", "unknown"] as const)(
    "блокирует недопустимый intermediate ancestry type %s",
    (fileType) => {
      const candidate = `${syntheticCandidate}/nested`;
      const ancestry = [
        safePathGuardInput.ancestry[0]!,
        { ...safePathGuardInput.ancestry[1]!, fileType },
        {
          ...safePathGuardInput.ancestry[1]!,
          canonicalPath: candidate,
        },
      ];

      expect(
        validateMutationPath({
          ...safePathGuardInput,
          candidate,
          ancestry,
        }),
      ).toEqual({ ok: false, errorCode: "PATH_ANCESTRY_NOT_DIRECTORY" });
    },
  );

  it("блокирует hardlink anomaly для plist как regular-file semantic type", () => {
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === safePathGuardInput.ancestry.length - 1
        ? { ...entry, fileType: "plist" as const, linkCount: 2 }
        : entry,
    );

    expect(
      validateMutationPath({
        ...safePathGuardInput,
        expectedFileType: "plist",
        ancestry,
      }),
    ).toEqual({ ok: false, errorCode: "HARDLINK_ANOMALY" });
  });

  it.each([
    ["uid", 502, "PATH_OWNER_MISMATCH"],
    ["mountPoint", true, "MOUNT_POINT_DETECTED"],
    ["device", "device-b", "CROSS_VOLUME"],
    ["mountId", "mount-b", "CROSS_VOLUME"],
    ["fileType", "file", "PATH_TYPE_MISMATCH"],
  ] as const)("блокирует anomaly %s", (field, value, errorCode) => {
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === safePathGuardInput.ancestry.length - 1
        ? { ...entry, [field]: value }
        : entry,
    );

    expect(validateMutationPath({ ...safePathGuardInput, ancestry })).toEqual({
      ok: false,
      errorCode,
    });
  });

  it.each(["file", "directory"] as const)(
    "блокирует local Git marker %s в ancestry",
    (gitMarker) => {
      const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
        index === 0 ? { ...entry, gitMarker } : entry,
      );

      expect(validateMutationPath({ ...safePathGuardInput, ancestry })).toEqual({
        ok: false,
        errorCode: "PROTECT_LOCAL_GIT_REPOSITORY",
      });
    },
  );

  it("не расширяет shell-подобные сегменты", () => {
    const candidate = `${syntheticRoot}/$SYNTHETIC_ROOT`;
    const ancestry = safePathGuardInput.ancestry.map((entry, index) =>
      index === safePathGuardInput.ancestry.length - 1
        ? { ...entry, canonicalPath: candidate }
        : entry,
    );

    expect(validateMutationPath({ ...safePathGuardInput, candidate, ancestry })).toEqual({
      ok: true,
      canonicalPath: candidate,
    });
  });

  it("property: результат остаётся внутри root либо блокируется", () => {
    fc.assert(
      fc.property(fc.string(), (segment) => {
        const candidate = `${syntheticRoot}/${segment}`;
        const expectedParts = posix
          .relative(syntheticRoot, posix.normalize(candidate))
          .split("/")
          .filter(Boolean);
        const ancestry = [
          safePathGuardInput.ancestry[0]!,
          ...expectedParts.map((_, index) => ({
            ...safePathGuardInput.ancestry[1]!,
            canonicalPath: posix.join(
              syntheticRoot,
              ...expectedParts.slice(0, index + 1),
            ),
          })),
        ];
        const result = validateMutationPath({
          ...safePathGuardInput,
          candidate,
          ancestry,
        });

        return result.ok
          ? result.canonicalPath.startsWith(`${syntheticRoot}/`)
          : true;
      }),
      { numRuns: 500 },
    );
  });
});

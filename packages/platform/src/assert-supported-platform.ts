export interface PlatformInput {
  platform: string;
  arch: string;
  release: string;
}

const MIN_SUPPORTED_MACOS_MAJOR = 26;
const RELEASE_PATTERN = /^\d+(?:\.\d+)*$/u;

function parseReleaseMajor(release: string): number | undefined {
  if (!RELEASE_PATTERN.test(release)) return undefined;

  const major = Number(release.split(".")[0]);
  return Number.isSafeInteger(major) ? major : undefined;
}

export function assertSupportedPlatform(input: PlatformInput): void {
  if (input.platform !== "darwin") throw new Error("UNSUPPORTED_PLATFORM");
  if (input.arch !== "arm64") throw new Error("UNSUPPORTED_ARCH");

  const major = parseReleaseMajor(input.release);
  if (major === undefined || major < MIN_SUPPORTED_MACOS_MAJOR) {
    throw new Error("UNSUPPORTED_MACOS");
  }
}

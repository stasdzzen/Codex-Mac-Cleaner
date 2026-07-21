import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const approvedSpdxLicenses = Object.freeze([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
  "MPL-2.0",
]);

export const thirdPartyNoticesPath = "docs/release/third-party-notices.json";
export const pluginAllowlistPath = ".codex-plugin/package-allowlist.json";
export const repositoryMarketplaceFiles = Object.freeze([
  ".codex-plugin/plugin.json",
  pluginAllowlistPath,
  ".codex-plugin/runtime/server.js",
  ".codex-plugin/assets/dashboard-v2.html",
  ".mcp.json",
  "skills/codex-mac-cleaner/SKILL.md",
  "skills/codex-mac-cleaner-update/SKILL.md",
  "scripts/codex-mac-cleaner-update.mjs",
  "LICENSE",
  thirdPartyNoticesPath,
]);

const approvedLicenseSet = new Set(approvedSpdxLicenses);
const noticeFilePattern = /(?:^|[-_.])(?:licen[cs]e|copying|notice)(?:$|[-_.])/iu;
const explicitNoticeFallbacks = new Map([
  ["react-remove-scroll-bar\0" + "2.3.8", "react-remove-scroll\0" + "2.7.2"],
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function packageUrl(name, version) {
  const encodedName = encodeURIComponent(name).replaceAll("%2F", "/");
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

export function assertApprovedSpdxLicense(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("DEPENDENCY_LICENSE_MISSING");
  }
  const normalized = value.trim();
  if (!approvedLicenseSet.has(normalized)) {
    throw new Error(`DEPENDENCY_LICENSE_NOT_APPROVED:${normalized}`);
  }
  return normalized;
}

async function readPackageIdentity(directory) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    return { name: manifest.name, version: manifest.version };
  } catch {
    return null;
  }
}

async function installedDirectoriesFor(item, version) {
  const matches = [];
  for (const directory of item.paths ?? []) {
    if (typeof directory !== "string") continue;
    const identity = await readPackageIdentity(directory);
    if (identity?.name === item.name && identity.version === version) matches.push(directory);
  }
  return [...new Set(matches)].sort(compareText);
}

async function readNoticeSet(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && noticeFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareText);
  const notices = [];
  for (const fileName of fileNames) {
    const text = (await readFile(join(directory, fileName), "utf8"))
      .replaceAll("\r\n", "\n")
      .trimEnd();
    if (text === "") throw new Error(`DEPENDENCY_NOTICE_EMPTY:${fileName}`);
    notices.push({ fileName, text: `${text}\n` });
  }
  return notices;
}

function fallbackComponentKey(name, version) {
  if (version === "1.1.5" && /^@rolldown\/binding-/u.test(name)) {
    return `rolldown\0${version}`;
  }
  return explicitNoticeFallbacks.get(`${name}\0${version}`) ?? null;
}

async function noticesForComponent(componentKey, componentDirectories, directoriesByKey) {
  const noticeSets = [];
  for (const directory of componentDirectories) noticeSets.push(await readNoticeSet(directory));
  if (
    noticeSets.some((set) => set.length === 0) &&
    noticeSets.some((set) => set.length > 0)
  ) {
    throw new Error(`DEPENDENCY_NOTICE_AMBIGUOUS:${componentKey}`);
  }
  if (noticeSets.every((set) => set.length === 0)) {
    const separator = componentKey.lastIndexOf("\0");
    const fallbackKey = fallbackComponentKey(
      componentKey.slice(0, separator),
      componentKey.slice(separator + 1),
    );
    const fallbackDirectories = fallbackKey === null ? [] : directoriesByKey.get(fallbackKey) ?? [];
    const fallbackSets = [];
    for (const directory of fallbackDirectories) fallbackSets.push(await readNoticeSet(directory));
    if (fallbackSets.some((set) => set.length === 0)) {
      throw new Error(`DEPENDENCY_NOTICE_MISSING:${componentKey}`);
    }
    noticeSets.push(...fallbackSets);
  }
  const nonEmptySets = noticeSets.filter((set) => set.length > 0);
  if (nonEmptySets.length === 0) throw new Error(`DEPENDENCY_NOTICE_MISSING:${componentKey}`);
  const signatures = new Set(
    nonEmptySets.map((set) =>
      set
        .map(({ text }) => sha256(text))
        .sort(compareText)
        .join(","),
    ),
  );
  if (signatures.size !== 1) throw new Error(`DEPENDENCY_NOTICE_AMBIGUOUS:${componentKey}`);
  return nonEmptySets[0];
}

export async function createReleaseLicenseMetadata(repositoryRoot) {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["licenses", "list", "--prod", "--json"],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const inventory = JSON.parse(stdout);
  if (typeof inventory !== "object" || inventory === null || Array.isArray(inventory)) {
    throw new Error("DEPENDENCY_LICENSE_INVENTORY_INVALID");
  }

  const records = [];
  for (const [groupLicense, items] of Object.entries(inventory)) {
    const license = assertApprovedSpdxLicense(groupLicense);
    if (!Array.isArray(items)) throw new Error(`DEPENDENCY_LICENSE_GROUP_INVALID:${license}`);
    for (const item of items) {
      if (typeof item?.name !== "string" || !Array.isArray(item.versions)) {
        throw new Error(`DEPENDENCY_LICENSE_COMPONENT_INVALID:${license}`);
      }
      if (assertApprovedSpdxLicense(item.license) !== license) {
        throw new Error(`DEPENDENCY_LICENSE_AMBIGUOUS:${item.name}`);
      }
      for (const version of item.versions) {
        if (typeof version !== "string" || version === "") {
          throw new Error(`DEPENDENCY_VERSION_MISSING:${item.name}`);
        }
        const directories = await installedDirectoriesFor(item, version);
        if (directories.length === 0) {
          throw new Error(`DEPENDENCY_NOT_INSTALLED:${item.name}@${version}`);
        }
        records.push({ name: item.name, version, license, directories });
      }
    }
  }
  records.sort((left, right) =>
    compareText(`${left.name}\0${left.version}`, `${right.name}\0${right.version}`),
  );

  const directoriesByKey = new Map(
    records.map((record) => [`${record.name}\0${record.version}`, record.directories]),
  );
  const seenComponents = new Set();
  const noticeMap = new Map();
  const components = [];
  for (const record of records) {
    const componentKey = `${record.name}\0${record.version}`;
    if (seenComponents.has(componentKey)) {
      throw new Error(`DEPENDENCY_LICENSE_AMBIGUOUS:${record.name}@${record.version}`);
    }
    seenComponents.add(componentKey);
    const notices = await noticesForComponent(componentKey, record.directories, directoriesByKey);
    const noticeIds = [];
    for (const notice of notices) {
      const hash = sha256(notice.text);
      const id = `sha256:${hash}`;
      noticeIds.push(id);
      const existing = noticeMap.get(id);
      if (existing === undefined) {
        noticeMap.set(id, { id, sha256: hash, fileNames: new Set([notice.fileName]), text: notice.text });
      } else {
        existing.fileNames.add(notice.fileName);
      }
    }
    const bomRef = packageUrl(record.name, record.version);
    components.push({
      bomRef,
      name: record.name,
      version: record.version,
      license: record.license,
      noticeIds: [...new Set(noticeIds)].sort(compareText),
    });
  }

  const notices = [...noticeMap.values()]
    .map((notice) => ({
      id: notice.id,
      sha256: notice.sha256,
      fileNames: [...notice.fileNames].sort(compareText),
      text: notice.text,
    }))
    .sort((left, right) => compareText(left.id, right.id));
  const lockfileSha256 = sha256(await readFile(join(repositoryRoot, "pnpm-lock.yaml")));
  const noticesDocument = {
    schemaVersion: 1,
    source: {
      command: "pnpm licenses list --prod --json",
      lockfile: "pnpm-lock.yaml",
      lockfileSha256,
    },
    compatibilityPolicy: {
      approvedSpdxLicenses,
      notes: {
        "MPL-2.0":
          "Сохранён file-level license notice; этот технический gate не делает более широких юридических заявлений.",
      },
    },
    components,
    notices,
  };
  const serializedNotices = stableJson(noticesDocument);
  if (
    /\/Users\/|\/home\/|[A-Za-z]:\\Users\\|(?:^|["\s])node_modules\//u.test(
      serializedNotices,
    )
  ) {
    throw new Error("DEPENDENCY_NOTICE_PRIVACY_VIOLATION");
  }

  return {
    components,
    noticesDocument,
    noticesText: serializedNotices,
    allowlistDocument: { schemaVersion: 1, files: repositoryMarketplaceFiles },
    allowlistText: stableJson({ schemaVersion: 1, files: repositoryMarketplaceFiles }),
  };
}

export async function writeReleaseLicenseMetadata(outputRoot, metadata) {
  for (const [path, content] of [
    [pluginAllowlistPath, metadata.allowlistText],
    [thirdPartyNoticesPath, metadata.noticesText],
  ]) {
    const target = join(outputRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

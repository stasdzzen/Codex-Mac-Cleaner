import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir, userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import {
  createReleaseLicenseMetadata,
  thirdPartyNoticesPath,
  writeReleaseLicenseMetadata,
} from "./release-license-metadata.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const verifyOnly = process.argv.includes("--verify-only");
const outputDirectoryIndex = process.argv.indexOf("--output-dir");
const outputDirectoryArgument =
  outputDirectoryIndex >= 0 ? process.argv[outputDirectoryIndex + 1] : undefined;

if (!verifyOnly && outputDirectoryArgument === undefined) {
  throw new Error("Укажите --verify-only или явный --output-dir.");
}
if (outputDirectoryIndex >= 0 && outputDirectoryArgument === undefined) {
  throw new Error("OUTPUT_DIRECTORY_REQUIRED");
}

const releaseVersion = "0.1.0-beta.3";
const artifactName = `codex-mac-cleaner-v${releaseVersion}.tar`;
const builtEntries = new Set([
  ".codex-plugin/assets/dashboard-v2.html",
  ".codex-plugin/package-allowlist.json",
  ".codex-plugin/runtime/server.js",
  thirdPartyNoticesPath,
]);
const productionEntries = [
  ".codex-plugin/assets/dashboard-v2.html",
  ".codex-plugin/package-allowlist.json",
  ".codex-plugin/plugin.json",
  ".codex-plugin/runtime/server.js",
  ".mcp.json",
  "LICENSE",
  "README.md",
  "skills/codex-mac-cleaner/SKILL.md",
  thirdPartyNoticesPath,
].sort();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function git(...arguments_) {
  const { stdout } = await execFileAsync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  return stdout.trim();
}

async function buildPlugin(outputRoot, releaseMetadata) {
  await execFileAsync(
    process.execPath,
    [
      join(repositoryRoot, "apps/mcp-server/scripts/build-plugin-runtime.mjs"),
      "--output-root",
      outputRoot,
      "--skip-release-metadata",
    ],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  await writeReleaseLicenseMetadata(outputRoot, releaseMetadata);
}

function createSbom(components) {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      tools: {
        components: [
          {
            type: "application",
            name: "scripts/package-release.mjs",
            version: "1",
          },
        ],
      },
      component: {
        type: "application",
        "bom-ref": `pkg:generic/codex-mac-cleaner@${releaseVersion}`,
        name: "codex-mac-cleaner",
        version: releaseVersion,
        licenses: [{ license: { id: "Apache-2.0" } }],
      },
    },
    components: components.map((component) => ({
      type: "library",
      "bom-ref": component.bomRef,
      name: component.name,
      version: component.version,
      purl: component.bomRef,
      licenses: [{ license: { id: component.license } }],
    })),
  };
}

async function writeProductionFiles(buildRoot, stagingRoot) {
  for (const entry of productionEntries) {
    const sourceRoot = builtEntries.has(entry) ? buildRoot : repositoryRoot;
    const source = join(sourceRoot, entry);
    const target = join(stagingRoot, entry);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}

async function readEntries(stagingRoot, names) {
  return Promise.all(
    names.map(async (name) => ({ name, content: await readFile(join(stagingRoot, name)) })),
  );
}

function assertPublicPackage(entries) {
  const currentHome = homedir();
  const currentUser = userInfo().username;
  const forbiddenPathPatterns = [
    /\/Users\/[A-Za-z0-9._-]+\//u,
    /\/home\/[A-Za-z0-9._-]+\//u,
    /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/u,
  ];
  const forbiddenSecretPatterns = [
    /\bgh[opsu]_[A-Za-z0-9]{20,}\b/u,
    /\bAKIA[0-9A-Z]{16}\b/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  ];

  for (const { name, content } of entries) {
    if (/\.map$|(?:^|\/)tests?\/|(?:^|\/)fixtures?\//iu.test(name)) {
      throw new Error(`PACKAGE_FORBIDDEN_ENTRY:${name}`);
    }
    const text = content.toString("utf8");
    if (
      text.includes(`${currentHome}/`) ||
      new RegExp(`\\b${currentUser.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u").test(
        text,
      ) ||
      [...forbiddenPathPatterns, ...forbiddenSecretPatterns].some((pattern) =>
        pattern.test(text),
      )
    ) {
      throw new Error(`PACKAGE_PRIVACY_VIOLATION:${name}`);
    }
  }
}

function writeOctal(header, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 1, "0");
  header.write(encoded, offset, length - 1, "ascii");
  header[offset + length - 1] = 0;
}

function tarHeader(name, size, epoch) {
  const nameBytes = Buffer.from(name, "utf8");
  if (nameBytes.length > 100) throw new Error(`TAR_PATH_TOO_LONG:${name}`);
  const header = Buffer.alloc(512);
  nameBytes.copy(header, 0);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, epoch);
  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write("root", 265, 4, "ascii");
  header.write("root", 297, 4, "ascii");
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(checksum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function createTar(entries, epoch) {
  const chunks = [];
  for (const { name, content } of [...entries].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    chunks.push(tarHeader(name, content.length, epoch), content);
    const padding = (512 - (content.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

async function assembleOnce(root, context) {
  const buildRoot = join(root, "build");
  const stagingRoot = join(root, "staging");
  await buildPlugin(buildRoot, context.releaseMetadata);
  await writeProductionFiles(buildRoot, stagingRoot);

  const sbomName = "release-evidence/sbom.cdx.json";
  await mkdir(join(stagingRoot, "release-evidence"), { recursive: true });
  await writeFile(join(stagingRoot, sbomName), stableJson(context.sbom), "utf8");

  const subjectEntries = await readEntries(stagingRoot, [...productionEntries, sbomName]);
  const provenanceName = "release-evidence/provenance.json";
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    subject: subjectEntries.map(({ name, content }) => ({
      name,
      digest: { sha256: sha256(content) },
    })),
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://github.com/stasdzzen/Codex-Mac-Cleaner/package-release/v1",
        externalParameters: {},
        resolvedDependencies: [
          {
            uri: "git+https://github.com/stasdzzen/Codex-Mac-Cleaner",
            digest: { gitCommit: context.commit },
          },
        ],
      },
      runDetails: {
        builder: {
          id: "https://github.com/stasdzzen/Codex-Mac-Cleaner/scripts/package-release.mjs",
        },
        metadata: {
          invocationId: `commit:${context.commit}`,
          startedOn: context.timestamp,
          finishedOn: context.timestamp,
        },
      },
    },
  };
  await writeFile(join(stagingRoot, provenanceName), stableJson(provenance), "utf8");

  const names = [...productionEntries, sbomName, provenanceName].sort();
  const entries = await readEntries(stagingRoot, names);
  assertPublicPackage(entries);
  const archive = createTar(entries, context.epoch);
  return {
    archive,
    names,
    fileHashes: entries.map(({ name, content }) => `${sha256(content)}  ${name}`),
  };
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "cmc-release-package-"));
try {
  const commit = await git("rev-parse", "HEAD");
  const epochText =
    process.env.SOURCE_DATE_EPOCH ?? (await git("show", "-s", "--format=%ct", "HEAD"));
  const epoch = Number(epochText);
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error("INVALID_SOURCE_DATE_EPOCH");
  const releaseMetadata = await createReleaseLicenseMetadata(repositoryRoot);
  const context = {
    commit,
    epoch,
    timestamp: new Date(epoch * 1000).toISOString(),
    releaseMetadata,
    sbom: createSbom(releaseMetadata.components),
  };
  const first = await assembleOnce(join(temporaryRoot, "first"), context);
  const second = await assembleOnce(join(temporaryRoot, "second"), context);
  const firstHash = sha256(first.archive);
  const secondHash = sha256(second.archive);
  if (
    firstHash !== secondHash ||
    JSON.stringify(first.names) !== JSON.stringify(second.names) ||
    JSON.stringify(first.fileHashes) !== JSON.stringify(second.fileHashes)
  ) {
    throw new Error("PACKAGE_NOT_DETERMINISTIC");
  }

  const destination = verifyOnly
    ? join(temporaryRoot, "verified")
    : resolve(repositoryRoot, outputDirectoryArgument);
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, artifactName), first.archive);
  await writeFile(
    join(destination, `${artifactName}.sha256`),
    `${firstHash}  ${artifactName}\n`,
    "utf8",
  );
  await writeFile(
    join(destination, "file-checksums.sha256"),
    `${first.fileHashes.join("\n")}\n`,
    "utf8",
  );

  process.stdout.write(
    [
      "CMC-10 deterministic package: PASS",
      `commit: ${commit}`,
      `artifact: ${basename(artifactName)}`,
      `sha256: ${firstHash}`,
      `files: ${first.names.length}`,
      `mode: ${verifyOnly ? "verify-only" : "explicit-output"}`,
    ].join("\n") + "\n",
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

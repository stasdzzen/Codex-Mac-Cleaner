import * as realChildProcess from "node:child_process";
import * as realFileSystem from "node:fs/promises";
import { registerHooks } from "node:module";

const CHILD_PROCESS_URL = "cmc-test:child-process";
const FILE_SYSTEM_URL = "cmc-test:fs-promises";
const EMPTY_DIRECTORY_ROOTS = new Set([
  "/Applications",
  "/System/Applications",
  "/Library/LaunchAgents",
  "/Library/LaunchDaemons",
]);

globalThis.__cmcCompiledRuntimeRealChildProcess = realChildProcess;
globalThis.__cmcCompiledRuntimeRealFileSystem = realFileSystem;
globalThis.__cmcCompiledRuntimeEmptyDirectoryRoots = EMPTY_DIRECTORY_ROOTS;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "node:child_process") {
      return { url: CHILD_PROCESS_URL, shortCircuit: true };
    }
    if (specifier === "node:fs/promises") {
      return { url: FILE_SYSTEM_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === CHILD_PROCESS_URL) {
      return {
        format: "module",
        shortCircuit: true,
        source: String.raw`
          const real = globalThis.__cmcCompiledRuntimeRealChildProcess;
          export function execFileSync(executable, argv, options) {
            if (executable === "/usr/bin/sw_vers") return "26.0.0\n";
            return real.execFileSync(executable, argv, options);
          }
          export function execFile(executable, argv, options, callback) {
            if (
              executable === "/bin/ps" ||
              executable === "/usr/sbin/lsof" ||
              executable === "/usr/sbin/pkgutil"
            ) {
              queueMicrotask(() => callback(null, "", ""));
              return { kill() {} };
            }
            queueMicrotask(() => {
              const error = Object.assign(new Error("TEST_BOUNDARY_COMMAND_DENIED"), {
                code: "EACCES",
              });
              callback(error, "", "");
            });
            return { kill() {} };
          }
        `,
      };
    }
    if (url === FILE_SYSTEM_URL) {
      return {
        format: "module",
        shortCircuit: true,
        source: String.raw`
          const real = globalThis.__cmcCompiledRuntimeRealFileSystem;
          const emptyRoots = globalThis.__cmcCompiledRuntimeEmptyDirectoryRoots;
          export const chmod = real.chmod;
          export const lstat = real.lstat;
          export const mkdir = real.mkdir;
          export const open = real.open;
          export const readFile = real.readFile;
          export const realpath = real.realpath;
          export const rename = real.rename;
          export const rmdir = real.rmdir;
          export const statfs = real.statfs;
          export const unlink = real.unlink;
          export async function readdir(path, options) {
            if (emptyRoots.has(String(path))) return [];
            return real.readdir(path, options);
          }
        `,
      };
    }
    return nextLoad(url, context);
  },
});

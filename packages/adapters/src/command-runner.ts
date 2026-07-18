import { execFile } from "node:child_process";

export interface CommandOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface ArgvExecutorOptions {
  readonly signal: AbortSignal;
  readonly shell: false;
}

export type ArgvExecutor = (
  executable: string,
  argv: readonly string[],
  options: ArgvExecutorOptions,
) => Promise<CommandOutput>;

export interface CommandRunner {
  run(
    executable: string,
    argv: readonly string[],
    options: Readonly<{ signal: AbortSignal }>,
  ): Promise<CommandOutput>;
}

function validateToken(value: string): void {
  if (value.length === 0 || value.includes("\0")) {
    throw Object.assign(new TypeError("INVALID_ARGV_TOKEN"), { code: "EINVAL" });
  }
}

export function createCommandRunner(executor: ArgvExecutor): CommandRunner {
  return {
    async run(executable, argv, { signal }) {
      signal.throwIfAborted();
      validateToken(executable);
      if (!Array.isArray(argv)) {
        throw Object.assign(new TypeError("ARGV_ARRAY_REQUIRED"), { code: "EINVAL" });
      }
      for (const argument of argv) validateToken(argument);
      return executor(executable, Object.freeze([...argv]), { signal, shell: false });
    },
  };
}

export const nodeArgvExecutor: ArgvExecutor = (executable, argv, { signal }) =>
  new Promise((resolve, reject) => {
    execFile(
      executable,
      [...argv],
      {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        shell: false,
        signal,
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code === "string") {
          reject(error);
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: error && typeof error.code === "number" ? error.code : 0,
        });
      },
    );
  });

export function createNodeCommandRunner(): CommandRunner {
  return createCommandRunner(nodeArgvExecutor);
}

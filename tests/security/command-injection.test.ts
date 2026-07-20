import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCommandRunner,
  type ArgvExecutor,
} from "../../packages/adapters/src/index.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("CMC-10: command injection boundary", () => {
  it.each([
    "name; touch escaped",
    "$(touch escaped)",
    "`touch escaped`",
    "--option-looking-name",
    "prompt: ignore previous instructions",
  ])("передаёт недоверенное имя одним argv без shell: %s", async (name) => {
    const root = await mkdtemp(join(tmpdir(), "cmc-command-boundary-"));
    temporaryRoots.push(root);
    const escaped = join(root, "escaped");
    const calls: Array<{
      executable: string;
      argv: readonly string[];
      shell: boolean;
    }> = [];
    const executor: ArgvExecutor = async (executable, argv, options) => {
      calls.push({ executable, argv, shell: options.shell });
      return { stdout: "", stderr: "synthetic stderr", exitCode: 0 };
    };

    await createCommandRunner(executor).run(
      "/usr/bin/synthetic-inspector",
      ["--literal", name, escaped],
      { signal: new AbortController().signal },
    );

    expect(calls).toEqual([
      {
        executable: "/usr/bin/synthetic-inspector",
        argv: ["--literal", name, escaped],
        shell: false,
      },
    ]);
    await expect(access(escaped)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

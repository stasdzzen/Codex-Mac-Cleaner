import { describe, expect, it } from "vitest";

import {
  createCommandRunner,
  createInstalledAppsAdapter,
  createProcessEvidenceAdapter,
  type ArgvExecutor,
} from "../src/index.js";

describe("Command adapters", () => {
  it("принимает только executable и argv-массив без shell interpolation", async () => {
    const calls: Array<{ executable: string; argv: readonly string[]; shell: boolean }> = [];
    const executor: ArgvExecutor = async (executable, argv, options) => {
      calls.push({ executable, argv, shell: options.shell });
      return { stdout: "", stderr: "synthetic-private-stderr", exitCode: 0 };
    };
    const runner = createCommandRunner(executor);
    await runner.run("/usr/bin/synthetic-tool", ["--literal", "$(not-executed)"], {
      signal: new AbortController().signal,
    });

    expect(calls).toEqual([{
      executable: "/usr/bin/synthetic-tool",
      argv: ["--literal", "$(not-executed)"],
      shell: false,
    }]);
  });

  it("installed apps adapter не сохраняет full path или bundle identity", async () => {
    const executor: ArgvExecutor = async () => ({
      stdout: "/synthetic-volume/Applications/Example One.app\n/synthetic-volume/Applications/Unicode 🚀.app\n",
      stderr: "synthetic-private-stderr",
      exitCode: 0,
    });
    const result = await createInstalledAppsAdapter(createCommandRunner(executor)).scan({
      signal: new AbortController().signal,
    });
    const serialized = JSON.stringify(result);

    expect(result.observations).toHaveLength(2);
    expect(serialized).not.toContain("/synthetic-volume/");
    expect(serialized).not.toContain("synthetic-private-stderr");
    expect(serialized).not.toContain("com.");
  });

  it("фиксирует process/open-file/TCP evidence без сырого вывода", async () => {
    let call = 0;
    const outputs = [
      "101\t/synthetic/bin/ExampleProcess\n",
      "p101\nn/synthetic/private/Open.file\n",
      "p101\nn*:43123\n",
    ];
    const executor: ArgvExecutor = async () => ({ stdout: outputs[call++] ?? "", stderr: "", exitCode: 0 });
    const result = await createProcessEvidenceAdapter(createCommandRunner(executor)).scan({
      signal: new AbortController().signal,
    });

    expect(result.observations.map(({ evidenceKind }) => evidenceKind)).toEqual([
      "process_activity",
      "open_file",
      "tcp_listener",
    ]);
    expect(JSON.stringify(result)).not.toContain("/synthetic/private/");
  });
});

import {
  access,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { JsonStore, JsonStoreError } from "../src/index.js";

const strictRecordSchema = {
  parse(value: unknown) {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.keys(value).some((key) => key !== "schemaVersion" && key !== "value") ||
      Reflect.get(value, "schemaVersion") !== 1 ||
      typeof Reflect.get(value, "value") !== "string"
    ) {
      throw new Error("invalid record");
    }
    return value as { schemaVersion: 1; value: string };
  },
};

describe("JsonStore", () => {
  it("создаёт каталоги 0700 и атомарный JSON-файл 0600", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-store-"));
    const store = new JsonStore(join(root, "state"));

    await store.writeJsonAtomic("reports/audit-1/manifest.json", {
      schemaVersion: 1,
      value: "synthetic",
    });

    expect((await stat(join(root, "state"))).mode & 0o777).toBe(0o700);
    expect((await stat(join(root, "state/reports/audit-1"))).mode & 0o777).toBe(0o700);
    expect((await stat(join(root, "state/reports/audit-1/manifest.json"))).mode & 0o777).toBe(
      0o600,
    );
    expect(
      JSON.parse(await readFile(join(root, "state/reports/audit-1/manifest.json"), "utf8")),
    ).toEqual({ schemaVersion: 1, value: "synthetic" });
    expect((await store.listTemporarySiblings("reports/audit-1/manifest.json"))).toEqual([]);
  });

  it("append пишет ровно одну NDJSON-строку и синхронизирует файл", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-store-"));
    const store = new JsonStore(join(root, "state"));

    await store.appendEvent("journal/operations.ndjson", { event: "first" });
    await store.appendEvent("journal/operations.ndjson", { event: "second" });

    expect(await readFile(join(root, "state/journal/operations.ndjson"), "utf8")).toBe(
      '{"event":"first"}\n{"event":"second"}\n',
    );
    expect((await stat(join(root, "state/journal/operations.ndjson"))).mode & 0o777).toBe(
      0o600,
    );
  });

  it("fail closed отклоняет corruption и path traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "cmc-store-"));
    const store = new JsonStore(join(root, "state"));
    await store.ensureDirectory();
    await writeFile(join(root, "state/corrupt.json"), "{not-json", { mode: 0o600 });

    await expect(store.readJson("corrupt.json", strictRecordSchema)).rejects.toMatchObject({
      code: "CORRUPT_STATE",
      failClosed: true,
    } satisfies Partial<JsonStoreError>);
    await expect(store.writeJsonAtomic("../outside.json", {})).rejects.toMatchObject({
      code: "PATH_OUTSIDE_STORE",
      failClosed: true,
    } satisfies Partial<JsonStoreError>);
  });

  it("до write отклоняет несуществующий root под symlinked parent", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "cmc-store-parent-link-"));
    const external = join(sandbox, "external");
    const linkedParent = join(sandbox, "linked-parent");
    await mkdir(external, { mode: 0o700 });
    await symlink(external, linkedParent);
    const store = new JsonStore(join(linkedParent, "state"));

    await expect(
      store.writeJsonAtomic("exclusions.json", {
        schemaVersion: 1,
        value: "forbidden",
      }),
    ).rejects.toMatchObject({
      code: "SYMLINK_BOUNDARY",
      failClosed: true,
    } satisfies Partial<JsonStoreError>);
    await expect(access(join(external, "state"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("до write отклоняет symlinked root и не меняет внешний каталог", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "cmc-store-root-link-"));
    const external = join(sandbox, "external");
    const stateRoot = join(sandbox, "state");
    await mkdir(external, { mode: 0o700 });
    await symlink(external, stateRoot);
    const store = new JsonStore(stateRoot);

    await expect(
      store.writeJsonAtomic("exclusions.json", {
        schemaVersion: 1,
        value: "forbidden",
      }),
    ).rejects.toMatchObject({ code: "SYMLINK_BOUNDARY" });
    await expect(access(join(external, "exclusions.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("до write отклоняет symlinked target и сохраняет внешний файл", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "cmc-store-target-link-"));
    const stateRoot = join(sandbox, "state");
    const external = join(sandbox, "external.json");
    await mkdir(stateRoot, { mode: 0o700 });
    await writeFile(external, "synthetic-sentinel\n", { mode: 0o600 });
    await symlink(external, join(stateRoot, "exclusions.json"));
    const store = new JsonStore(stateRoot);

    await expect(
      store.writeJsonAtomic("exclusions.json", {
        schemaVersion: 1,
        value: "forbidden",
      }),
    ).rejects.toMatchObject({ code: "SYMLINK_BOUNDARY" });
    expect(await readFile(external, "utf8")).toBe("synthetic-sentinel\n");
  });
});

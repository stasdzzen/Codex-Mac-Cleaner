import { describe, expect, it } from "vitest";

import {
  VersionedStateError,
  migrateVersionedState,
} from "../src/index.js";

interface StateV1 {
  schemaVersion: 1;
  label: string;
}

interface StateV2 {
  schemaVersion: 2;
  label: string;
  enabled: boolean;
}

function schemaFor<T extends { schemaVersion: number }>(
  version: T["schemaVersion"],
  guard: (value: Record<string, unknown>) => boolean,
) {
  return {
    parse(value: unknown): T {
      if (
        typeof value !== "object" ||
        value === null ||
        Reflect.get(value, "schemaVersion") !== version ||
        !guard(value as Record<string, unknown>)
      ) {
        throw new Error("invalid state");
      }
      return value as T;
    },
  };
}

const v1Schema = schemaFor<StateV1>(1, (value) =>
  Object.keys(value).every((key) => ["schemaVersion", "label"].includes(key)),
);
const v2Schema = schemaFor<StateV2>(
  2,
  (value) =>
    typeof value.enabled === "boolean" &&
    Object.keys(value).every((key) => ["schemaVersion", "label", "enabled"].includes(key)),
);

describe("versioned state migrations", () => {
  it("выполняет только последовательную проверяемую миграцию", () => {
    expect(
      migrateVersionedState<StateV2>(
        { schemaVersion: 1, label: "synthetic" },
        {
          currentVersion: 2,
          schemas: { 1: v1Schema, 2: v2Schema },
          migrations: {
            1: {
              toVersion: 2,
              migrate: (value) => ({ ...value, schemaVersion: 2, enabled: false }),
            },
          },
        },
      ),
    ).toEqual({ schemaVersion: 2, label: "synthetic", enabled: false });
  });

  it.each([
    [{ schemaVersion: 99, label: "future" }, "UNKNOWN_SCHEMA_VERSION"],
    [{ schemaVersion: 0, label: "old" }, "UNKNOWN_SCHEMA_VERSION"],
    [{ schemaVersion: 1, label: "synthetic", unknown: true }, "INVALID_VERSIONED_STATE"],
  ] as const)("fail closed для invalid migration version %#", (input, code) => {
    expect(() =>
      migrateVersionedState<StateV2>(input, {
        currentVersion: 2,
        schemas: { 1: v1Schema, 2: v2Schema },
        migrations: {
          1: {
            toVersion: 2,
            migrate: (value) => ({ ...value, schemaVersion: 2, enabled: false }),
          },
        },
      }),
    ).toThrowError(expect.objectContaining({ code, failClosed: true }) as VersionedStateError);
  });

  it("отклоняет пропущенный migration step", () => {
    expect(() =>
      migrateVersionedState<StateV2>({ schemaVersion: 1, label: "synthetic" }, {
        currentVersion: 2,
        schemas: { 1: v1Schema, 2: v2Schema },
        migrations: {},
      }),
    ).toThrowError(
      expect.objectContaining({ code: "MIGRATION_UNAVAILABLE", failClosed: true }) as VersionedStateError,
    );
  });
});

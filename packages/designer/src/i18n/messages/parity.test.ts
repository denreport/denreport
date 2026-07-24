import { describe, expect, it } from "vitest";
import { en } from "./en";
import { dialogsExportEn } from "./en/dialogs-export";
import { dialogsManageEn } from "./en/dialogs-manage";
import { propertiesEn } from "./en/properties";
import { propertiesBulkEn } from "./en/properties-bulk";
import { stateEn } from "./en/state";
import { toolbarEn } from "./en/toolbar";
import { workspaceEn } from "./en/workspace";
import { ja } from "./ja";
import { dialogsExportJa } from "./ja/dialogs-export";
import { dialogsManageJa } from "./ja/dialogs-manage";
import { propertiesJa } from "./ja/properties";
import { propertiesBulkJa } from "./ja/properties-bulk";
import { stateJa } from "./ja/state";
import { toolbarJa } from "./ja/toolbar";
import { workspaceJa } from "./ja/workspace";

/** Values are treated as leaves once they are no longer a plain object, so string/function/array leaves all terminate the path. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (!isPlainObject(value)) {
    return [prefix];
  }
  return Object.keys(value)
    .sort()
    .flatMap((key) =>
      collectKeyPaths(value[key], prefix ? `${prefix}.${key}` : key),
    );
}

const PARTS: readonly [string, unknown, unknown][] = [
  ["toolbar", toolbarEn, toolbarJa],
  ["properties", propertiesEn, propertiesJa],
  ["properties-bulk", propertiesBulkEn, propertiesBulkJa],
  ["dialogs-export", dialogsExportEn, dialogsExportJa],
  ["dialogs-manage", dialogsManageEn, dialogsManageJa],
  ["workspace", workspaceEn, workspaceJa],
  ["state", stateEn, stateJa],
];

describe("i18n catalog key parity", () => {
  it("en and ja expose the same set of deep key paths", () => {
    const enPaths = new Set(collectKeyPaths(en));
    const jaPaths = new Set(collectKeyPaths(ja));

    const missingInJa = [...enPaths]
      .filter((path) => !jaPaths.has(path))
      .sort();
    const missingInEn = [...jaPaths]
      .filter((path) => !enPaths.has(path))
      .sort();

    expect({ missingInJa, missingInEn }).toEqual({
      missingInJa: [],
      missingInEn: [],
    });
  });

  it.each(PARTS)(
    "%s: en and ja expose the same set of deep key paths",
    (_name, partEn, partJa) => {
      const enPaths = new Set(collectKeyPaths(partEn));
      const jaPaths = new Set(collectKeyPaths(partJa));

      const missingInJa = [...enPaths]
        .filter((path) => !jaPaths.has(path))
        .sort();
      const missingInEn = [...jaPaths]
        .filter((path) => !enPaths.has(path))
        .sort();

      expect({ missingInJa, missingInEn }).toEqual({
        missingInJa: [],
        missingInEn: [],
      });
    },
  );
});

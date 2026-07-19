import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { IrData } from "@denreport/core";
import { parseIr } from "@denreport/core";
import { describe, expect, it } from "vitest";
import { EMBEDDED_FONT_URL } from "../src/fonts/embedded";
import { exportPdfme } from "../src/pdfme/export";

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const coreFixturesDir = fileURLToPath(
  new URL("../../core/tests/fixtures", import.meta.url),
);
const fontData = new Uint8Array(readFileSync(EMBEDDED_FONT_URL));

function readJson<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(`${dir}/${name}`, "utf-8")) as T;
}

describe("exportPdfme — golden fixture snapshots", () => {
  it.each([
    {
      name: "invoice",
      irFile: "invoice.json",
      dataFile: "invoice-data.json",
    },
    {
      name: "invoice-multipage",
      irFile: "invoice-multipage.json",
      dataFile: "invoice-multipage-data.json",
    },
    {
      name: "rotation",
      irFile: "rotation.json",
      dataFile: "rotation-data.json",
    },
  ])("$name", async ({ name, irFile, dataFile }) => {
    const parsed = parseIr(
      readFileSync(`${coreFixturesDir}/${irFile}`, "utf-8"),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("expected valid IR fixture");
    const data = readJson<IrData>(fixturesDir, dataFile);

    const result = exportPdfme(parsed.document, data, { regular: fontData });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    await expect(JSON.stringify(result.template, null, 2)).toMatchFileSnapshot(
      `./__snapshots__/${name}.template.json`,
    );
    await expect(JSON.stringify(result.inputs, null, 2)).toMatchFileSnapshot(
      `./__snapshots__/${name}.inputs.json`,
    );
  });
});

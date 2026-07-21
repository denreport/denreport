import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkQualifiedInvoice, parseIr, validateIr } from "@denreport/core";
import { describe, expect, it } from "vitest";

// Resolved via node:path/node:url rather than `new URL(..., import.meta.url)` because the
// jsdom test environment replaces the global URL constructor with one that mishandles
// relative resolution against a file: base
const EXAMPLE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples/qualified-invoice.json",
);

// examples/ is the repo's standalone template collection (not a package fixture), read
// from its real location so this test also proves the designer's load path for it
describe("examples/qualified-invoice.json", () => {
  it("parseIr succeeds, and both validateIr and the qualified invoice check report no issues", () => {
    const json = readFileSync(EXAMPLE_PATH, "utf8");
    const parsed = parseIr(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // checkQualifiedInvoice returns [] for any non-qualifiedInvoice docType, so the
    // declaration itself must be asserted or the check below could pass vacuously
    expect(parsed.document.docType).toBe("qualifiedInvoice");
    expect(validateIr(parsed.document)).toEqual([]);
    expect(checkQualifiedInvoice(parsed.document)).toEqual([]);
  });
});

import type { IrDocument, IrElement, IrFlexChild } from "@denreport/core";
import { textTemplateKeys } from "@denreport/core";

/** Returns the {key} tokens inside text/barcode elements and table.bind values in the
    document (including flex descendants), deduplicated and sorted lexicographically.
    For input assistance. Empty strings are excluded */
export function collectBindKeys(document: IrDocument): readonly string[] {
  const keys = new Set<string>();
  function visit(el: IrElement | IrFlexChild): void {
    if (el.type === "text") {
      for (const key of textTemplateKeys(el.text)) keys.add(key);
    }
    if (el.type === "barcode") {
      for (const key of textTemplateKeys(el.value)) keys.add(key);
    }
    if (el.type === "table" && el.bind !== "") {
      keys.add(el.bind);
    }
    if (el.type === "flex") {
      for (const child of el.children) {
        visit(child);
      }
    }
  }
  for (const el of document.elements) {
    visit(el);
  }
  return [...keys].sort();
}

/** Returns the top-level keys of the sample JSON in lexicographic order. Returns an empty
    array if unparseable or not an object.
    Used for the bind input's datalist candidates (union with collectBindKeys) */
export function sampleDataKeys(json: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [];
    }
    return Object.keys(parsed).sort();
  } catch {
    return [];
  }
}

import type { IrDocument, IrElement, IrFlexChild } from "@denreport/core";
import { textTemplateKeys } from "@denreport/core";

/** 文書内の text・barcode 内の {key} トークン・table.bind（flex 子孫含む）を
    重複なし・辞書順で返す。入力支援用。空文字は含めない */
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

/** サンプル JSON のトップレベルキーを辞書順で返す。パース不能・非オブジェクトなら空配列。
    bind 入力の datalist 候補（collectBindKeys との和集合）に使う */
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

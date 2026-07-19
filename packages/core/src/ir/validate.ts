import {
  DATA_URI_PATTERN,
  FONT_SIZE_MAX,
  IDENTIFIER_MAX_LENGTH,
  IDENTIFIER_PATTERN,
  LINE_HEIGHT_MAX,
  PAGE_DIMENSION_MAX,
  PAGE_DIMENSION_MIN,
  PT_TO_MM,
  STYLE_NAME_MAX_LENGTH,
} from "./constants";
import type { IrError, IrRuleId } from "./errors";
import { measureFlex } from "./flex";
import { footnoteMarkIds } from "./footnotes";
import type { IrDocument, IrElement, IrFlexChild } from "./types";

interface WalkedElement {
  readonly path: string;
  readonly element: IrElement | IrFlexChild;
  readonly isTopLevel: boolean;
}

function walkElements(document: IrDocument): WalkedElement[] {
  const out: WalkedElement[] = [];
  function visit(
    element: IrElement | IrFlexChild,
    path: string,
    isTopLevel: boolean,
  ): void {
    out.push({ path, element, isTopLevel });
    if (element.type === "flex") {
      element.children.forEach((child, i) => {
        visit(child, `${path}.children[${i}]`, false);
      });
    }
  }
  document.elements.forEach((el, i) => {
    visit(el, `elements[${i}]`, true);
  });
  return out;
}

function isIdentifier(value: string): boolean {
  return (
    IDENTIFIER_PATTERN.test(value) && value.length <= IDENTIFIER_MAX_LENGTH
  );
}

function err(rule: IrRuleId, path: string, message: string): IrError {
  return { rule, path, message };
}

/**
 * Checks `document` against the M* (semantic) and F* (footnote) rule groups.
 * Syntax (S*) rules are already enforced by parseIr, and data-dependent rules
 * (C*, Q01) require analyzeData/validateData and checkQualifiedInvoice
 * separately. An empty result means the document is safe to pass to
 * resolveFlex, resolveFootnotes, and lowerIr.
 */
export function validateIr(document: IrDocument): readonly IrError[] {
  const walked = walkElements(document);
  return [
    ...checkM01(walked),
    ...checkM02(document),
    ...checkM03(walked),
    ...checkM04(walked),
    ...checkM05(document),
    ...checkM06(document),
    ...checkM07(document, walked),
    ...checkM08(walked),
    ...checkM09(document),
    ...checkM10(document),
    ...checkM11(walked),
    ...checkM12(walked),
    ...checkM13(document),
    ...checkM14(document),
    ...checkM15(document, walked),
    ...checkM16(walked),
    ...checkM17(walked),
    ...checkF02(document),
    ...checkF03(document),
    ...checkF04(document, walked),
    ...checkF05(document),
    ...checkF06(document),
  ];
}

function checkM01(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  const pathsById = new Map<string, string[]>();
  for (const { path, element } of walked) {
    if (!isIdentifier(element.id)) {
      errors.push(
        err(
          "M01",
          `${path}.id`,
          `id "${element.id}" は識別子パターンに一致しません`,
        ),
      );
    }
    const paths = pathsById.get(element.id) ?? [];
    paths.push(path);
    pathsById.set(element.id, paths);
  }
  for (const [id, paths] of pathsById) {
    if (paths.length > 1) {
      for (const path of paths) {
        errors.push(
          err("M01", `${path}.id`, `id "${id}" が文書内で重複しています`),
        );
      }
    }
  }
  return errors;
}

// M02 は用紙内判定であり、子はコンテナの箱に含まれるため個別判定しない（トップレベルのみを見る）。
function checkM02(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  const { width: pageWidth, height: pageHeight } = document.page;
  document.elements.forEach((element, i) => {
    const path = `elements[${i}]`;
    if (element.type === "table") {
      const width = element.columns.reduce(
        (total, col) => total + col.width,
        0,
      );
      if (element.x < 0)
        errors.push(err("M02", `${path}.x`, "x が 0 未満です"));
      if (element.y < 0)
        errors.push(err("M02", `${path}.y`, "y が 0 未満です"));
      if (element.x + width > pageWidth) {
        errors.push(
          err("M02", `${path}.x`, "table の幅が用紙の右端を超えています"),
        );
      }
      return;
    }
    const { w, h } = footprint(element);
    if (element.x < 0) errors.push(err("M02", `${path}.x`, "x が 0 未満です"));
    if (element.y < 0) errors.push(err("M02", `${path}.y`, "y が 0 未満です"));
    if (element.x + w > pageWidth)
      errors.push(err("M02", `${path}.x`, "要素が用紙の右端を超えています"));
    if (element.y + h > pageHeight)
      errors.push(err("M02", `${path}.y`, "要素が用紙の下端を超えています"));
  });
  return errors;
}

function footprint(element: Exclude<IrElement, { type: "table" }>): {
  w: number;
  h: number;
} {
  switch (element.type) {
    case "text":
    case "rect":
    case "ellipse":
    case "image":
    case "pageNumber":
    case "barcode":
      return { w: element.w, h: element.h };
    case "line":
      return element.orientation === "horizontal"
        ? { w: element.length, h: 0 }
        : { w: 0, h: element.length };
    case "flex": {
      const measurement = measureFlex(element);
      return { w: measurement.boxWidth, h: measurement.boxHeight };
    }
  }
}

function pushPositive(
  errors: IrError[],
  path: string,
  field: string,
  value: number,
): void {
  if (!(value > 0))
    errors.push(
      err("M03", `${path}.${field}`, `${field} は 0 より大きい必要があります`),
    );
}

function pushNonNegative(
  errors: IrError[],
  path: string,
  field: string,
  value: number,
): void {
  if (!(value >= 0))
    errors.push(
      err("M03", `${path}.${field}`, `${field} は 0 以上である必要があります`),
    );
}

function checkM03(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    switch (element.type) {
      case "text":
      case "image":
      case "pageNumber":
      case "barcode":
        pushPositive(errors, path, "w", element.w);
        pushPositive(errors, path, "h", element.h);
        break;
      case "rect":
        pushPositive(errors, path, "w", element.w);
        pushPositive(errors, path, "h", element.h);
        pushNonNegative(errors, path, "borderWidth", element.borderWidth);
        break;
      case "ellipse":
        pushPositive(errors, path, "w", element.w);
        pushPositive(errors, path, "h", element.h);
        pushNonNegative(errors, path, "borderWidth", element.borderWidth);
        break;
      case "line":
        pushPositive(errors, path, "length", element.length);
        pushPositive(errors, path, "thickness", element.thickness);
        break;
      case "table":
        pushPositive(errors, path, "rowHeight", element.rowHeight);
        pushPositive(errors, path, "headerHeight", element.headerHeight);
        element.columns.forEach((col, i) => {
          pushPositive(errors, `${path}.columns[${i}]`, "width", col.width);
        });
        break;
      case "flex": {
        pushNonNegative(errors, path, "gap", element.gap);
        const explicitMain =
          element.direction === "row" ? element.w : element.h;
        if (explicitMain !== undefined) {
          pushPositive(
            errors,
            path,
            element.direction === "row" ? "w" : "h",
            explicitMain,
          );
        }
        break;
      }
    }
  }
  return errors;
}

function checkRange(
  errors: IrError[],
  path: string,
  field: string,
  value: number,
  max: number,
): void {
  if (!(value > 0 && value <= max)) {
    errors.push(
      err(
        "M04",
        `${path}.${field}`,
        `${field} は 0 より大きく ${max} 以下である必要があります`,
      ),
    );
  }
}

function checkM04(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type === "text" || element.type === "pageNumber") {
      checkRange(errors, path, "fontSize", element.fontSize, FONT_SIZE_MAX);
      checkRange(
        errors,
        path,
        "lineHeight",
        element.lineHeight,
        LINE_HEIGHT_MAX,
      );
    } else if (element.type === "table") {
      checkRange(errors, path, "fontSize", element.fontSize, FONT_SIZE_MAX);
    }
  }
  return errors;
}

function checkM05(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  const { width, height } = document.page;
  if (!(width >= PAGE_DIMENSION_MIN && width <= PAGE_DIMENSION_MAX)) {
    errors.push(
      err(
        "M05",
        "page.width",
        `page.width は ${PAGE_DIMENSION_MIN} 以上 ${PAGE_DIMENSION_MAX} 以下である必要があります`,
      ),
    );
  }
  if (!(height >= PAGE_DIMENSION_MIN && height <= PAGE_DIMENSION_MAX)) {
    errors.push(
      err(
        "M05",
        "page.height",
        `page.height は ${PAGE_DIMENSION_MIN} 以上 ${PAGE_DIMENSION_MAX} 以下である必要があります`,
      ),
    );
  }
  return errors;
}

function checkM06(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    const path = `elements[${i}]`;
    if (el.columns.length < 1) {
      errors.push(err("M06", `${path}.columns`, "columns は1個以上必要です"));
    }
    const indicesByKey = new Map<string, number[]>();
    el.columns.forEach((col, j) => {
      const indices = indicesByKey.get(col.key) ?? [];
      indices.push(j);
      indicesByKey.set(col.key, indices);
    });
    for (const [key, indices] of indicesByKey) {
      if (indices.length > 1) {
        for (const j of indices) {
          errors.push(
            err(
              "M06",
              `${path}.columns[${j}].key`,
              `key "${key}" が table 内で重複しています`,
            ),
          );
        }
      }
    }
  });
  return errors;
}

function checkM07(
  document: IrDocument,
  walked: readonly WalkedElement[],
): IrError[] {
  const errors: IrError[] = [];
  if (!isIdentifier(document.font.name)) {
    errors.push(
      err(
        "M07",
        "font.name",
        `font.name "${document.font.name}" は識別子パターンに一致しません`,
      ),
    );
  }
  for (const { path, element } of walked) {
    if (element.type === "table") {
      if (!isIdentifier(element.bind)) {
        errors.push(
          err(
            "M07",
            `${path}.bind`,
            `bind "${element.bind}" は識別子パターンに一致しません`,
          ),
        );
      }
      element.columns.forEach((col, i) => {
        if (!isIdentifier(col.key)) {
          errors.push(
            err(
              "M07",
              `${path}.columns[${i}].key`,
              `key "${col.key}" は識別子パターンに一致しません`,
            ),
          );
        }
      });
    }
  }
  return errors;
}

// atob はブラウザ・Node の両方に存在するグローバル関数だが、
// lib.dom.d.ts を取り込まずに済むよう最小の型を自前で宣言する。
declare function atob(data: string): string;

function isValidBase64(payload: string): boolean {
  try {
    atob(payload);
    return true;
  } catch {
    return false;
  }
}

function checkM08(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "image") continue;
    const match = DATA_URI_PATTERN.exec(element.src);
    if (!match) continue; // S12 で既に報告済み
    const [, mediatype, payload] = match;
    if (mediatype !== "image/png" && mediatype !== "image/jpeg") {
      errors.push(
        err(
          "M08",
          `${path}.src`,
          `対応していない mediatype です: "${mediatype}"`,
        ),
      );
    }
    if (payload === undefined || !isValidBase64(payload)) {
      errors.push(
        err("M08", `${path}.src`, "base64 payload をデコードできません"),
      );
    }
  }
  return errors;
}

function checkM09(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    const path = `elements[${i}]`;
    if (el.continuationY < 0) {
      errors.push(
        err(
          "M09",
          `${path}.continuationY`,
          "continuationY は 0 以上である必要があります",
        ),
      );
    }
    if (el.maxY > document.page.height) {
      errors.push(
        err("M09", `${path}.maxY`, "maxY が用紙の高さを超えています"),
      );
    }
    if (!(el.y + el.headerHeight + el.rowHeight <= el.maxY)) {
      errors.push(
        err("M09", `${path}.maxY`, "先頭ページの行容量が1行分もありません"),
      );
    }
    if (!(el.continuationY + el.headerHeight + el.rowHeight <= el.maxY)) {
      errors.push(
        err(
          "M09",
          `${path}.continuationY`,
          "継続ページの行容量が1行分もありません",
        ),
      );
    }
  });
  return errors;
}

function checkM10(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    if (!Number.isInteger(el.minRows) || el.minRows < 0) {
      errors.push(
        err(
          "M10",
          `elements[${i}].minRows`,
          "minRows は0以上の整数である必要があります",
        ),
      );
    }
  });
  return errors;
}

function checkM11(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type === "flex" && element.children.length < 1) {
      errors.push(err("M11", `${path}.children`, "children は1個以上必要です"));
    }
  }
  return errors;
}

function checkM12(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "flex") continue;
    const explicit = element.direction === "row" ? element.w : element.h;
    if (explicit === undefined) continue;
    const { contentMain } = measureFlex(element);
    if (explicit < contentMain) {
      const field = element.direction === "row" ? "w" : "h";
      errors.push(
        err("M12", `${path}.${field}`, "主軸寸法が内容寸法を下回っています"),
      );
    }
  }
  return errors;
}

function checkM13(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table" || el.cellOverrides === undefined) return;
    const path = `elements[${i}]`;
    const keys = new Set(el.columns.map((col) => col.key));
    const indicesByRowKey = new Map<string, number[]>();
    el.cellOverrides.forEach((override, j) => {
      const entryPath = `${path}.cellOverrides[${j}]`;
      if (!Number.isInteger(override.row) || override.row < 0) {
        errors.push(
          err(
            "M13",
            `${entryPath}.row`,
            "row は0以上の整数である必要があります",
          ),
        );
      }
      if (!keys.has(override.key)) {
        errors.push(
          err(
            "M13",
            `${entryPath}.key`,
            `key "${override.key}" が table の columns にありません`,
          ),
        );
      }
      const dedupeKey = `${override.row}:${override.key}`;
      const indices = indicesByRowKey.get(dedupeKey) ?? [];
      indices.push(j);
      indicesByRowKey.set(dedupeKey, indices);
    });
    for (const indices of indicesByRowKey.values()) {
      if (indices.length > 1) {
        for (const j of indices) {
          errors.push(
            err(
              "M13",
              `${path}.cellOverrides[${j}]`,
              "(row, key) の組み合わせが table 内で重複しています",
            ),
          );
        }
      }
    }
  });
  return errors;
}

function checkM14(document: IrDocument): IrError[] {
  const errors: IrError[] = [];
  const styles = document.styles ?? [];
  const countByName = new Map<string, number>();
  for (const style of styles) {
    countByName.set(style.name, (countByName.get(style.name) ?? 0) + 1);
  }
  styles.forEach((style, i) => {
    const path = `styles[${i}]`;
    if (style.name.length < 1 || style.name.length > STYLE_NAME_MAX_LENGTH) {
      errors.push(
        err(
          "M14",
          `${path}.name`,
          `name は1文字以上${STYLE_NAME_MAX_LENGTH}文字以下である必要があります`,
        ),
      );
    }
    if ((countByName.get(style.name) ?? 0) > 1) {
      errors.push(
        err(
          "M14",
          `${path}.name`,
          `name "${style.name}" が文書内で重複しています`,
        ),
      );
    }
    if (Object.keys(style.attrs).length === 0) {
      errors.push(
        err("M14", `${path}.attrs`, "attrs は1フィールド以上必要です"),
      );
    }
    const { fontSize, lineHeight, borderWidth, thickness } = style.attrs;
    if (
      fontSize !== undefined &&
      !(fontSize > 0 && fontSize <= FONT_SIZE_MAX)
    ) {
      errors.push(
        err(
          "M14",
          `${path}.attrs.fontSize`,
          `fontSize は 0 より大きく ${FONT_SIZE_MAX} 以下である必要があります`,
        ),
      );
    }
    if (
      lineHeight !== undefined &&
      !(lineHeight > 0 && lineHeight <= LINE_HEIGHT_MAX)
    ) {
      errors.push(
        err(
          "M14",
          `${path}.attrs.lineHeight`,
          `lineHeight は 0 より大きく ${LINE_HEIGHT_MAX} 以下である必要があります`,
        ),
      );
    }
    if (borderWidth !== undefined && !(borderWidth > 0)) {
      errors.push(
        err(
          "M14",
          `${path}.attrs.borderWidth`,
          "borderWidth は 0 より大きい必要があります",
        ),
      );
    }
    if (thickness !== undefined && !(thickness > 0)) {
      errors.push(
        err(
          "M14",
          `${path}.attrs.thickness`,
          "thickness は 0 より大きい必要があります",
        ),
      );
    }
  });
  return errors;
}

function checkF02(document: IrDocument): IrError[] {
  const { footnotes } = document;
  if (footnotes === undefined) return [];
  const errors: IrError[] = [];
  const indicesById = new Map<string, number[]>();
  footnotes.notes.forEach((note, i) => {
    if (!isIdentifier(note.id)) {
      errors.push(
        err(
          "F02",
          `footnotes.notes[${i}].id`,
          `id "${note.id}" は識別子パターンに一致しません`,
        ),
      );
    }
    const indices = indicesById.get(note.id) ?? [];
    indices.push(i);
    indicesById.set(note.id, indices);
  });
  for (const [id, indices] of indicesById) {
    if (indices.length > 1) {
      for (const i of indices) {
        errors.push(
          err(
            "F02",
            `footnotes.notes[${i}].id`,
            `id "${id}" が footnotes 内で重複しています`,
          ),
        );
      }
    }
  }
  return errors;
}

function checkF03(document: IrDocument): IrError[] {
  const notesById = new Set(
    (document.footnotes?.notes ?? []).map((note) => note.id),
  );
  const errors: IrError[] = [];
  document.elements.forEach((element, i) => {
    if (element.type !== "text") return;
    for (const id of new Set(footnoteMarkIds(element.text))) {
      if (!notesById.has(id)) {
        errors.push(
          err(
            "F03",
            `elements[${i}].text`,
            `参照先の注記 "${id}" が定義されていません`,
          ),
        );
      }
    }
  });
  return errors;
}

function pushMarkError(
  errors: IrError[],
  path: string,
  text: string,
  message: string,
): void {
  if (footnoteMarkIds(text).length > 0) {
    errors.push(err("F04", path, message));
  }
}

function checkF04(
  document: IrDocument,
  walked: readonly WalkedElement[],
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element, isTopLevel } of walked) {
    if (element.type === "text" && !isTopLevel) {
      pushMarkError(
        errors,
        `${path}.text`,
        element.text,
        "脚注マークは flex 内の text には書けません",
      );
    }
    if (element.type === "pageNumber") {
      pushMarkError(
        errors,
        `${path}.format`,
        element.format,
        "脚注マークは pageNumber の format には書けません",
      );
    }
  }
  document.elements.forEach((element, i) => {
    if (element.type !== "table") return;
    const path = `elements[${i}]`;
    element.columns.forEach((column, j) => {
      pushMarkError(
        errors,
        `${path}.columns[${j}].label`,
        column.label,
        "脚注マークは table の列見出しには書けません",
      );
    });
    (element.cellOverrides ?? []).forEach((override, j) => {
      pushMarkError(
        errors,
        `${path}.cellOverrides[${j}].value`,
        override.value,
        "脚注マークは table の固定値上書きには書けません",
      );
    });
  });
  document.footnotes?.notes.forEach((note, i) => {
    pushMarkError(
      errors,
      `footnotes.notes[${i}].text`,
      note.text,
      "脚注マークは注記本文には書けません",
    );
  });
  return errors;
}

function checkF05(document: IrDocument): IrError[] {
  const { footnotes } = document;
  if (footnotes === undefined) return [];
  const referenced = new Set<string>();
  for (const element of document.elements) {
    if (element.type !== "text") continue;
    for (const id of footnoteMarkIds(element.text)) referenced.add(id);
  }
  const errors: IrError[] = [];
  footnotes.notes.forEach((note, i) => {
    if (!referenced.has(note.id)) {
      errors.push(
        err(
          "F05",
          `footnotes.notes[${i}].id`,
          `note "${note.id}" がどのマークからも参照されていません`,
        ),
      );
    }
  });
  return errors;
}

function elementStyleName(
  element: IrElement | IrFlexChild,
): string | undefined {
  return element.type === "image" ||
    element.type === "flex" ||
    element.type === "ellipse" ||
    element.type === "barcode"
    ? undefined
    : element.style;
}

function checkM15(
  document: IrDocument,
  walked: readonly WalkedElement[],
): IrError[] {
  const errors: IrError[] = [];
  const names = new Set((document.styles ?? []).map((s) => s.name));
  for (const { path, element } of walked) {
    const style = elementStyleName(element);
    if (style !== undefined && !names.has(style)) {
      errors.push(
        err(
          "M15",
          `${path}.style`,
          `style "${style}" を参照するスタイルが見つかりません`,
        ),
      );
    }
  }
  return errors;
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function checkColorField(
  errors: IrError[],
  path: string,
  field: string,
  value: string | undefined,
): void {
  if (value === undefined) return;
  if (!COLOR_PATTERN.test(value)) {
    errors.push(
      err(
        "M16",
        `${path}.${field}`,
        `${field} は #rrggbb 形式である必要があります: "${value}"`,
      ),
    );
  }
}

function checkM16(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    switch (element.type) {
      case "text":
      case "pageNumber":
        checkColorField(errors, path, "color", element.color);
        break;
      case "line":
        checkColorField(errors, path, "color", element.color);
        break;
      case "rect":
      case "ellipse":
        checkColorField(errors, path, "borderColor", element.borderColor);
        checkColorField(errors, path, "fillColor", element.fillColor);
        break;
      case "table":
        checkColorField(errors, path, "stripeColor", element.stripeColor);
        break;
      default:
        break;
    }
  }
  return errors;
}

function checkM17(walked: readonly WalkedElement[]): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "rect") continue;
    const { cornerRadius, borderStyle, w, h } = element;
    if (cornerRadius === undefined) continue;
    const maxRadius = Math.min(w, h) / 2;
    if (!(cornerRadius >= 0 && cornerRadius <= maxRadius)) {
      errors.push(
        err(
          "M17",
          `${path}.cornerRadius`,
          `cornerRadius は 0 以上 ${maxRadius} 以下である必要があります`,
        ),
      );
    }
    if (cornerRadius > 0 && (borderStyle ?? "solid") !== "solid") {
      errors.push(
        err(
          "M17",
          `${path}.borderStyle`,
          "cornerRadius を指定する場合、borderStyle は solid（省略含む）である必要があります",
        ),
      );
    }
  }
  return errors;
}

function checkF06(document: IrDocument): IrError[] {
  const { footnotes, page } = document;
  if (footnotes === undefined) return [];
  const errors: IrError[] = [];
  if (!(footnotes.x >= 0)) {
    errors.push(err("F06", "footnotes.x", "x は 0 以上である必要があります"));
  }
  if (!(footnotes.w >= 0)) {
    errors.push(err("F06", "footnotes.w", "w は 0 以上である必要があります"));
  }
  if (!(footnotes.bottom >= 0)) {
    errors.push(
      err("F06", "footnotes.bottom", "bottom は 0 以上である必要があります"),
    );
  }
  if (!(footnotes.fontSize > 0 && footnotes.fontSize <= FONT_SIZE_MAX)) {
    errors.push(
      err(
        "F06",
        "footnotes.fontSize",
        `fontSize は 0 より大きく ${FONT_SIZE_MAX} 以下である必要があります`,
      ),
    );
  }
  if (!(footnotes.lineHeight > 0 && footnotes.lineHeight <= LINE_HEIGHT_MAX)) {
    errors.push(
      err(
        "F06",
        "footnotes.lineHeight",
        `lineHeight は 0 より大きく ${LINE_HEIGHT_MAX} 以下である必要があります`,
      ),
    );
  }
  if (footnotes.x + footnotes.w > page.width) {
    errors.push(
      err("F06", "footnotes.w", "注記ブロックが用紙の右端を超えています"),
    );
  }
  if (footnotes.notes.length > 0) {
    const totalLines = footnotes.notes.reduce(
      (sum, note) => sum + note.text.split("\n").length,
      0,
    );
    const blockHeight =
      totalLines * footnotes.fontSize * footnotes.lineHeight * PT_TO_MM;
    if (page.height - footnotes.bottom - blockHeight < 0) {
      errors.push(
        err(
          "F06",
          "footnotes.bottom",
          "注記ブロックが用紙の上端を超えています",
        ),
      );
    }
  }
  return errors;
}

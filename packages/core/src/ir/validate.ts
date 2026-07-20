import {
  getMessages,
  type MessageLocale,
  type Messages,
} from "../i18n/messages";
import {
  DATA_URI_PATTERN,
  ELEMENT_NAME_MAX_LENGTH,
  FONT_SIZE_MAX,
  IDENTIFIER_MAX_LENGTH,
  IDENTIFIER_PATTERN,
  LINE_HEIGHT_MAX,
  PAGE_DIMENSION_MAX,
  PAGE_DIMENSION_MIN,
  PT_TO_MM,
  ROTATE_MAX,
  STYLE_NAME_MAX_LENGTH,
} from "./constants";
import type { IrError, IrRuleId } from "./errors";
import { measureFlex } from "./flex";
import { footnoteMarkIds } from "./footnotes";
import type { IrDocument, IrElement, IrFlexChild } from "./types";

type ValidateMessages = Messages["validate"];

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
 * `options.locale` controls the error messages' language (default "ja").
 */
export function validateIr(
  document: IrDocument,
  options?: { readonly locale?: MessageLocale },
): readonly IrError[] {
  const m = getMessages(options?.locale).validate;
  const walked = walkElements(document);
  return [
    ...checkM01(walked, m),
    ...checkM02(document, m),
    ...checkM03(walked, m),
    ...checkM04(walked, m),
    ...checkM05(document, m),
    ...checkM06(document, m),
    ...checkM07(document, walked, m),
    ...checkM08(walked, m),
    ...checkM09(document, m),
    ...checkM10(document, m),
    ...checkM11(walked, m),
    ...checkM12(walked, m),
    ...checkM13(document, m),
    ...checkM14(document, m),
    ...checkM15(document, walked, m),
    ...checkM16(walked, m),
    ...checkM17(walked, m),
    ...checkM18(walked, m),
    ...checkM19(walked, m),
    ...checkM20(document, m),
    ...checkF02(document, m),
    ...checkF03(document, m),
    ...checkF04(document, walked, m),
    ...checkF05(document, m),
    ...checkF06(document, m),
  ];
}

function checkM01(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  const pathsById = new Map<string, string[]>();
  for (const { path, element } of walked) {
    if (!isIdentifier(element.id)) {
      errors.push(err("M01", `${path}.id`, m.idNotIdentifier(element.id)));
    }
    const paths = pathsById.get(element.id) ?? [];
    paths.push(path);
    pathsById.set(element.id, paths);
  }
  for (const [id, paths] of pathsById) {
    if (paths.length > 1) {
      for (const path of paths) {
        errors.push(err("M01", `${path}.id`, m.idDuplicate(id)));
      }
    }
  }
  return errors;
}

// M02 checks that an element stays within the page; children are contained within their container's box, so they aren't checked individually (only top-level elements are examined).
function checkM02(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  const { width: pageWidth, height: pageHeight } = document.page;
  document.elements.forEach((element, i) => {
    const path = `elements[${i}]`;
    if (element.type === "table") {
      const width = element.columns.reduce(
        (total, col) => total + col.width,
        0,
      );
      if (element.x < 0) errors.push(err("M02", `${path}.x`, m.xNegative));
      if (element.y < 0) errors.push(err("M02", `${path}.y`, m.yNegative));
      if (element.x + width > pageWidth) {
        errors.push(err("M02", `${path}.x`, m.tableWidthExceedsPage));
      }
      return;
    }
    const { w, h } = footprint(element);
    if (element.x < 0) errors.push(err("M02", `${path}.x`, m.xNegative));
    if (element.y < 0) errors.push(err("M02", `${path}.y`, m.yNegative));
    if (element.x + w > pageWidth)
      errors.push(err("M02", `${path}.x`, m.elementExceedsPageRight));
    if (element.y + h > pageHeight)
      errors.push(err("M02", `${path}.y`, m.elementExceedsPageBottom));
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
  m: ValidateMessages,
): void {
  if (!(value > 0))
    errors.push(err("M03", `${path}.${field}`, m.mustBePositive(field)));
}

function pushNonNegative(
  errors: IrError[],
  path: string,
  field: string,
  value: number,
  m: ValidateMessages,
): void {
  if (!(value >= 0))
    errors.push(err("M03", `${path}.${field}`, m.mustBeNonNegative(field)));
}

function checkM03(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    switch (element.type) {
      case "text":
      case "image":
      case "pageNumber":
      case "barcode":
        pushPositive(errors, path, "w", element.w, m);
        pushPositive(errors, path, "h", element.h, m);
        break;
      case "rect":
        pushPositive(errors, path, "w", element.w, m);
        pushPositive(errors, path, "h", element.h, m);
        pushNonNegative(errors, path, "borderWidth", element.borderWidth, m);
        break;
      case "ellipse":
        pushPositive(errors, path, "w", element.w, m);
        pushPositive(errors, path, "h", element.h, m);
        pushNonNegative(errors, path, "borderWidth", element.borderWidth, m);
        break;
      case "line":
        pushPositive(errors, path, "length", element.length, m);
        pushPositive(errors, path, "thickness", element.thickness, m);
        break;
      case "table":
        pushPositive(errors, path, "rowHeight", element.rowHeight, m);
        pushPositive(errors, path, "headerHeight", element.headerHeight, m);
        if (element.frameWidth !== undefined) {
          pushPositive(errors, path, "frameWidth", element.frameWidth, m);
        }
        if (element.gridWidth !== undefined) {
          pushPositive(errors, path, "gridWidth", element.gridWidth, m);
        }
        element.columns.forEach((col, i) => {
          pushPositive(errors, `${path}.columns[${i}]`, "width", col.width, m);
        });
        break;
      case "flex": {
        pushNonNegative(errors, path, "gap", element.gap, m);
        const explicitMain =
          element.direction === "row" ? element.w : element.h;
        if (explicitMain !== undefined) {
          pushPositive(
            errors,
            path,
            element.direction === "row" ? "w" : "h",
            explicitMain,
            m,
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
  m: ValidateMessages,
): void {
  if (!(value > 0 && value <= max)) {
    errors.push(err("M04", `${path}.${field}`, m.mustBeInRange(field, max)));
  }
}

function checkM04(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type === "text" || element.type === "pageNumber") {
      checkRange(errors, path, "fontSize", element.fontSize, FONT_SIZE_MAX, m);
      checkRange(
        errors,
        path,
        "lineHeight",
        element.lineHeight,
        LINE_HEIGHT_MAX,
        m,
      );
    } else if (element.type === "table") {
      checkRange(errors, path, "fontSize", element.fontSize, FONT_SIZE_MAX, m);
    }
  }
  return errors;
}

function checkM05(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  const { width, height } = document.page;
  if (!(width >= PAGE_DIMENSION_MIN && width <= PAGE_DIMENSION_MAX)) {
    errors.push(
      err(
        "M05",
        "page.width",
        m.pageDimensionRange(
          "page.width",
          PAGE_DIMENSION_MIN,
          PAGE_DIMENSION_MAX,
        ),
      ),
    );
  }
  if (!(height >= PAGE_DIMENSION_MIN && height <= PAGE_DIMENSION_MAX)) {
    errors.push(
      err(
        "M05",
        "page.height",
        m.pageDimensionRange(
          "page.height",
          PAGE_DIMENSION_MIN,
          PAGE_DIMENSION_MAX,
        ),
      ),
    );
  }
  return errors;
}

function checkM06(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    const path = `elements[${i}]`;
    if (el.columns.length < 1) {
      errors.push(err("M06", `${path}.columns`, m.columnsRequired));
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
            err("M06", `${path}.columns[${j}].key`, m.columnKeyDuplicate(key)),
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
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const slot of ["regular", "bold", "italic", "boldItalic"] as const) {
    const name = document.font[slot];
    if (name !== undefined && !isIdentifier(name)) {
      errors.push(
        err("M07", `font.${slot}`, m.fontNameNotIdentifier(slot, name)),
      );
    }
  }
  for (const { path, element } of walked) {
    if (element.type === "table") {
      if (!isIdentifier(element.bind)) {
        errors.push(
          err("M07", `${path}.bind`, m.bindNotIdentifier(element.bind)),
        );
      }
      element.columns.forEach((col, i) => {
        if (!isIdentifier(col.key)) {
          errors.push(
            err(
              "M07",
              `${path}.columns[${i}].key`,
              m.columnKeyNotIdentifier(col.key),
            ),
          );
        }
      });
    }
  }
  return errors;
}

// atob is a global function present in both browsers and Node, but
// we declare a minimal type for it ourselves so we don't need to pull in lib.dom.d.ts.
declare function atob(data: string): string;

function isValidBase64(payload: string): boolean {
  try {
    atob(payload);
    return true;
  } catch {
    return false;
  }
}

function checkM08(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "image") continue;
    const match = DATA_URI_PATTERN.exec(element.src);
    if (!match) continue; // Already reported by S12
    const [, mediatype, payload] = match;
    if (mediatype !== "image/png" && mediatype !== "image/jpeg") {
      errors.push(
        err("M08", `${path}.src`, m.unsupportedMediatype(String(mediatype))),
      );
    }
    if (payload === undefined || !isValidBase64(payload)) {
      errors.push(err("M08", `${path}.src`, m.base64DecodeFailed));
    }
  }
  return errors;
}

function checkM09(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    const path = `elements[${i}]`;
    if (el.continuationY < 0) {
      errors.push(
        err(
          "M09",
          `${path}.continuationY`,
          m.mustBeNonNegative("continuationY"),
        ),
      );
    }
    if (el.maxY > document.page.height) {
      errors.push(err("M09", `${path}.maxY`, m.maxYExceedsPageHeight));
    }
    if (!(el.y + el.headerHeight + el.rowHeight <= el.maxY)) {
      errors.push(err("M09", `${path}.maxY`, m.firstPageNoRowCapacity));
    }
    if (!(el.continuationY + el.headerHeight + el.rowHeight <= el.maxY)) {
      errors.push(
        err("M09", `${path}.continuationY`, m.continuationPageNoRowCapacity),
      );
    }
  });
  return errors;
}

function checkM10(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table") return;
    if (!Number.isInteger(el.minRows) || el.minRows < 0) {
      errors.push(err("M10", `elements[${i}].minRows`, m.minRowsInvalid));
    }
  });
  return errors;
}

function checkM11(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type === "flex" && element.children.length < 1) {
      errors.push(err("M11", `${path}.children`, m.flexChildrenRequired));
    }
  }
  return errors;
}

function checkM12(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "flex") continue;
    const explicit = element.direction === "row" ? element.w : element.h;
    if (explicit === undefined) continue;
    const { contentMain } = measureFlex(element);
    if (explicit < contentMain) {
      const field = element.direction === "row" ? "w" : "h";
      errors.push(err("M12", `${path}.${field}`, m.mainAxisTooSmall));
    }
  }
  return errors;
}

function checkM13(document: IrDocument, m: ValidateMessages): IrError[] {
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
          err("M13", `${entryPath}.row`, m.rowMustBeNonNegativeInteger),
        );
      }
      if (!keys.has(override.key)) {
        errors.push(
          err("M13", `${entryPath}.key`, m.keyNotInColumns(override.key)),
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
            err("M13", `${path}.cellOverrides[${j}]`, m.rowKeyDuplicate),
          );
        }
      }
    }
  });
  return errors;
}

function checkM14(document: IrDocument, m: ValidateMessages): IrError[] {
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
          m.styleNameLengthInvalid(STYLE_NAME_MAX_LENGTH),
        ),
      );
    }
    if ((countByName.get(style.name) ?? 0) > 1) {
      errors.push(err("M14", `${path}.name`, m.styleNameDuplicate(style.name)));
    }
    if (Object.keys(style.attrs).length === 0) {
      errors.push(err("M14", `${path}.attrs`, m.styleAttrsRequired));
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
          m.mustBeInRange("fontSize", FONT_SIZE_MAX),
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
          m.mustBeInRange("lineHeight", LINE_HEIGHT_MAX),
        ),
      );
    }
    if (borderWidth !== undefined && !(borderWidth > 0)) {
      errors.push(
        err(
          "M14",
          `${path}.attrs.borderWidth`,
          m.mustBePositive("borderWidth"),
        ),
      );
    }
    if (thickness !== undefined && !(thickness > 0)) {
      errors.push(
        err("M14", `${path}.attrs.thickness`, m.mustBePositive("thickness")),
      );
    }
  });
  return errors;
}

function checkF02(document: IrDocument, m: ValidateMessages): IrError[] {
  const { footnotes } = document;
  if (footnotes === undefined) return [];
  const errors: IrError[] = [];
  const indicesById = new Map<string, number[]>();
  footnotes.notes.forEach((note, i) => {
    if (!isIdentifier(note.id)) {
      errors.push(
        err("F02", `footnotes.notes[${i}].id`, m.idNotIdentifier(note.id)),
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
          err("F02", `footnotes.notes[${i}].id`, m.noteIdDuplicate(id)),
        );
      }
    }
  }
  return errors;
}

function checkF03(document: IrDocument, m: ValidateMessages): IrError[] {
  const notesById = new Set(
    (document.footnotes?.notes ?? []).map((note) => note.id),
  );
  const errors: IrError[] = [];
  document.elements.forEach((element, i) => {
    if (element.type !== "text") return;
    for (const id of new Set(footnoteMarkIds(element.text))) {
      if (!notesById.has(id)) {
        errors.push(
          err("F03", `elements[${i}].text`, m.footnoteRefNotDefined(id)),
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
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element, isTopLevel } of walked) {
    if (element.type === "text" && !isTopLevel) {
      pushMarkError(
        errors,
        `${path}.text`,
        element.text,
        m.markNotAllowedInFlexText,
      );
    }
    if (element.type === "pageNumber") {
      pushMarkError(
        errors,
        `${path}.format`,
        element.format,
        m.markNotAllowedInPageNumberFormat,
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
        m.markNotAllowedInColumnLabel,
      );
    });
    (element.cellOverrides ?? []).forEach((override, j) => {
      pushMarkError(
        errors,
        `${path}.cellOverrides[${j}].value`,
        override.value,
        m.markNotAllowedInCellOverride,
      );
    });
  });
  document.footnotes?.notes.forEach((note, i) => {
    pushMarkError(
      errors,
      `footnotes.notes[${i}].text`,
      note.text,
      m.markNotAllowedInNoteText,
    );
  });
  return errors;
}

function checkF05(document: IrDocument, m: ValidateMessages): IrError[] {
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
        err("F05", `footnotes.notes[${i}].id`, m.noteNotReferenced(note.id)),
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
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  const names = new Set((document.styles ?? []).map((s) => s.name));
  for (const { path, element } of walked) {
    const style = elementStyleName(element);
    if (style !== undefined && !names.has(style)) {
      errors.push(err("M15", `${path}.style`, m.styleNotFound(style)));
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
  m: ValidateMessages,
): void {
  if (value === undefined) return;
  if (!COLOR_PATTERN.test(value)) {
    errors.push(
      err("M16", `${path}.${field}`, m.colorFormatInvalid(field, value)),
    );
  }
}

function checkM16(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    switch (element.type) {
      case "text":
      case "pageNumber":
        checkColorField(errors, path, "color", element.color, m);
        break;
      case "line":
        checkColorField(errors, path, "color", element.color, m);
        break;
      case "rect":
      case "ellipse":
        checkColorField(errors, path, "borderColor", element.borderColor, m);
        checkColorField(errors, path, "fillColor", element.fillColor, m);
        break;
      case "table":
        checkColorField(errors, path, "stripeColor", element.stripeColor, m);
        break;
      default:
        break;
    }
  }
  return errors;
}

function checkM17(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type !== "rect") continue;
    const { cornerRadius, borderStyle, w, h } = element;
    if (cornerRadius === undefined) continue;
    const maxRadius = Math.min(w, h) / 2;
    if (!(cornerRadius >= 0 && cornerRadius <= maxRadius)) {
      errors.push(
        err("M17", `${path}.cornerRadius`, m.cornerRadiusRange(maxRadius)),
      );
    }
    if (cornerRadius > 0 && (borderStyle ?? "solid") !== "solid") {
      errors.push(
        err("M17", `${path}.borderStyle`, m.cornerRadiusRequiresSolidBorder),
      );
    }
  }
  return errors;
}

function checkM18(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (
      element.name !== undefined &&
      element.name.length > ELEMENT_NAME_MAX_LENGTH
    ) {
      errors.push(
        err(
          "M18",
          `${path}.name`,
          m.nameLengthInvalid(ELEMENT_NAME_MAX_LENGTH),
        ),
      );
    }
  }
  return errors;
}

function checkM19(
  walked: readonly WalkedElement[],
  m: ValidateMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const { path, element } of walked) {
    if (element.type === "table" || element.type === "flex") continue;
    const rotate = element.rotate;
    if (rotate === undefined) continue;
    if (
      !(
        Number.isFinite(rotate) &&
        rotate >= -ROTATE_MAX &&
        rotate <= ROTATE_MAX
      )
    ) {
      errors.push(err("M19", `${path}.rotate`, m.rotateInvalid(ROTATE_MAX)));
    }
  }
  return errors;
}

interface SpanExtent {
  readonly index: number;
  readonly row: number | "header";
  readonly rowSpan: number;
  readonly col: number;
  readonly colSpan: number;
}

function extentsOverlap(a: SpanExtent, b: SpanExtent): boolean {
  const rowsOverlap =
    a.row === "header" || b.row === "header"
      ? a.row === b.row
      : a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;
  const colsOverlap = a.col < b.col + b.colSpan && b.col < a.col + a.colSpan;
  return rowsOverlap && colsOverlap;
}

function checkM20(document: IrDocument, m: ValidateMessages): IrError[] {
  const errors: IrError[] = [];
  document.elements.forEach((el, i) => {
    if (el.type !== "table" || el.cellSpans === undefined) return;
    const path = `elements[${i}]`;
    const indexByKey = new Map(el.columns.map((col, j) => [col.key, j]));
    const extents: SpanExtent[] = [];
    el.cellSpans.forEach((span, j) => {
      const entryPath = `${path}.cellSpans[${j}]`;
      let ok = true;
      if (
        span.row !== "header" &&
        (!Number.isInteger(span.row) || span.row < 0)
      ) {
        errors.push(
          err(
            "M20",
            `${entryPath}.row`,
            m.cellSpanRowNotNonNegativeIntegerOrHeader,
          ),
        );
        ok = false;
      }
      const col = indexByKey.get(span.key);
      if (col === undefined) {
        errors.push(
          err("M20", `${entryPath}.key`, m.keyNotInColumns(span.key)),
        );
        ok = false;
      }
      const rowSpan = span.rowSpan ?? 1;
      const colSpan = span.colSpan ?? 1;
      for (const [field, value] of [
        ["rowSpan", rowSpan],
        ["colSpan", colSpan],
      ] as const) {
        if (!Number.isInteger(value) || value < 1) {
          errors.push(
            err("M20", `${entryPath}.${field}`, m.mustBePositiveInteger(field)),
          );
          ok = false;
        }
      }
      if (ok && rowSpan === 1 && colSpan === 1) {
        errors.push(err("M20", entryPath, m.spanMustHaveOneGreaterThanOne));
        ok = false;
      }
      if (span.row === "header" && rowSpan !== 1) {
        errors.push(
          err("M20", `${entryPath}.rowSpan`, m.headerRowSpanMustBeOne),
        );
        ok = false;
      }
      if (ok && col !== undefined && col + colSpan > el.columns.length) {
        errors.push(
          err("M20", `${entryPath}.colSpan`, m.spanExceedsColumnRange),
        );
        ok = false;
      }
      if (ok && col !== undefined) {
        for (let c = col; c < col + colSpan; c++) {
          if (el.columns[c]?.mergeSameValue === true) {
            errors.push(
              err(
                "M20",
                entryPath,
                m.spanOverlapsMergedColumn(String(el.columns[c]?.key)),
              ),
            );
            ok = false;
            break;
          }
        }
      }
      if (ok && col !== undefined) {
        extents.push({ index: j, row: span.row, rowSpan, col, colSpan });
      }
    });
    for (let a = 0; a < extents.length; a++) {
      for (let b = a + 1; b < extents.length; b++) {
        const first = extents[a];
        const second = extents[b];
        if (
          first !== undefined &&
          second !== undefined &&
          extentsOverlap(first, second)
        ) {
          errors.push(
            err(
              "M20",
              `${path}.cellSpans[${second.index}]`,
              m.spanOverlapsOtherSpan(first.index),
            ),
          );
        }
      }
    }
  });
  return errors;
}

function checkF06(document: IrDocument, m: ValidateMessages): IrError[] {
  const { footnotes, page } = document;
  if (footnotes === undefined) return [];
  const errors: IrError[] = [];
  if (!(footnotes.x >= 0)) {
    errors.push(err("F06", "footnotes.x", m.mustBeNonNegative("x")));
  }
  if (!(footnotes.w >= 0)) {
    errors.push(err("F06", "footnotes.w", m.mustBeNonNegative("w")));
  }
  if (!(footnotes.bottom >= 0)) {
    errors.push(err("F06", "footnotes.bottom", m.mustBeNonNegative("bottom")));
  }
  if (!(footnotes.fontSize > 0 && footnotes.fontSize <= FONT_SIZE_MAX)) {
    errors.push(
      err(
        "F06",
        "footnotes.fontSize",
        m.mustBeInRange("fontSize", FONT_SIZE_MAX),
      ),
    );
  }
  if (!(footnotes.lineHeight > 0 && footnotes.lineHeight <= LINE_HEIGHT_MAX)) {
    errors.push(
      err(
        "F06",
        "footnotes.lineHeight",
        m.mustBeInRange("lineHeight", LINE_HEIGHT_MAX),
      ),
    );
  }
  if (footnotes.x + footnotes.w > page.width) {
    errors.push(err("F06", "footnotes.w", m.footnotesExceedPageRight));
  }
  if (footnotes.notes.length > 0) {
    const totalLines = footnotes.notes.reduce(
      (sum, note) => sum + note.text.split("\n").length,
      0,
    );
    const blockHeight =
      totalLines * footnotes.fontSize * footnotes.lineHeight * PT_TO_MM;
    if (page.height - footnotes.bottom - blockHeight < 0) {
      errors.push(err("F06", "footnotes.bottom", m.footnotesExceedPageTop));
    }
  }
  return errors;
}

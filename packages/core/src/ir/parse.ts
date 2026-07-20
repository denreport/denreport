import {
  getMessages,
  type MessageLocale,
  type Messages,
} from "../i18n/messages/index.js";
import { DATA_URI_PATTERN, PAGE_NUMBER_DEFAULT_FORMAT } from "./constants.js";
import type { IrError, IrRuleId } from "./errors.js";
import type {
  IrAlign,
  IrBarcodeSymbology,
  IrDocType,
  IrDocument,
  IrElement,
  IrFlexAlign,
  IrFlexDirection,
  IrFont,
  IrFontStyle,
  IrFontWeight,
  IrFootnotes,
  IrGroup,
  IrNamedStyle,
  IrOrientation,
  IrPage,
  IrPages,
  IrStrokeStyle,
  IrStyleAttrs,
} from "./types.js";
import { IR_VERSION } from "./types.js";

type ParseMessages = Messages["parse"];

/**
 * Result of parseIr: either the normalized document (default attribute values
 * filled in) or the syntax (S*) errors that prevented normalization.
 */
export type ParseIrResult =
  | { readonly ok: true; readonly document: IrDocument }
  | { readonly ok: false; readonly errors: readonly IrError[] };

/**
 * Parses raw JSON text into an IrDocument, checking JSON well-formedness and
 * the syntax-level (S*) rule group, and filling in default attribute values.
 * Does not check the semantic rule groups (M*, C*, Q01, F*) — call
 * validateIr, analyzeData/validateData, checkQualifiedInvoice as needed for those.
 * `options.locale` controls the error messages' language (default "ja").
 */
export function parseIr(
  json: string,
  options?: { readonly locale?: MessageLocale },
): ParseIrResult {
  const m = getMessages(options?.locale).parse;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {
      ok: false,
      errors: [err("S01", "$", m.invalidJson)],
    };
  }

  const errors = collectSyntaxErrors(raw, m);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, document: normalize(raw as Record<string, unknown>) };
}

function err(rule: IrRuleId, path: string, message: string): IrError {
  return { rule, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

const ROOT_REQUIRED_KEYS = ["version", "page", "font", "elements"] as const;
const ROOT_OPTIONAL_KEYS = [
  "styles",
  "docType",
  "footnotes",
  "groups",
] as const;
const ROOT_KEYS = [...ROOT_REQUIRED_KEYS, ...ROOT_OPTIONAL_KEYS] as const;
const STYLE_ATTR_KEYS = [
  "fontSize",
  "align",
  "lineHeight",
  "fontWeight",
  "fontStyle",
  "underline",
  "borderWidth",
  "thickness",
] as const;
const ELEMENT_TYPES = [
  "text",
  "line",
  "rect",
  "ellipse",
  "table",
  "image",
  "flex",
  "pageNumber",
  "barcode",
] as const;
type ElementType = (typeof ELEMENT_TYPES)[number];

function collectSyntaxErrors(raw: unknown, m: ParseMessages): IrError[] {
  if (!isPlainObject(raw)) {
    return [err("S02", "$", m.rootNotObject)];
  }
  const errors: IrError[] = [];
  errors.push(...checkRootKeys(raw, m));
  if ("version" in raw) errors.push(...checkVersion(raw.version, m));
  if ("page" in raw) errors.push(...checkPage(raw.page, m));
  if ("font" in raw) errors.push(...checkFont(raw.font, m));
  if ("styles" in raw) errors.push(...checkStyles(raw.styles, m));
  if ("elements" in raw) errors.push(...checkElementsArray(raw.elements, m));
  if ("docType" in raw) errors.push(...checkDocType(raw.docType, m));
  if ("footnotes" in raw) errors.push(...checkFootnotes(raw.footnotes, m));
  if ("groups" in raw) errors.push(...checkGroups(raw.groups, m));
  return errors;
}

function checkRootKeys(
  raw: Record<string, unknown>,
  m: ParseMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const key of ROOT_REQUIRED_KEYS) {
    if (!(key in raw)) errors.push(err("S02", key, m.missingRequiredKey(key)));
  }
  const allowed: readonly string[] = ROOT_KEYS;
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      errors.push(err("S02", key, m.unknownKey(key)));
    }
  }
  return errors;
}

function checkStyles(value: unknown, m: ParseMessages): IrError[] {
  if (!Array.isArray(value)) {
    return [err("S14", "styles", m.mustBeArray("styles"))];
  }
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `styles[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(err("S14", path, m.stylesItemNotObject));
      return;
    }
    for (const key of Object.keys(item)) {
      if (key !== "name" && key !== "attrs") {
        errors.push(err("S14", `${path}.${key}`, m.unknownKey(key)));
      }
    }
    if (!isString(item.name)) {
      errors.push(err("S14", `${path}.name`, m.typeMustBe("name", "string")));
    }
    const attrs = item.attrs;
    if (!isPlainObject(attrs)) {
      errors.push(err("S14", `${path}.attrs`, m.notAnObject("attrs")));
      return;
    }
    for (const key of Object.keys(attrs)) {
      const attrPath = `${path}.attrs.${key}`;
      if (!(STYLE_ATTR_KEYS as readonly string[]).includes(key)) {
        errors.push(err("S14", attrPath, m.unknownAttribute(key)));
        continue;
      }
      const v = attrs[key];
      if (key === "align" || key === "fontWeight" || key === "fontStyle") {
        if (!isString(v) || !(ENUM_DOMAINS[key] ?? []).includes(v)) {
          errors.push(err("S14", attrPath, m.invalidValue(key, String(v))));
        }
      } else if (key === "underline") {
        if (typeof v !== "boolean") {
          errors.push(
            err("S14", attrPath, m.typeMustBe("underline", "boolean")),
          );
        }
      } else if (!isNumber(v)) {
        errors.push(err("S14", attrPath, m.typeMustBe(key, "number")));
      }
    }
  });
  return errors;
}

function checkDocType(value: unknown, m: ParseMessages): IrError[] {
  if (isString(value) && value === "qualifiedInvoice") return [];
  return [err("S10", "docType", m.docTypeInvalid(JSON.stringify(value)))];
}

const VERSION_PATTERN = /^1\.(0|[1-9][0-9]*)$/;
const VERSION_SHAPE_PATTERN = /^(\d+)\.(\d+)$/;

function checkVersion(value: unknown, m: ParseMessages): IrError[] {
  if (!isString(value)) {
    return [err("S03", "version", m.typeMustBe("version", "string"))];
  }
  if (VERSION_PATTERN.test(value)) {
    const minor = Number(value.slice("1.".length));
    const supportedMinor = Number(IR_VERSION.split(".")[1]);
    if (minor > supportedMinor) {
      return [
        err("S03", "version", m.unsupportedMinorVersion(value, IR_VERSION)),
      ];
    }
    return [];
  }
  const shape = VERSION_SHAPE_PATTERN.exec(value);
  if (shape?.[1] !== undefined && shape[1] !== "1") {
    return [err("S03", "version", m.unsupportedMajorVersion(value))];
  }
  return [err("S03", "version", m.invalidVersionFormat(value))];
}

function checkPage(value: unknown, m: ParseMessages): IrError[] {
  if (!isPlainObject(value)) return [err("S04", "page", m.notAnObject("page"))];
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "width" && key !== "height")
      errors.push(err("S04", `page.${key}`, m.unknownKey(key)));
  }
  if (!isNumber(value.width))
    errors.push(err("S04", "page.width", m.typeMustBe("width", "number")));
  if (!isNumber(value.height))
    errors.push(err("S04", "page.height", m.typeMustBe("height", "number")));
  return errors;
}

const FONT_SLOT_KEYS = ["regular", "bold", "italic", "boldItalic"] as const;

function checkFont(value: unknown, m: ParseMessages): IrError[] {
  if (!isPlainObject(value)) return [err("S05", "font", m.notAnObject("font"))];
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (!(FONT_SLOT_KEYS as readonly string[]).includes(key))
      errors.push(err("S05", `font.${key}`, m.unknownKey(key)));
  }
  if (!isString(value.regular))
    errors.push(err("S05", "font.regular", m.typeMustBe("regular", "string")));
  for (const slot of FONT_SLOT_KEYS) {
    if (slot === "regular") continue;
    if (slot in value && !isString(value[slot]))
      errors.push(err("S05", `font.${slot}`, m.typeMustBe(slot, "string")));
  }
  return errors;
}

function checkElementsArray(value: unknown, m: ParseMessages): IrError[] {
  if (!Array.isArray(value))
    return [err("S06", "elements", m.mustBeArray("elements"))];
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `elements[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(err("S06", path, m.elementNotObject));
      return;
    }
    errors.push(...checkElement(item, path, false, m));
  });
  return errors;
}

const FOOTNOTES_ALLOWED_KEYS = [
  "x",
  "w",
  "bottom",
  "fontSize",
  "lineHeight",
  "pages",
  "notes",
] as const;
const FOOTNOTE_NOTE_ALLOWED_KEYS = ["id", "text"] as const;

function checkFootnotes(value: unknown, m: ParseMessages): IrError[] {
  if (!isPlainObject(value)) {
    return [err("F01", "footnotes", m.notAnObject("footnotes"))];
  }
  const errors: IrError[] = [];
  for (const key of FOOTNOTES_ALLOWED_KEYS) {
    if (!(key in value))
      errors.push(err("F01", `footnotes.${key}`, m.missingRequiredKey(key)));
  }
  for (const key of Object.keys(value)) {
    if (!(FOOTNOTES_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(err("F01", `footnotes.${key}`, m.unknownKey(key)));
    }
  }
  checkRequiredType(errors, value, "x", "footnotes", "F01", "number", m);
  checkRequiredType(errors, value, "w", "footnotes", "F01", "number", m);
  checkRequiredType(errors, value, "bottom", "footnotes", "F01", "number", m);
  checkRequiredType(errors, value, "fontSize", "footnotes", "F01", "number", m);
  checkRequiredType(
    errors,
    value,
    "lineHeight",
    "footnotes",
    "F01",
    "number",
    m,
  );
  checkRequiredType(errors, value, "pages", "footnotes", "F01", "string", m);
  if (
    isString(value.pages) &&
    ENUM_DOMAINS.pages?.includes(value.pages) === false
  ) {
    errors.push(
      err("S10", "footnotes.pages", m.invalidValue("pages", value.pages)),
    );
  }
  if (!("notes" in value)) {
    return errors;
  }
  const notes = value.notes;
  if (!Array.isArray(notes)) {
    errors.push(err("F01", "footnotes.notes", m.mustBeArray("notes")));
    return errors;
  }
  notes.forEach((note, i) => {
    const notePath = `footnotes.notes[${i}]`;
    if (!isPlainObject(note)) {
      errors.push(err("F01", notePath, m.noteNotObject));
      return;
    }
    checkRequiredType(errors, note, "id", notePath, "F01", "string", m);
    checkRequiredType(errors, note, "text", notePath, "F01", "string", m);
    for (const key of Object.keys(note)) {
      if (!(FOOTNOTE_NOTE_ALLOWED_KEYS as readonly string[]).includes(key)) {
        errors.push(err("F01", `${notePath}.${key}`, m.unknownKey(key)));
      }
    }
  });
  return errors;
}

const GROUP_ALLOWED_KEYS = ["id", "memberIds"] as const;

function checkGroups(value: unknown, m: ParseMessages): IrError[] {
  if (!Array.isArray(value)) {
    return [err("S15", "groups", m.mustBeArray("groups"))];
  }
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `groups[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(err("S15", path, m.groupNotObject));
      return;
    }
    for (const key of Object.keys(item)) {
      if (!(GROUP_ALLOWED_KEYS as readonly string[]).includes(key)) {
        errors.push(err("S15", `${path}.${key}`, m.unknownKey(key)));
      }
    }
    checkRequiredType(errors, item, "id", path, "S15", "string", m);
    const memberIds = item.memberIds;
    if (!Array.isArray(memberIds) || !memberIds.every(isString)) {
      errors.push(err("S15", `${path}.memberIds`, m.memberIdsInvalid));
    }
  });
  return errors;
}

function checkElement(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const type = value.type;
  if (!isString(type) || !(ELEMENT_TYPES as readonly string[]).includes(type)) {
    return [err("S07", `${path}.type`, m.invalidElementType(String(type)))];
  }
  if (isFlexChild && type === "table") {
    return [err("S13", path, m.flexChildCannotBeTable)];
  }
  const elementType = type as ElementType;

  const errors: IrError[] = [];
  const allowed = computeAllowedKeys(value, elementType, isFlexChild);
  errors.push(
    ...checkRequiredAndTypes(value, elementType, path, isFlexChild, m),
  );
  errors.push(...checkUnknownAttributes(value, elementType, path, allowed, m));
  errors.push(...checkEnumValues(value, path, allowed, m));
  if (elementType === "image") errors.push(...checkImageSrc(value, path, m));
  if (elementType === "flex") errors.push(...checkFlexChildren(value, path, m));
  return errors;
}

function checkRequiredType(
  errors: IrError[],
  value: Record<string, unknown>,
  key: string,
  path: string,
  rule: IrRuleId,
  kind: "string" | "number",
  m: ParseMessages,
): void {
  const v = value[key];
  const ok = kind === "string" ? isString(v) : isNumber(v);
  if (!ok)
    errors.push(err(rule, `${path}.${key}`, m.typeMustBeRequired(key, kind)));
}

function checkOptionalType(
  errors: IrError[],
  value: Record<string, unknown>,
  key: string,
  path: string,
  rule: IrRuleId,
  kind: "string" | "number" | "boolean",
  m: ParseMessages,
): void {
  if (!(key in value)) return;
  const v = value[key];
  const ok =
    kind === "string"
      ? isString(v)
      : kind === "number"
        ? isNumber(v)
        : typeof v === "boolean";
  if (!ok) errors.push(err(rule, `${path}.${key}`, m.typeMustBe(key, kind)));
}

function checkCommonRequired(
  value: Record<string, unknown>,
  path: string,
  rule: IrRuleId,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors: IrError[] = [];
  checkRequiredType(errors, value, "id", path, rule, "string", m);
  checkOptionalType(errors, value, "name", path, rule, "string", m);
  if (!isFlexChild) {
    checkRequiredType(errors, value, "x", path, rule, "number", m);
    checkRequiredType(errors, value, "y", path, rule, "number", m);
    checkOptionalType(errors, value, "pages", path, rule, "string", m);
  }
  return errors;
}

function checkRequiredAndTypes(
  value: Record<string, unknown>,
  type: ElementType,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  switch (type) {
    case "text":
      return checkS08Text(value, path, isFlexChild, m);
    case "line":
      return checkS08Line(value, path, isFlexChild, m);
    case "rect":
      return checkS08Rect(value, path, isFlexChild, m);
    case "ellipse":
      return checkS08Ellipse(value, path, isFlexChild, m);
    case "table":
      return checkS08Table(value, path, m);
    case "image":
      return checkS08Image(value, path, isFlexChild, m);
    case "flex":
      return checkS08Flex(value, path, isFlexChild, m);
    case "pageNumber":
      return checkS08PageNumber(value, path, isFlexChild, m);
    case "barcode":
      return checkS08Barcode(value, path, isFlexChild, m);
  }
}

function checkS08Text(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08t", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08t", "number", m);
  checkRequiredType(errors, value, "h", path, "S08t", "number", m);
  checkRequiredType(errors, value, "text", path, "S08t", "string", m);
  checkOptionalType(errors, value, "fontSize", path, "S08t", "number", m);
  checkOptionalType(errors, value, "align", path, "S08t", "string", m);
  checkOptionalType(errors, value, "lineHeight", path, "S08t", "number", m);
  checkOptionalType(errors, value, "fontWeight", path, "S08t", "string", m);
  checkOptionalType(errors, value, "fontStyle", path, "S08t", "string", m);
  checkOptionalType(errors, value, "underline", path, "S08t", "boolean", m);
  checkOptionalType(errors, value, "color", path, "S08t", "string", m);
  checkOptionalType(errors, value, "style", path, "S08t", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08t", "number", m);
  return errors;
}

function checkS08Line(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08l", isFlexChild, m);
  checkRequiredType(errors, value, "orientation", path, "S08l", "string", m);
  checkRequiredType(errors, value, "length", path, "S08l", "number", m);
  checkOptionalType(errors, value, "thickness", path, "S08l", "number", m);
  checkOptionalType(errors, value, "color", path, "S08l", "string", m);
  checkOptionalType(errors, value, "strokeStyle", path, "S08l", "string", m);
  checkOptionalType(errors, value, "style", path, "S08l", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08l", "number", m);
  return errors;
}

function checkS08Rect(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08r", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08r", "number", m);
  checkRequiredType(errors, value, "h", path, "S08r", "number", m);
  checkOptionalType(errors, value, "borderWidth", path, "S08r", "number", m);
  checkOptionalType(errors, value, "style", path, "S08r", "string", m);
  checkOptionalType(errors, value, "borderColor", path, "S08r", "string", m);
  checkOptionalType(errors, value, "fillColor", path, "S08r", "string", m);
  checkOptionalType(errors, value, "borderStyle", path, "S08r", "string", m);
  checkOptionalType(errors, value, "cornerRadius", path, "S08r", "number", m);
  checkOptionalType(errors, value, "rotate", path, "S08r", "number", m);
  return errors;
}

function checkS08Ellipse(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08e", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08e", "number", m);
  checkRequiredType(errors, value, "h", path, "S08e", "number", m);
  checkRequiredType(errors, value, "borderWidth", path, "S08e", "number", m);
  checkOptionalType(errors, value, "borderColor", path, "S08e", "string", m);
  checkOptionalType(errors, value, "fillColor", path, "S08e", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08e", "number", m);
  return errors;
}

function checkS08Table(
  value: Record<string, unknown>,
  path: string,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08b", false, m);
  checkRequiredType(errors, value, "bind", path, "S08b", "string", m);
  checkRequiredType(errors, value, "rowHeight", path, "S08b", "number", m);
  checkRequiredType(errors, value, "headerHeight", path, "S08b", "number", m);
  checkOptionalType(errors, value, "fontSize", path, "S08b", "number", m);
  checkOptionalType(errors, value, "maxY", path, "S08b", "number", m);
  checkOptionalType(errors, value, "continuationY", path, "S08b", "number", m);
  checkOptionalType(errors, value, "minRows", path, "S08b", "number", m);
  checkOptionalType(errors, value, "frameWidth", path, "S08b", "number", m);
  checkOptionalType(errors, value, "gridWidth", path, "S08b", "number", m);
  checkOptionalType(errors, value, "frameStyle", path, "S08b", "string", m);
  checkOptionalType(errors, value, "gridStyle", path, "S08b", "string", m);
  checkOptionalType(errors, value, "stripeColor", path, "S08b", "string", m);
  checkOptionalType(errors, value, "style", path, "S08b", "string", m);

  const columns = value.columns;
  if (!Array.isArray(columns)) {
    errors.push(err("S08b", `${path}.columns`, m.mustBeArray("columns")));
    return errors;
  }
  columns.forEach((col, i) => {
    const colPath = `${path}.columns[${i}]`;
    if (!isPlainObject(col)) {
      errors.push(err("S08b", colPath, m.columnNotObject));
      return;
    }
    checkRequiredType(errors, col, "key", colPath, "S08b", "string", m);
    checkRequiredType(errors, col, "label", colPath, "S08b", "string", m);
    checkRequiredType(errors, col, "width", colPath, "S08b", "number", m);
    checkOptionalType(errors, col, "align", colPath, "S08b", "string", m);
    checkOptionalType(
      errors,
      col,
      "mergeSameValue",
      colPath,
      "S08b",
      "boolean",
      m,
    );
  });

  if ("cellOverrides" in value) {
    const cellOverrides = value.cellOverrides;
    if (!Array.isArray(cellOverrides)) {
      errors.push(
        err("S08b", `${path}.cellOverrides`, m.mustBeArray("cellOverrides")),
      );
    } else {
      cellOverrides.forEach((entry, j) => {
        const entryPath = `${path}.cellOverrides[${j}]`;
        if (!isPlainObject(entry)) {
          errors.push(err("S08b", entryPath, m.cellOverrideNotObject));
          return;
        }
        checkRequiredType(errors, entry, "row", entryPath, "S08b", "number", m);
        checkRequiredType(errors, entry, "key", entryPath, "S08b", "string", m);
        checkRequiredType(
          errors,
          entry,
          "value",
          entryPath,
          "S08b",
          "string",
          m,
        );
      });
    }
  }

  if ("cellSpans" in value) {
    const cellSpans = value.cellSpans;
    if (!Array.isArray(cellSpans)) {
      errors.push(err("S08b", `${path}.cellSpans`, m.mustBeArray("cellSpans")));
    } else {
      cellSpans.forEach((entry, j) => {
        const entryPath = `${path}.cellSpans[${j}]`;
        if (!isPlainObject(entry)) {
          errors.push(err("S08b", entryPath, m.cellSpanNotObject));
          return;
        }
        if (!isNumber(entry.row) && entry.row !== "header") {
          errors.push(err("S08b", `${entryPath}.row`, m.cellSpanRowInvalid));
        }
        checkRequiredType(errors, entry, "key", entryPath, "S08b", "string", m);
        checkOptionalType(
          errors,
          entry,
          "rowSpan",
          entryPath,
          "S08b",
          "number",
          m,
        );
        checkOptionalType(
          errors,
          entry,
          "colSpan",
          entryPath,
          "S08b",
          "number",
          m,
        );
      });
    }
  }
  return errors;
}

function checkS08Image(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08i", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08i", "number", m);
  checkRequiredType(errors, value, "h", path, "S08i", "number", m);
  checkRequiredType(errors, value, "src", path, "S08i", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08i", "number", m);
  return errors;
}

function checkS08Flex(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08f", isFlexChild, m);
  checkRequiredType(errors, value, "direction", path, "S08f", "string", m);
  checkOptionalType(errors, value, "w", path, "S08f", "number", m);
  checkOptionalType(errors, value, "h", path, "S08f", "number", m);
  checkOptionalType(errors, value, "gap", path, "S08f", "number", m);
  checkOptionalType(errors, value, "justifyContent", path, "S08f", "string", m);
  checkOptionalType(errors, value, "alignItems", path, "S08f", "string", m);
  if (!Array.isArray(value.children)) {
    errors.push(err("S08f", `${path}.children`, m.mustBeArray("children")));
  }
  return errors;
}

function checkS08PageNumber(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08p", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08p", "number", m);
  checkRequiredType(errors, value, "h", path, "S08p", "number", m);
  checkOptionalType(errors, value, "format", path, "S08p", "string", m);
  checkOptionalType(errors, value, "fontSize", path, "S08p", "number", m);
  checkOptionalType(errors, value, "align", path, "S08p", "string", m);
  checkOptionalType(errors, value, "lineHeight", path, "S08p", "number", m);
  checkOptionalType(errors, value, "color", path, "S08p", "string", m);
  checkOptionalType(errors, value, "style", path, "S08p", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08p", "number", m);
  return errors;
}

function checkS08Barcode(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
  m: ParseMessages,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08c", isFlexChild, m);
  checkRequiredType(errors, value, "w", path, "S08c", "number", m);
  checkRequiredType(errors, value, "h", path, "S08c", "number", m);
  checkRequiredType(errors, value, "symbology", path, "S08c", "string", m);
  checkRequiredType(errors, value, "value", path, "S08c", "string", m);
  checkOptionalType(errors, value, "rotate", path, "S08c", "number", m);
  return errors;
}

const ALLOWED_KEYS: Record<ElementType, readonly string[]> = {
  text: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "w",
    "h",
    "text",
    "fontSize",
    "align",
    "lineHeight",
    "fontWeight",
    "fontStyle",
    "underline",
    "color",
    "style",
    "rotate",
  ],
  line: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "orientation",
    "length",
    "thickness",
    "color",
    "strokeStyle",
    "style",
    "rotate",
  ],
  rect: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "w",
    "h",
    "borderWidth",
    "borderColor",
    "fillColor",
    "borderStyle",
    "cornerRadius",
    "style",
    "rotate",
  ],
  ellipse: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "w",
    "h",
    "borderWidth",
    "borderColor",
    "fillColor",
    "rotate",
  ],
  table: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "bind",
    "columns",
    "rowHeight",
    "headerHeight",
    "fontSize",
    "maxY",
    "continuationY",
    "minRows",
    "frameWidth",
    "gridWidth",
    "frameStyle",
    "gridStyle",
    "cellOverrides",
    "cellSpans",
    "stripeColor",
    "style",
  ],
  image: ["type", "id", "name", "x", "y", "pages", "w", "h", "src", "rotate"],
  flex: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "direction",
    "w",
    "h",
    "gap",
    "justifyContent",
    "alignItems",
    "children",
  ],
  pageNumber: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "w",
    "h",
    "format",
    "fontSize",
    "align",
    "lineHeight",
    "color",
    "style",
    "rotate",
  ],
  barcode: [
    "type",
    "id",
    "name",
    "x",
    "y",
    "pages",
    "w",
    "h",
    "symbology",
    "value",
    "rotate",
  ],
};
const COLUMN_ALLOWED_KEYS = [
  "key",
  "label",
  "width",
  "align",
  "mergeSameValue",
];
const CELL_OVERRIDE_ALLOWED_KEYS = ["row", "key", "value"];
const CELL_SPAN_ALLOWED_KEYS = ["row", "key", "rowSpan", "colSpan"];

function computeAllowedKeys(
  value: Record<string, unknown>,
  type: ElementType,
  isFlexChild: boolean,
): readonly string[] {
  let allowed = ALLOWED_KEYS[type];
  if (isFlexChild) {
    allowed = allowed.filter(
      (key) => key !== "x" && key !== "y" && key !== "pages",
    );
  }
  if (type === "flex") {
    if (value.direction === "row")
      allowed = allowed.filter((key) => key !== "h");
    if (value.direction === "column")
      allowed = allowed.filter((key) => key !== "w");
  }
  return allowed;
}

function checkUnknownAttributes(
  value: Record<string, unknown>,
  type: ElementType,
  path: string,
  allowed: readonly string[],
  m: ParseMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    if (type === "text" && key === "bind") {
      errors.push(err("S09", `${path}.${key}`, m.bindAttributeRemoved(key)));
      continue;
    }
    errors.push(err("S09", `${path}.${key}`, m.unknownAttribute(key)));
  }
  if (type === "table" && Array.isArray(value.columns)) {
    value.columns.forEach((col, i) => {
      if (!isPlainObject(col)) return;
      for (const key of Object.keys(col)) {
        if (!COLUMN_ALLOWED_KEYS.includes(key)) {
          errors.push(
            err("S09", `${path}.columns[${i}].${key}`, m.unknownAttribute(key)),
          );
        }
      }
    });
  }
  if (type === "table" && Array.isArray(value.cellOverrides)) {
    value.cellOverrides.forEach((entry, j) => {
      if (!isPlainObject(entry)) return;
      for (const key of Object.keys(entry)) {
        if (!CELL_OVERRIDE_ALLOWED_KEYS.includes(key)) {
          errors.push(
            err(
              "S09",
              `${path}.cellOverrides[${j}].${key}`,
              m.unknownAttribute(key),
            ),
          );
        }
      }
    });
  }
  if (type === "table" && Array.isArray(value.cellSpans)) {
    value.cellSpans.forEach((entry, j) => {
      if (!isPlainObject(entry)) return;
      for (const key of Object.keys(entry)) {
        if (!CELL_SPAN_ALLOWED_KEYS.includes(key)) {
          errors.push(
            err(
              "S09",
              `${path}.cellSpans[${j}].${key}`,
              m.unknownAttribute(key),
            ),
          );
        }
      }
    });
  }
  return errors;
}

const STROKE_STYLE_DOMAIN = [
  "solid",
  "dotted",
  "dashed",
  "dashdot",
  "dashdotdot",
] as const;

const ENUM_DOMAINS: Record<string, readonly string[]> = {
  align: ["left", "center", "right", "justify"],
  fontWeight: ["normal", "bold"],
  fontStyle: ["normal", "italic"],
  orientation: ["horizontal", "vertical"],
  direction: ["row", "column"],
  justifyContent: ["start", "center", "end"],
  alignItems: ["start", "center", "end"],
  pages: ["first", "rest", "last", "all"],
  strokeStyle: STROKE_STYLE_DOMAIN,
  borderStyle: STROKE_STYLE_DOMAIN,
  frameStyle: STROKE_STYLE_DOMAIN,
  gridStyle: STROKE_STYLE_DOMAIN,
  symbology: ["qrcode", "code39", "code128", "ean13"],
};

function checkEnumValues(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  m: ParseMessages,
): IrError[] {
  const errors: IrError[] = [];
  for (const [key, domain] of Object.entries(ENUM_DOMAINS)) {
    if (!allowed.includes(key)) continue; // An attribute unknown to that element type (covered by S09) is not double-reported by S10
    if (!(key in value)) continue;
    const v = value[key];
    if (isString(v) && !domain.includes(v)) {
      errors.push(err("S10", `${path}.${key}`, m.invalidValue(key, v)));
    }
  }
  return errors;
}

function checkImageSrc(
  value: Record<string, unknown>,
  path: string,
  m: ParseMessages,
): IrError[] {
  const src = value.src;
  if (!isString(src) || !DATA_URI_PATTERN.test(src)) {
    return [err("S12", `${path}.src`, m.imageSrcInvalid)];
  }
  return [];
}

function checkFlexChildren(
  value: Record<string, unknown>,
  path: string,
  m: ParseMessages,
): IrError[] {
  const children = value.children;
  if (!Array.isArray(children)) return [];
  const errors: IrError[] = [];
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (!isPlainObject(child)) {
      errors.push(err("S13", childPath, m.flexChildNotObject));
      return;
    }
    errors.push(...checkElement(child, childPath, true, m));
  });
  return errors;
}

// This function assumes it's called only after collectSyntaxErrors has returned zero errors,
// so it normalizes trusting each attribute's type without re-validating it.
function normalize(raw: Record<string, unknown>): IrDocument {
  const pageRaw = raw.page as Record<string, unknown>;
  const fontRaw = raw.font as Record<string, unknown>;
  const page: IrPage = {
    width: pageRaw.width as number,
    height: pageRaw.height as number,
  };
  const elements = (raw.elements as Record<string, unknown>[]).map((el) =>
    normalizeElement(el, page, false),
  );
  const styles =
    "styles" in raw
      ? normalizeStyles(raw.styles as Record<string, unknown>[])
      : undefined;
  const footnotesRaw = raw.footnotes as Record<string, unknown> | undefined;
  const groupsRaw = raw.groups as Record<string, unknown>[] | undefined;
  return {
    version: raw.version as string,
    page,
    font: normalizeFont(fontRaw),
    ...(styles !== undefined ? { styles } : {}),
    elements: elements as unknown as readonly IrElement[],
    ...("docType" in raw ? { docType: raw.docType as IrDocType } : {}),
    ...(footnotesRaw !== undefined
      ? { footnotes: normalizeFootnotes(footnotesRaw) }
      : {}),
    ...(groupsRaw !== undefined ? { groups: normalizeGroups(groupsRaw) } : {}),
  };
}

// An optional slot only has its key set when specified (not filled with undefined)
function normalizeFont(raw: Record<string, unknown>): IrFont {
  return {
    regular: raw.regular as string,
    ...("bold" in raw ? { bold: raw.bold as string } : {}),
    ...("italic" in raw ? { italic: raw.italic as string } : {}),
    ...("boldItalic" in raw ? { boldItalic: raw.boldItalic as string } : {}),
  };
}

// All attributes of groups are required, so after passing S15 they're copied as-is with no default filling
function normalizeGroups(raw: Record<string, unknown>[]): IrGroup[] {
  return raw.map((item) => ({
    id: item.id as string,
    memberIds: item.memberIds as string[],
  }));
}

// All attributes of footnotes are required, so after passing S/F01 they're copied as-is with no default filling
function normalizeFootnotes(value: Record<string, unknown>): IrFootnotes {
  return {
    x: value.x as number,
    w: value.w as number,
    bottom: value.bottom as number,
    fontSize: value.fontSize as number,
    lineHeight: value.lineHeight as number,
    pages: value.pages as IrPages,
    notes: (value.notes as Record<string, unknown>[]).map((note) => ({
      id: note.id as string,
      text: note.text as string,
    })),
  };
}

function normalizeStyles(raw: Record<string, unknown>[]): IrNamedStyle[] {
  return raw.map((item) => {
    const attrsRaw = item.attrs as Record<string, unknown>;
    const attrs: Record<string, unknown> = {};
    for (const key of STYLE_ATTR_KEYS) {
      if (key in attrsRaw) attrs[key] = attrsRaw[key];
    }
    return { name: item.name as string, attrs: attrs as IrStyleAttrs };
  });
}

/** style is an optional attribute, so this returns an object that only has the key when specified (to be spread into `{}`) */
function styleAttr(value: Record<string, unknown>): { style?: string } {
  return value.style !== undefined ? { style: value.style as string } : {};
}

/** name is an optional attribute, so this returns an object that only has the key when specified (to be spread into `{}`) */
function nameAttr(value: Record<string, unknown>): { name?: string } {
  return value.name !== undefined ? { name: value.name as string } : {};
}

/** rotate is an optional attribute, so this returns an object that only has the key when specified (not filled with 0) */
function rotateAttr(value: Record<string, unknown>): { rotate?: number } {
  return value.rotate !== undefined ? { rotate: value.rotate as number } : {};
}

function normalizeElement(
  value: Record<string, unknown>,
  page: IrPage,
  isFlexChild: boolean,
): Record<string, unknown> {
  const type = value.type as ElementType;
  const positioned: Record<string, unknown> = isFlexChild
    ? {}
    : {
        x: value.x as number,
        y: value.y as number,
        pages:
          (value.pages as IrPages | undefined) ??
          (type === "pageNumber" ? "all" : "first"),
      };
  const common = {
    type,
    id: value.id as string,
    ...nameAttr(value),
    ...positioned,
  };

  switch (type) {
    case "text":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        text: value.text as string,
        fontSize: (value.fontSize as number | undefined) ?? 10,
        align: (value.align as IrAlign | undefined) ?? "left",
        lineHeight: (value.lineHeight as number | undefined) ?? 1.25,
        ...("fontWeight" in value
          ? { fontWeight: value.fontWeight as IrFontWeight }
          : {}),
        ...("fontStyle" in value
          ? { fontStyle: value.fontStyle as IrFontStyle }
          : {}),
        ...("underline" in value
          ? { underline: value.underline as boolean }
          : {}),
        ...("color" in value ? { color: value.color as string } : {}),
        ...styleAttr(value),
        ...rotateAttr(value),
      };
    case "line":
      return {
        ...common,
        orientation: value.orientation as IrOrientation,
        length: value.length as number,
        thickness: (value.thickness as number | undefined) ?? 0.3,
        ...("color" in value ? { color: value.color as string } : {}),
        ...("strokeStyle" in value
          ? { strokeStyle: value.strokeStyle as IrStrokeStyle }
          : {}),
        ...styleAttr(value),
        ...rotateAttr(value),
      };
    case "rect":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        borderWidth: (value.borderWidth as number | undefined) ?? 0.3,
        ...("borderColor" in value
          ? { borderColor: value.borderColor as string }
          : {}),
        ...("fillColor" in value
          ? { fillColor: value.fillColor as string }
          : {}),
        ...("borderStyle" in value
          ? { borderStyle: value.borderStyle as IrStrokeStyle }
          : {}),
        ...("cornerRadius" in value
          ? { cornerRadius: value.cornerRadius as number }
          : {}),
        ...styleAttr(value),
        ...rotateAttr(value),
      };
    case "ellipse":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        borderWidth: value.borderWidth as number,
        ...("borderColor" in value
          ? { borderColor: value.borderColor as string }
          : {}),
        ...("fillColor" in value
          ? { fillColor: value.fillColor as string }
          : {}),
        ...rotateAttr(value),
      };
    case "table": {
      const y = value.y as number;
      const columns = (value.columns as Record<string, unknown>[]).map(
        (col) => ({
          key: col.key as string,
          label: col.label as string,
          width: col.width as number,
          align: (col.align as IrAlign | undefined) ?? "left",
          ...("mergeSameValue" in col
            ? { mergeSameValue: col.mergeSameValue as boolean }
            : {}),
        }),
      );
      const cellOverrides =
        "cellOverrides" in value
          ? (value.cellOverrides as Record<string, unknown>[]).map((o) => ({
              row: o.row as number,
              key: o.key as string,
              value: o.value as string,
            }))
          : undefined;
      const cellSpans =
        "cellSpans" in value
          ? (value.cellSpans as Record<string, unknown>[]).map((s) => ({
              row: s.row as number | "header",
              key: s.key as string,
              ...("rowSpan" in s ? { rowSpan: s.rowSpan as number } : {}),
              ...("colSpan" in s ? { colSpan: s.colSpan as number } : {}),
            }))
          : undefined;
      return {
        type,
        id: value.id as string,
        ...nameAttr(value),
        x: value.x as number,
        y,
        bind: value.bind as string,
        columns,
        rowHeight: value.rowHeight as number,
        headerHeight: value.headerHeight as number,
        fontSize: (value.fontSize as number | undefined) ?? 10,
        maxY: (value.maxY as number | undefined) ?? page.height,
        continuationY: (value.continuationY as number | undefined) ?? y,
        minRows: (value.minRows as number | undefined) ?? 0,
        ...("frameWidth" in value
          ? { frameWidth: value.frameWidth as number }
          : {}),
        ...("gridWidth" in value
          ? { gridWidth: value.gridWidth as number }
          : {}),
        ...("frameStyle" in value
          ? { frameStyle: value.frameStyle as IrStrokeStyle }
          : {}),
        ...("gridStyle" in value
          ? { gridStyle: value.gridStyle as IrStrokeStyle }
          : {}),
        ...(cellOverrides !== undefined ? { cellOverrides } : {}),
        ...(cellSpans !== undefined ? { cellSpans } : {}),
        ...("stripeColor" in value
          ? { stripeColor: value.stripeColor as string }
          : {}),
        ...styleAttr(value),
      };
    }
    case "image":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        src: value.src as string,
        ...rotateAttr(value),
      };
    case "flex": {
      const direction = value.direction as IrFlexDirection;
      const children = (value.children as Record<string, unknown>[]).map(
        (child) => normalizeElement(child, page, true),
      );
      const mainAxis: Record<string, unknown> =
        direction === "row" && "w" in value
          ? { w: value.w as number }
          : direction === "column" && "h" in value
            ? { h: value.h as number }
            : {};
      return {
        ...common,
        direction,
        ...mainAxis,
        gap: (value.gap as number | undefined) ?? 0,
        justifyContent:
          (value.justifyContent as IrFlexAlign | undefined) ?? "start",
        alignItems: (value.alignItems as IrFlexAlign | undefined) ?? "start",
        children,
      };
    }
    case "pageNumber":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        format:
          (value.format as string | undefined) ?? PAGE_NUMBER_DEFAULT_FORMAT,
        fontSize: (value.fontSize as number | undefined) ?? 10,
        align: (value.align as IrAlign | undefined) ?? "left",
        lineHeight: (value.lineHeight as number | undefined) ?? 1.25,
        ...("color" in value ? { color: value.color as string } : {}),
        ...styleAttr(value),
        ...rotateAttr(value),
      };
    case "barcode":
      return {
        ...common,
        w: value.w as number,
        h: value.h as number,
        symbology: value.symbology as IrBarcodeSymbology,
        value: value.value as string,
        ...rotateAttr(value),
      };
  }
}

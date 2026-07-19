import { DATA_URI_PATTERN, PAGE_NUMBER_DEFAULT_FORMAT } from "./constants";
import type { IrError, IrRuleId } from "./errors";
import type {
  IrAlign,
  IrBarcodeSymbology,
  IrDocType,
  IrDocument,
  IrElement,
  IrFlexAlign,
  IrFlexDirection,
  IrFootnotes,
  IrGroup,
  IrNamedStyle,
  IrOrientation,
  IrPage,
  IrPages,
  IrStrokeStyle,
  IrStyleAttrs,
} from "./types";
import { IR_VERSION } from "./types";

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
 */
export function parseIr(json: string): ParseIrResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {
      ok: false,
      errors: [err("S01", "$", "入力を JSON として解析できません")],
    };
  }

  const errors = collectSyntaxErrors(raw);
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

function collectSyntaxErrors(raw: unknown): IrError[] {
  if (!isPlainObject(raw)) {
    return [err("S02", "$", "ルートは JSON オブジェクトである必要があります")];
  }
  const errors: IrError[] = [];
  errors.push(...checkRootKeys(raw));
  if ("version" in raw) errors.push(...checkVersion(raw.version));
  if ("page" in raw) errors.push(...checkPage(raw.page));
  if ("font" in raw) errors.push(...checkFont(raw.font));
  if ("styles" in raw) errors.push(...checkStyles(raw.styles));
  if ("elements" in raw) errors.push(...checkElementsArray(raw.elements));
  if ("docType" in raw) errors.push(...checkDocType(raw.docType));
  if ("footnotes" in raw) errors.push(...checkFootnotes(raw.footnotes));
  if ("groups" in raw) errors.push(...checkGroups(raw.groups));
  return errors;
}

function checkRootKeys(raw: Record<string, unknown>): IrError[] {
  const errors: IrError[] = [];
  for (const key of ROOT_REQUIRED_KEYS) {
    if (!(key in raw))
      errors.push(err("S02", key, `必須キー "${key}" がありません`));
  }
  const allowed: readonly string[] = ROOT_KEYS;
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) {
      errors.push(err("S02", key, `未知のキー "${key}" です`));
    }
  }
  return errors;
}

function checkStyles(value: unknown): IrError[] {
  if (!Array.isArray(value)) {
    return [err("S14", "styles", "styles は配列である必要があります")];
  }
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `styles[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(
        err("S14", path, "styles の要素はオブジェクトである必要があります"),
      );
      return;
    }
    for (const key of Object.keys(item)) {
      if (key !== "name" && key !== "attrs") {
        errors.push(err("S14", `${path}.${key}`, `未知のキー "${key}" です`));
      }
    }
    if (!isString(item.name)) {
      errors.push(
        err("S14", `${path}.name`, "name は string である必要があります"),
      );
    }
    const attrs = item.attrs;
    if (!isPlainObject(attrs)) {
      errors.push(
        err("S14", `${path}.attrs`, "attrs はオブジェクトである必要があります"),
      );
      return;
    }
    for (const key of Object.keys(attrs)) {
      const attrPath = `${path}.attrs.${key}`;
      if (!(STYLE_ATTR_KEYS as readonly string[]).includes(key)) {
        errors.push(err("S14", attrPath, `未知の属性 "${key}" です`));
        continue;
      }
      const v = attrs[key];
      if (key === "align") {
        if (!isString(v) || !(ENUM_DOMAINS.align ?? []).includes(v)) {
          errors.push(err("S14", attrPath, `align の値が不正です: "${v}"`));
        }
      } else if (!isNumber(v)) {
        errors.push(
          err("S14", attrPath, `${key} は number である必要があります`),
        );
      }
    }
  });
  return errors;
}

function checkDocType(value: unknown): IrError[] {
  if (isString(value) && value === "qualifiedInvoice") return [];
  return [
    err("S10", "docType", `docType の値が不正です: ${JSON.stringify(value)}`),
  ];
}

const VERSION_PATTERN = /^1\.(0|[1-9][0-9]*)$/;
const VERSION_SHAPE_PATTERN = /^(\d+)\.(\d+)$/;

function checkVersion(value: unknown): IrError[] {
  if (!isString(value)) {
    return [err("S03", "version", "version は string である必要があります")];
  }
  if (VERSION_PATTERN.test(value)) {
    const minor = Number(value.slice("1.".length));
    const supportedMinor = Number(IR_VERSION.split(".")[1]);
    if (minor > supportedMinor) {
      return [
        err(
          "S03",
          "version",
          `未対応の minor バージョンです: "${value}"（対応: ${IR_VERSION} 以下）`,
        ),
      ];
    }
    return [];
  }
  const shape = VERSION_SHAPE_PATTERN.exec(value);
  if (shape?.[1] !== undefined && shape[1] !== "1") {
    return [
      err(
        "S03",
        "version",
        `未対応の major バージョンです: "${value}"（対応: 1.x）`,
      ),
    ];
  }
  return [err("S03", "version", `version の形式が不正です: "${value}"`)];
}

function checkPage(value: unknown): IrError[] {
  if (!isPlainObject(value))
    return [err("S04", "page", "page はオブジェクトである必要があります")];
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "width" && key !== "height")
      errors.push(err("S04", `page.${key}`, `未知のキー "${key}" です`));
  }
  if (!isNumber(value.width))
    errors.push(
      err("S04", "page.width", "width は number である必要があります"),
    );
  if (!isNumber(value.height))
    errors.push(
      err("S04", "page.height", "height は number である必要があります"),
    );
  return errors;
}

function checkFont(value: unknown): IrError[] {
  if (!isPlainObject(value))
    return [err("S05", "font", "font はオブジェクトである必要があります")];
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "name")
      errors.push(err("S05", `font.${key}`, `未知のキー "${key}" です`));
  }
  if (!isString(value.name))
    errors.push(err("S05", "font.name", "name は string である必要があります"));
  return errors;
}

function checkElementsArray(value: unknown): IrError[] {
  if (!Array.isArray(value))
    return [err("S06", "elements", "elements は配列である必要があります")];
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `elements[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(err("S06", path, "要素はオブジェクトである必要があります"));
      return;
    }
    errors.push(...checkElement(item, path, false));
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

function checkFootnotes(value: unknown): IrError[] {
  if (!isPlainObject(value)) {
    return [
      err("F01", "footnotes", "footnotes はオブジェクトである必要があります"),
    ];
  }
  const errors: IrError[] = [];
  for (const key of FOOTNOTES_ALLOWED_KEYS) {
    if (!(key in value))
      errors.push(
        err("F01", `footnotes.${key}`, `必須キー "${key}" がありません`),
      );
  }
  for (const key of Object.keys(value)) {
    if (!(FOOTNOTES_ALLOWED_KEYS as readonly string[]).includes(key)) {
      errors.push(err("F01", `footnotes.${key}`, `未知のキー "${key}" です`));
    }
  }
  checkRequiredType(errors, value, "x", "footnotes", "F01", "number");
  checkRequiredType(errors, value, "w", "footnotes", "F01", "number");
  checkRequiredType(errors, value, "bottom", "footnotes", "F01", "number");
  checkRequiredType(errors, value, "fontSize", "footnotes", "F01", "number");
  checkRequiredType(errors, value, "lineHeight", "footnotes", "F01", "number");
  checkRequiredType(errors, value, "pages", "footnotes", "F01", "string");
  if (
    isString(value.pages) &&
    ENUM_DOMAINS.pages?.includes(value.pages) === false
  ) {
    errors.push(
      err("S10", "footnotes.pages", `pages の値が不正です: "${value.pages}"`),
    );
  }
  if (!("notes" in value)) {
    return errors;
  }
  const notes = value.notes;
  if (!Array.isArray(notes)) {
    errors.push(
      err("F01", "footnotes.notes", "notes は配列である必要があります"),
    );
    return errors;
  }
  notes.forEach((note, i) => {
    const notePath = `footnotes.notes[${i}]`;
    if (!isPlainObject(note)) {
      errors.push(
        err("F01", notePath, "note はオブジェクトである必要があります"),
      );
      return;
    }
    checkRequiredType(errors, note, "id", notePath, "F01", "string");
    checkRequiredType(errors, note, "text", notePath, "F01", "string");
    for (const key of Object.keys(note)) {
      if (!(FOOTNOTE_NOTE_ALLOWED_KEYS as readonly string[]).includes(key)) {
        errors.push(
          err("F01", `${notePath}.${key}`, `未知のキー "${key}" です`),
        );
      }
    }
  });
  return errors;
}

const GROUP_ALLOWED_KEYS = ["id", "memberIds"] as const;

function checkGroups(value: unknown): IrError[] {
  if (!Array.isArray(value)) {
    return [err("S15", "groups", "groups は配列である必要があります")];
  }
  const errors: IrError[] = [];
  value.forEach((item, i) => {
    const path = `groups[${i}]`;
    if (!isPlainObject(item)) {
      errors.push(
        err("S15", path, "groups の要素はオブジェクトである必要があります"),
      );
      return;
    }
    for (const key of Object.keys(item)) {
      if (!(GROUP_ALLOWED_KEYS as readonly string[]).includes(key)) {
        errors.push(err("S15", `${path}.${key}`, `未知のキー "${key}" です`));
      }
    }
    checkRequiredType(errors, item, "id", path, "S15", "string");
    const memberIds = item.memberIds;
    if (!Array.isArray(memberIds) || !memberIds.every(isString)) {
      errors.push(
        err(
          "S15",
          `${path}.memberIds`,
          "memberIds は string の配列である必要があります",
        ),
      );
    }
  });
  return errors;
}

function checkElement(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const type = value.type;
  if (!isString(type) || !(ELEMENT_TYPES as readonly string[]).includes(type)) {
    return [
      err(
        "S07",
        `${path}.type`,
        `type は要素型のいずれかである必要があります: ${String(type)}`,
      ),
    ];
  }
  if (isFlexChild && type === "table") {
    return [err("S13", path, "flex の子には table を含められません")];
  }
  const elementType = type as ElementType;

  const errors: IrError[] = [];
  const allowed = computeAllowedKeys(value, elementType, isFlexChild);
  errors.push(...checkRequiredAndTypes(value, elementType, path, isFlexChild));
  errors.push(...checkUnknownAttributes(value, elementType, path, allowed));
  errors.push(...checkEnumValues(value, path, allowed));
  if (elementType === "image") errors.push(...checkImageSrc(value, path));
  if (elementType === "flex") errors.push(...checkFlexChildren(value, path));
  return errors;
}

function checkRequiredType(
  errors: IrError[],
  value: Record<string, unknown>,
  key: string,
  path: string,
  rule: IrRuleId,
  kind: "string" | "number",
): void {
  const v = value[key];
  const ok = kind === "string" ? isString(v) : isNumber(v);
  if (!ok)
    errors.push(
      err(
        rule,
        `${path}.${key}`,
        `${key} は ${kind} である必要があります（必須）`,
      ),
    );
}

function checkOptionalType(
  errors: IrError[],
  value: Record<string, unknown>,
  key: string,
  path: string,
  rule: IrRuleId,
  kind: "string" | "number",
): void {
  if (!(key in value)) return;
  const v = value[key];
  const ok = kind === "string" ? isString(v) : isNumber(v);
  if (!ok)
    errors.push(
      err(rule, `${path}.${key}`, `${key} は ${kind} である必要があります`),
    );
}

function checkCommonRequired(
  value: Record<string, unknown>,
  path: string,
  rule: IrRuleId,
  isFlexChild: boolean,
): IrError[] {
  const errors: IrError[] = [];
  checkRequiredType(errors, value, "id", path, rule, "string");
  checkOptionalType(errors, value, "name", path, rule, "string");
  if (!isFlexChild) {
    checkRequiredType(errors, value, "x", path, rule, "number");
    checkRequiredType(errors, value, "y", path, rule, "number");
    checkOptionalType(errors, value, "pages", path, rule, "string");
  }
  return errors;
}

function checkRequiredAndTypes(
  value: Record<string, unknown>,
  type: ElementType,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  switch (type) {
    case "text":
      return checkS08Text(value, path, isFlexChild);
    case "line":
      return checkS08Line(value, path, isFlexChild);
    case "rect":
      return checkS08Rect(value, path, isFlexChild);
    case "ellipse":
      return checkS08Ellipse(value, path, isFlexChild);
    case "table":
      return checkS08Table(value, path);
    case "image":
      return checkS08Image(value, path, isFlexChild);
    case "flex":
      return checkS08Flex(value, path, isFlexChild);
    case "pageNumber":
      return checkS08PageNumber(value, path, isFlexChild);
    case "barcode":
      return checkS08Barcode(value, path, isFlexChild);
  }
}

function checkS08Text(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08t", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08t", "number");
  checkRequiredType(errors, value, "h", path, "S08t", "number");
  checkRequiredType(errors, value, "text", path, "S08t", "string");
  checkOptionalType(errors, value, "fontSize", path, "S08t", "number");
  checkOptionalType(errors, value, "align", path, "S08t", "string");
  checkOptionalType(errors, value, "lineHeight", path, "S08t", "number");
  checkOptionalType(errors, value, "color", path, "S08t", "string");
  checkOptionalType(errors, value, "style", path, "S08t", "string");
  checkOptionalType(errors, value, "rotate", path, "S08t", "number");
  return errors;
}

function checkS08Line(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08l", isFlexChild);
  checkRequiredType(errors, value, "orientation", path, "S08l", "string");
  checkRequiredType(errors, value, "length", path, "S08l", "number");
  checkOptionalType(errors, value, "thickness", path, "S08l", "number");
  checkOptionalType(errors, value, "color", path, "S08l", "string");
  checkOptionalType(errors, value, "strokeStyle", path, "S08l", "string");
  checkOptionalType(errors, value, "style", path, "S08l", "string");
  checkOptionalType(errors, value, "rotate", path, "S08l", "number");
  return errors;
}

function checkS08Rect(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08r", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08r", "number");
  checkRequiredType(errors, value, "h", path, "S08r", "number");
  checkOptionalType(errors, value, "borderWidth", path, "S08r", "number");
  checkOptionalType(errors, value, "style", path, "S08r", "string");
  checkOptionalType(errors, value, "borderColor", path, "S08r", "string");
  checkOptionalType(errors, value, "fillColor", path, "S08r", "string");
  checkOptionalType(errors, value, "borderStyle", path, "S08r", "string");
  checkOptionalType(errors, value, "cornerRadius", path, "S08r", "number");
  checkOptionalType(errors, value, "rotate", path, "S08r", "number");
  return errors;
}

function checkS08Ellipse(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08e", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08e", "number");
  checkRequiredType(errors, value, "h", path, "S08e", "number");
  checkRequiredType(errors, value, "borderWidth", path, "S08e", "number");
  checkOptionalType(errors, value, "borderColor", path, "S08e", "string");
  checkOptionalType(errors, value, "fillColor", path, "S08e", "string");
  checkOptionalType(errors, value, "rotate", path, "S08e", "number");
  return errors;
}

function checkS08Table(
  value: Record<string, unknown>,
  path: string,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08b", false);
  checkRequiredType(errors, value, "bind", path, "S08b", "string");
  checkRequiredType(errors, value, "rowHeight", path, "S08b", "number");
  checkRequiredType(errors, value, "headerHeight", path, "S08b", "number");
  checkOptionalType(errors, value, "fontSize", path, "S08b", "number");
  checkOptionalType(errors, value, "maxY", path, "S08b", "number");
  checkOptionalType(errors, value, "continuationY", path, "S08b", "number");
  checkOptionalType(errors, value, "minRows", path, "S08b", "number");
  checkOptionalType(errors, value, "frameWidth", path, "S08b", "number");
  checkOptionalType(errors, value, "gridWidth", path, "S08b", "number");
  checkOptionalType(errors, value, "frameStyle", path, "S08b", "string");
  checkOptionalType(errors, value, "gridStyle", path, "S08b", "string");
  checkOptionalType(errors, value, "stripeColor", path, "S08b", "string");
  checkOptionalType(errors, value, "style", path, "S08b", "string");

  const columns = value.columns;
  if (!Array.isArray(columns)) {
    errors.push(
      err("S08b", `${path}.columns`, "columns は配列である必要があります"),
    );
    return errors;
  }
  columns.forEach((col, i) => {
    const colPath = `${path}.columns[${i}]`;
    if (!isPlainObject(col)) {
      errors.push(
        err("S08b", colPath, "column はオブジェクトである必要があります"),
      );
      return;
    }
    checkRequiredType(errors, col, "key", colPath, "S08b", "string");
    checkRequiredType(errors, col, "label", colPath, "S08b", "string");
    checkRequiredType(errors, col, "width", colPath, "S08b", "number");
    checkOptionalType(errors, col, "align", colPath, "S08b", "string");
  });

  if ("cellOverrides" in value) {
    const cellOverrides = value.cellOverrides;
    if (!Array.isArray(cellOverrides)) {
      errors.push(
        err(
          "S08b",
          `${path}.cellOverrides`,
          "cellOverrides は配列である必要があります",
        ),
      );
    } else {
      cellOverrides.forEach((entry, j) => {
        const entryPath = `${path}.cellOverrides[${j}]`;
        if (!isPlainObject(entry)) {
          errors.push(
            err(
              "S08b",
              entryPath,
              "cellOverrides の要素はオブジェクトである必要があります",
            ),
          );
          return;
        }
        checkRequiredType(errors, entry, "row", entryPath, "S08b", "number");
        checkRequiredType(errors, entry, "key", entryPath, "S08b", "string");
        checkRequiredType(errors, entry, "value", entryPath, "S08b", "string");
      });
    }
  }
  return errors;
}

function checkS08Image(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08i", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08i", "number");
  checkRequiredType(errors, value, "h", path, "S08i", "number");
  checkRequiredType(errors, value, "src", path, "S08i", "string");
  checkOptionalType(errors, value, "rotate", path, "S08i", "number");
  return errors;
}

function checkS08Flex(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08f", isFlexChild);
  checkRequiredType(errors, value, "direction", path, "S08f", "string");
  checkOptionalType(errors, value, "w", path, "S08f", "number");
  checkOptionalType(errors, value, "h", path, "S08f", "number");
  checkOptionalType(errors, value, "gap", path, "S08f", "number");
  checkOptionalType(errors, value, "justifyContent", path, "S08f", "string");
  checkOptionalType(errors, value, "alignItems", path, "S08f", "string");
  if (!Array.isArray(value.children)) {
    errors.push(
      err("S08f", `${path}.children`, "children は配列である必要があります"),
    );
  }
  return errors;
}

function checkS08PageNumber(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08p", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08p", "number");
  checkRequiredType(errors, value, "h", path, "S08p", "number");
  checkOptionalType(errors, value, "format", path, "S08p", "string");
  checkOptionalType(errors, value, "fontSize", path, "S08p", "number");
  checkOptionalType(errors, value, "align", path, "S08p", "string");
  checkOptionalType(errors, value, "lineHeight", path, "S08p", "number");
  checkOptionalType(errors, value, "color", path, "S08p", "string");
  checkOptionalType(errors, value, "style", path, "S08p", "string");
  checkOptionalType(errors, value, "rotate", path, "S08p", "number");
  return errors;
}

function checkS08Barcode(
  value: Record<string, unknown>,
  path: string,
  isFlexChild: boolean,
): IrError[] {
  const errors = checkCommonRequired(value, path, "S08c", isFlexChild);
  checkRequiredType(errors, value, "w", path, "S08c", "number");
  checkRequiredType(errors, value, "h", path, "S08c", "number");
  checkRequiredType(errors, value, "symbology", path, "S08c", "string");
  checkRequiredType(errors, value, "value", path, "S08c", "string");
  checkOptionalType(errors, value, "rotate", path, "S08c", "number");
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
const COLUMN_ALLOWED_KEYS = ["key", "label", "width", "align"];
const CELL_OVERRIDE_ALLOWED_KEYS = ["row", "key", "value"];

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
): IrError[] {
  const errors: IrError[] = [];
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    if (type === "text" && key === "bind") {
      errors.push(
        err(
          "S09",
          `${path}.${key}`,
          `未知の属性 "${key}" です（text の全体差し込みは廃止されました。text: "{キー名}" を使用してください）`,
        ),
      );
      continue;
    }
    errors.push(err("S09", `${path}.${key}`, `未知の属性 "${key}" です`));
  }
  if (type === "table" && Array.isArray(value.columns)) {
    value.columns.forEach((col, i) => {
      if (!isPlainObject(col)) return;
      for (const key of Object.keys(col)) {
        if (!COLUMN_ALLOWED_KEYS.includes(key)) {
          errors.push(
            err(
              "S09",
              `${path}.columns[${i}].${key}`,
              `未知の属性 "${key}" です`,
            ),
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
              `未知の属性 "${key}" です`,
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
): IrError[] {
  const errors: IrError[] = [];
  for (const [key, domain] of Object.entries(ENUM_DOMAINS)) {
    if (!allowed.includes(key)) continue; // その要素型では未知の属性（S09 の対象）は S10 で二重報告しない
    if (!(key in value)) continue;
    const v = value[key];
    if (isString(v) && !domain.includes(v)) {
      errors.push(
        err("S10", `${path}.${key}`, `${key} の値が不正です: "${v}"`),
      );
    }
  }
  return errors;
}

function checkImageSrc(
  value: Record<string, unknown>,
  path: string,
): IrError[] {
  const src = value.src;
  if (!isString(src) || !DATA_URI_PATTERN.test(src)) {
    return [
      err("S12", `${path}.src`, "src は data URI 形式である必要があります"),
    ];
  }
  return [];
}

function checkFlexChildren(
  value: Record<string, unknown>,
  path: string,
): IrError[] {
  const children = value.children;
  if (!Array.isArray(children)) return [];
  const errors: IrError[] = [];
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (!isPlainObject(child)) {
      errors.push(
        err("S13", childPath, "子要素はオブジェクトである必要があります"),
      );
      return;
    }
    errors.push(...checkElement(child, childPath, true));
  });
  return errors;
}

// この関数は collectSyntaxErrors がエラーゼロを返した後にのみ呼ばれる前提で、
// 各属性の型を再検証せず信頼して正規化する。
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
    font: { name: fontRaw.name as string },
    ...(styles !== undefined ? { styles } : {}),
    elements: elements as unknown as readonly IrElement[],
    ...("docType" in raw ? { docType: raw.docType as IrDocType } : {}),
    ...(footnotesRaw !== undefined
      ? { footnotes: normalizeFootnotes(footnotesRaw) }
      : {}),
    ...(groupsRaw !== undefined ? { groups: normalizeGroups(groupsRaw) } : {}),
  };
}

// groups の全属性は必須のため、S15 通過後はデフォルト補完なしでそのまま写す
function normalizeGroups(raw: Record<string, unknown>[]): IrGroup[] {
  return raw.map((item) => ({
    id: item.id as string,
    memberIds: item.memberIds as string[],
  }));
}

// footnotes の全属性は必須のため、S/F01 通過後はデフォルト補完なしでそのまま写す
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

/** style は任意属性のため、指定時のみキーを持つオブジェクトを返す（`{}` へスプレッドする） */
function styleAttr(value: Record<string, unknown>): { style?: string } {
  return value.style !== undefined ? { style: value.style as string } : {};
}

/** name は任意属性のため、指定時のみキーを持つオブジェクトを返す（`{}` へスプレッドする） */
function nameAttr(value: Record<string, unknown>): { name?: string } {
  return value.name !== undefined ? { name: value.name as string } : {};
}

/** rotate は任意属性のため、指定時のみキーを持つオブジェクトを返す（0 埋めしない） */
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

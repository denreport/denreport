import type { Messages } from "./index.js";

/**
 * English mirror of `ja.ts`. Typed against `Messages` so a missing or extra
 * key fails the build.
 */
export const en: Messages = {
  parse: {
    invalidJson: "Could not parse the input as JSON",
    rootNotObject: "The root must be a JSON object",
    missingRequiredKey: (key) => `Missing required key "${key}"`,
    unknownKey: (key) => `Unknown key "${key}"`,
    unknownAttribute: (key) => `Unknown attribute "${key}"`,
    notAnObject: (field) => `${field} must be an object`,
    typeMustBe: (field, kind) => `${field} must be a ${kind}`,
    typeMustBeRequired: (field, kind) =>
      `${field} must be a ${kind} (required)`,
    mustBeArray: (field) => `${field} must be an array`,
    invalidValue: (field, value) => `${field} has an invalid value: "${value}"`,
    docTypeInvalid: (valueDisplay) =>
      `docType has an invalid value: ${valueDisplay}`,
    unsupportedMinorVersion: (value, supported) =>
      `Unsupported minor version: "${value}" (supported: ${supported} or below)`,
    unsupportedMajorVersion: (value) =>
      `Unsupported major version: "${value}" (supported: 1.x)`,
    invalidVersionFormat: (value) => `Malformed version: "${value}"`,
    elementNotObject: "An element must be an object",
    invalidElementType: (typeDisplay) =>
      `type must be one of the element types: ${typeDisplay}`,
    flexChildCannotBeTable: "A flex child cannot be a table",
    stylesItemNotObject: "A styles entry must be an object",
    columnNotObject: "A column must be an object",
    cellOverrideNotObject: "A cellOverrides entry must be an object",
    cellSpanNotObject: "A cellSpans entry must be an object",
    cellSpanRowInvalid: 'row must be a number or "header"',
    groupNotObject: "A groups entry must be an object",
    memberIdsInvalid: "memberIds must be an array of strings",
    noteNotObject: "A note must be an object",
    bindAttributeRemoved: (key) =>
      `Unknown attribute "${key}" (whole-text binding on text has been removed; use text: "{key}" instead)`,
    imageSrcInvalid: "src must be a data URI",
    flexChildNotObject: "A child element must be an object",
  },
  validate: {
    idNotIdentifier: (id) => `id "${id}" does not match the identifier pattern`,
    idDuplicate: (id) => `id "${id}" is duplicated in the document`,
    xNegative: "x is below 0",
    yNegative: "y is below 0",
    tableWidthExceedsPage:
      "The table's width extends past the page's right edge",
    elementExceedsPageRight: "The element extends past the page's right edge",
    elementExceedsPageBottom: "The element extends past the page's bottom edge",
    mustBePositive: (field) => `${field} must be greater than 0`,
    mustBeNonNegative: (field) => `${field} must be 0 or greater`,
    mustBeInRange: (field, max) =>
      `${field} must be greater than 0 and at most ${max}`,
    pageDimensionRange: (field, min, max) =>
      `${field} must be at least ${min} and at most ${max}`,
    columnsRequired: "columns must have at least one entry",
    columnKeyDuplicate: (key) => `key "${key}" is duplicated within the table`,
    fontNameNotIdentifier: (slot, name) =>
      `font.${slot} "${name}" does not match the identifier pattern`,
    bindNotIdentifier: (bind) =>
      `bind "${bind}" does not match the identifier pattern`,
    columnKeyNotIdentifier: (key) =>
      `key "${key}" does not match the identifier pattern`,
    unsupportedMediatype: (mediatype) =>
      `Unsupported mediatype: "${mediatype}"`,
    base64DecodeFailed: "Could not decode the base64 payload",
    maxYExceedsPageHeight: "maxY exceeds the page's height",
    firstPageNoRowCapacity: "The first page has no room for even one row",
    continuationPageNoRowCapacity:
      "A continuation page has no room for even one row",
    minRowsInvalid: "minRows must be a non-negative integer",
    flexChildrenRequired: "children must have at least one entry",
    mainAxisTooSmall:
      "The main-axis dimension is smaller than the content size",
    rowMustBeNonNegativeInteger: "row must be a non-negative integer",
    keyNotInColumns: (key) => `key "${key}" is not one of the table's columns`,
    rowKeyDuplicate: "The (row, key) pair is duplicated within the table",
    styleNameLengthInvalid: (max) => `name must be 1 to ${max} characters`,
    styleNameDuplicate: (name) =>
      `name "${name}" is duplicated in the document`,
    styleAttrsRequired: "attrs must have at least one field",
    styleNotFound: (style) => `No style named "${style}" was found`,
    colorFormatInvalid: (field, value) =>
      `${field} must be in #rrggbb format: "${value}"`,
    cornerRadiusRange: (maxRadius) =>
      `cornerRadius must be between 0 and ${maxRadius}`,
    cornerRadiusRequiresSolidBorder:
      "borderStyle must be solid (or omitted) when cornerRadius is set",
    nameLengthInvalid: (max) => `name must be at most ${max} characters`,
    rotateInvalid: (max) =>
      `rotate must be a finite number between -${max} and ${max}`,
    cellSpanRowNotNonNegativeIntegerOrHeader:
      'row must be a non-negative integer or "header"',
    mustBePositiveInteger: (field) =>
      `${field} must be an integer of 1 or greater`,
    spanMustHaveOneGreaterThanOne:
      "At least one of rowSpan or colSpan must be 2 or greater",
    headerRowSpanMustBeOne: 'rowSpan must be 1 for the "header" row',
    spanExceedsColumnRange: "The span extends past the column range",
    spanOverlapsMergedColumn: (key) =>
      `The span overlaps column "${key}", which has mergeSameValue`,
    spanOverlapsOtherSpan: (index) => `The span overlaps cellSpans[${index}]`,
    noteIdDuplicate: (id) => `id "${id}" is duplicated within footnotes`,
    footnoteRefNotDefined: (id) => `The referenced note "${id}" is not defined`,
    markNotAllowedInFlexText:
      "A footnote mark cannot appear in a text inside a flex",
    markNotAllowedInPageNumberFormat:
      "A footnote mark cannot appear in a pageNumber's format",
    markNotAllowedInColumnLabel:
      "A footnote mark cannot appear in a table's column label",
    markNotAllowedInCellOverride:
      "A footnote mark cannot appear in a table's cell override value",
    markNotAllowedInNoteText:
      "A footnote mark cannot appear in a note's own text",
    noteNotReferenced: (id) => `note "${id}" is not referenced by any mark`,
    footnotesExceedPageRight:
      "The footnote block extends past the page's right edge",
    footnotesExceedPageTop:
      "The footnote block extends past the page's top edge",
  },
  data: {
    keyMissing: (key) => `Data has no key "${key}"`,
    valueNotString: (key) => `The value for key "${key}" is not a string`,
    bindNotArray: (key) => `The value for key "${key}" is not an array`,
    rowNotObject: (row) => `Row ${row} is not an object`,
    rowValueNotString: (row, key) =>
      `The value for key "${key}" in row ${row} is not a string`,
  },
  lower: {
    multiplePagingTables: "More than one table expands across 2 or more pages",
    pageCountExceeded: (pageCount, max) =>
      `The expanded page count ${pageCount} exceeds the limit of ${max}`,
  },
  invoice: {
    itemLabels: {
      registrationNumber: "Issuer's registration number",
      transactionDate: "Transaction date",
      description: "Transaction description",
      taxableAmount: "Taxable amount by tax rate and applicable tax rate",
      taxAmount: "Consumption tax amount by tax rate",
      customerName: "Name of the recipient business",
    },
    missingField: (label, keys, tokens) =>
      `No data-bound field for the qualified invoice item "${label}" (place the ${tokens} token or a table column key for one of: ${keys})`,
  },
  rules: {
    S01: "The input parses as JSON",
    S02: "The root is an object whose 4 required keys are version/page/font/elements, with docType/footnotes/groups as optional keys (unknown keys rejected)",
    S03: "version is a spec version string at or below the implementation's supported minor version",
    S04: "page is { width, height } (number, unknown keys rejected)",
    S05: "font is { name } (string, unknown keys rejected)",
    S06: "elements is an array whose entries are all objects",
    S07: "Every element's type is one of the 9 element types",
    S08t: "text has every required attribute, all with the correct type",
    S08l: "line has every required attribute, all with the correct type",
    S08r: "rect has every required attribute, all with the correct type",
    S08e: "ellipse has every required attribute, all with the correct type",
    S08b: "table has every required attribute, all with the correct type",
    S08i: "image has every required attribute, all with the correct type",
    S08f: "flex has every required attribute, all with the correct type",
    S08p: "pageNumber has every required attribute, all with the correct type",
    S08c: "barcode has every required attribute, all with the correct type",
    S09: "No element or column has an unknown attribute",
    S10: "Every enum value is within its domain",
    S12: "An image's src matches the data URI syntax",
    S13: "flex's children is an array whose entries are all elements other than table",
    S14: "styles is an array whose entries are name (string) and attrs (an object with only defined keys, all correctly typed)",
    S15: "groups is an array whose entries are id (string) and memberIds (an array of strings), with unknown keys rejected",
    M01: "id matches the identifier pattern and is unique across the document, including flex descendants",
    M02: "Every element fits within the page",
    M03: "Dimensions are positive (gap, and rect/ellipse's borderWidth, may be 0)",
    M04: "fontSize and lineHeight are within the allowed range",
    M05: "page's width and height are within the allowed range",
    M06: "table's columns has at least one entry, with key unique within the table",
    M07: "table's bind and columns[].key match the identifier pattern",
    M08: "An image's src has a supported mediatype and a decodable base64 payload",
    M09: "A table's page area is feasible",
    M10: "minRows is a non-negative integer",
    M11: "flex's children has at least one entry",
    M12: "flex's main-axis dimension (when explicit) is at least the content size",
    M13: "cellOverrides' row is a non-negative integer, key is one of columns[].key, and (row, key) is unique within the table",
    M14: "Every styles entry's name is non-empty, at most 64 characters, and unique in the document, and attrs has at least one field, each within the allowed range",
    M15: "An element's style (including flex descendants) refers to a name present in styles",
    M16: "Color attributes (line.color; rect/ellipse's borderColor, fillColor; table.stripeColor) are in #rrggbb format",
    M17: "rect's cornerRadius is between 0 and min(w, h) / 2, and when greater than 0, borderStyle is solid (or omitted)",
    M18: "An element's name (including flex descendants), when set, is at most 64 characters",
    M19: "An element's rotate (including flex descendants), when set, is a finite number between -360 and 360",
    M20: 'cellSpans\' row is a non-negative integer or "header", key is one of columns[].key, rowSpan and colSpan are integers of 1 or greater with at least one being 2 or greater, the span fits within the column range, rowSpan is 1 for the "header" row, spans do not overlap within the table, and spans do not touch a column with mergeSameValue true',
    C01: "Every {key} token's key in a text's text or a barcode's value exists in the data with a string value (a missing key is a warning; a non-string value is an error)",
    C02: "A table's bind key exists in the data as an array of objects where every row has a string value for every columns[].key (a missing key is a warning; an invalid value or shape is an error)",
    C03: "At most one table in the document expands across 2 or more pages at the same time",
    C04: "The expanded total page count is at or below the limit",
    Q01: "A document with docType qualifiedInvoice has a data-bound field (a text's {key} or a table column key) for every required qualified invoice item (a missing item is a warning)",
    F01: "footnotes is an object { x, w, bottom, fontSize, lineHeight, pages, notes } with correctly typed attributes and no unknown keys; notes is an array of { id, text } (string, unknown keys rejected)",
    F02: "notes[].id matches the identifier pattern and is unique within footnotes",
    F03: "A {#id} mark in a top-level text refers to one of notes[].id",
    F04: "A {#id} mark may only appear in a top-level text element's text; marks in a flex descendant's text, a table's columns[].label / cellOverrides[].value, a pageNumber's format, or notes[].text are errors",
    F05: "Every note is referenced by at least one mark",
    F06: "footnotes' x/w/bottom are 0 or greater, fontSize/lineHeight are within the same range as M04, and the footnote block fits within the page (x + w <= page.width and the computed y >= 0)",
  },
  compat: {
    pdfme: {
      textElement:
        "Text wrapping and alignment are the same regardless of the export target. Only the display when text doesn't fit the box height may differ slightly by target.",
      textUnderline:
        "The underline's position and thickness may differ slightly by target.",
      lineThickness:
        "The side of the baseline that a line's thickness extends toward may differ by target.",
      lineStrokeStyle:
        "Dashed and dotted lines are drawn as a series of short solid segments. The spacing and starting position may differ slightly by target.",
      rectBorderWidth:
        "The side of the baseline that a border's thickness extends toward may differ by target.",
      rectBorderStyle:
        "A dashed or dotted rectangle border is drawn as 4 separately segmented sides, so the pattern may not connect at the corners.",
      tableElement:
        "A table's row splitting across pages is resolved at export time, so it's output correctly. Cell text is handled the same as regular text; only the display when text doesn't fit the row height may differ slightly by target.",
      tableFrameWidth:
        "The side a thicker border line extends toward may differ slightly by target.",
      tableGridWidth:
        "The side a thicker grid line extends toward may differ slightly by target.",
      tableFrameStyle:
        "A dashed or dotted table border may not connect its pattern at the corners.",
      tableGridStyle:
        "A dashed or dotted table grid line's spacing may differ slightly by target.",
      pageNumberElement:
        "A page number is converted to a fixed string at export time, so it's output correctly. Its text is handled the same as regular text; only the display when it doesn't fit the box height may differ slightly by target.",
      barcodeElement:
        "A barcode is displayed to fit the specified width and height. Details like bar thickness and quiet zone may vary slightly by target. Whether the entered value conforms to the barcode's spec (e.g. check digit) is not verified.",
    },
    reportlab: {
      textElement:
        "Text wrapping and alignment are the same regardless of the export target. Only the display when text doesn't fit the box height may differ slightly by target.",
      textUnderline:
        "The underline's position and thickness may differ slightly by target.",
      lineThickness:
        "The side of the baseline that a line's thickness extends toward may differ by target.",
      rectBorderWidth:
        "The side of the baseline that a border's thickness extends toward may differ by target.",
      tableElement:
        "A table's row splitting across pages is resolved at export time, so it's output correctly. Cell text is handled the same as regular text; only the display when text doesn't fit the row height may differ slightly by target.",
      tableFrameWidth:
        "The side a thicker border line extends toward may differ slightly by target.",
      tableGridWidth:
        "The side a thicker grid line extends toward may differ slightly by target.",
      imageSrc:
        "Displaying images requires the Pillow library in the generated Python script's runtime environment. Displaying a PNG image additionally requires that Pillow support PNG.",
      pageNumberElement:
        "A page number is converted to a fixed string at export time, so it's output correctly. Its text is handled the same as regular text; only the display when it doesn't fit the box height may differ slightly by target.",
      barcodeElement:
        "A barcode is displayed to fit the specified width and height. Details like bar thickness and quiet zone may vary slightly by target. Whether the entered value conforms to the barcode's spec (e.g. check digit) is not verified. EAN-13 is an exception: entering 12 digits auto-fills the check digit.",
    },
  },
};

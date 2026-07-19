import type { Messages } from "./index";

export const en: Messages = {
  fontIssue: {
    rejection: {
      cff: "CFF (OTF) outline fonts cannot be used for export. Use a TrueType-outline TTF font instead.",
      collection:
        "Font collections (TTC/OTC) cannot be used for export. Use a single-font TTF font instead.",
      woff: "WOFF fonts cannot be used for export. Use an uncompressed TTF font instead.",
      woff2:
        "WOFF2 fonts cannot be used for export. Use an uncompressed TTF font instead.",
      unknown:
        "Could not determine the font format. Use a TrueType-outline TTF font instead.",
    },
    metricsUnreadable:
      "Could not read the font's metrics (head / hhea tables), so the text baseline position cannot be determined. Use a different TTF font.",
    widthUnreadable:
      "Could not read the font's character widths (cmap / hmtx tables), so text wrapping and justification cannot be computed. Use a different TTF font.",
  },
  reportlab: {
    header: {
      notice: "Generated file; not intended for manual editing.",
      requirement: "Requirements: Python 3, reportlab",
      requirementWithImage:
        "Requirements: Python 3, reportlab, Pillow (used to draw images)",
      fontNoticeLine1:
        "Fonts: place the font files exported alongside this script (each file in FONTS)",
      fontNoticeLine2:
        "in the same directory as this file. Exits with an error if not found.",
      usage: "Usage: python <this file> [output.pdf] (defaults to output.pdf)",
      templateUsageLine1:
        "Usage: python <this file> [output.pdf] (defaults to output.pdf; runs without data,",
      templateUsageLine2: "exits with an error if there are merge keys)",
      templateProgrammatic:
        'From code: from report import build; build("output.pdf", data)',
      templateDataDescription:
        "data is a dict of merge values: text {key} tokens map to strings, table bind keys map to lists of row dicts.",
    },
    fontFileMissing:
      "Font file not found: {font_path} (place it in the same directory as this file)",
    bindStrMissingKey: 'Data is missing key "{key}"',
    bindStrNotString: 'Value for key "{key}" is not a string',
    bindRowsNotArray: 'Value for key "{key}" is not an array',
    bindRowsRowNotObject: "Row {t} is not an object",
    bindRowsCellNotString: 'Row {t}, key "{column_key}": value is not a string',
    chunkSizesNoRoomInContinuation:
      "The table has no room for even one row on continuation pages",
    multipleMultiPageTables: "More than one table expands to 2 or more pages",
    pageCountExceeded:
      "Total page count {page_count} after expansion exceeds the limit {PAGE_COUNT_MAX}",
  },
};

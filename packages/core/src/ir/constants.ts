export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const IDENTIFIER_MAX_LENGTH = 64;
export const STYLE_NAME_MAX_LENGTH = 64;

export const PAGE_NUMBER_DEFAULT_FORMAT = "{n} / {N}";

export const FONT_SIZE_MAX = 200;
export const LINE_HEIGHT_MAX = 5;
export const PAGE_DIMENSION_MIN = 1;
export const PAGE_DIMENSION_MAX = 5000;
/** Maximum number of pages a lowered document may expand to (rule C04). */
export const PAGE_COUNT_MAX = 1000;

/** Conversion factor from PDF points to millimeters. */
export const PT_TO_MM = 25.4 / 72;

/** Horizontal padding, in mm, applied inside a table's header and body cells. */
export const TABLE_CELL_PADDING_X = 1.5;
/** Vertical offset, in mm, from a table header row's top edge to its text anchor. */
export const TABLE_HEADER_TEXT_OFFSET_Y = 1.8;
/** Vertical offset, in mm, from a table body row's top edge to its text anchor. */
export const TABLE_CELL_TEXT_OFFSET_Y = 2.0;
/** Stroke width, in mm, of a table's outer frame. */
export const TABLE_FRAME_WIDTH = 0.4;
/** Stroke width, in mm, of a table's row and column grid lines. */
export const TABLE_GRID_WIDTH = 0.25;

export const DATA_URI_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/;

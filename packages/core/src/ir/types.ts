/**
 * The IR schema version this package implements. Documents declare a
 * `version` field (e.g. `"1.0"`); parseIr accepts any version sharing the
 * same major and a minor at or below this value.
 */
export const IR_VERSION: "1.1" = "1.1";

/** Horizontal text alignment. */
export type IrAlign = "left" | "center" | "right" | "justify";
/** Orientation of a line element. */
export type IrOrientation = "horizontal" | "vertical";
/** Which pages of a multi-page document an element appears on. */
export type IrPages = "first" | "rest" | "last" | "all";
/** Main axis of a flex container. */
export type IrFlexDirection = "row" | "column";
/** Alignment along a flex container's main (`justifyContent`) or cross (`alignItems`) axis. */
export type IrFlexAlign = "start" | "center" | "end";
/** Special document type enabling additional validation (currently Japan's qualified invoice, rule Q01). */
export type IrDocType = "qualifiedInvoice";
/** Dash style of a stroked line or border (see STROKE_DASH_MM for the pattern each non-solid style renders as). */
export type IrStrokeStyle =
  | "solid"
  | "dotted"
  | "dashed"
  | "dashdot"
  | "dashdotdot";

/**
 * Attribute values a named style (IrNamedStyle) can set. Each element type
 * only applies the subset of keys listed for it in STYLEABLE_ATTRS.
 */
export interface IrStyleAttrs {
  readonly fontSize?: number;
  readonly align?: IrAlign;
  readonly lineHeight?: number;
  readonly borderWidth?: number;
  readonly thickness?: number;
}

/** A key of IrStyleAttrs. */
export type StyleAttrKey = keyof IrStyleAttrs;

/** A reusable style definition, referenced by an element's `style` field via `name`. */
export interface IrNamedStyle {
  readonly name: string;
  readonly attrs: IrStyleAttrs;
}

/** Page dimensions, in mm. */
export interface IrPage {
  readonly width: number;
  readonly height: number;
}

/** The document's single font, identified by name (a target resolves the name to actual font data). */
export interface IrFont {
  readonly name: string;
}

/** A table column: its data key, header label, width (mm), and text alignment. */
export interface IrColumn {
  readonly key: string;
  readonly label: string;
  readonly width: number;
  readonly align: IrAlign;
}

interface IrElementCommon {
  readonly id: string;
}

interface IrPositioned {
  readonly x: number;
  readonly y: number;
  readonly pages: IrPages;
}

/** A text box element. `text` may contain `{key}` interpolation tokens and, at top level only, `{#id}` footnote marks. */
export type IrTextElement = IrElementCommon &
  IrPositioned & {
    readonly type: "text";
    readonly w: number;
    readonly h: number;
    readonly text: string;
    readonly fontSize: number;
    readonly align: IrAlign;
    readonly lineHeight: number;
    readonly style?: string;
  };

/** A straight line element, horizontal or vertical, with configurable thickness, color, and dash style. */
export interface IrLineElement extends IrElementCommon, IrPositioned {
  readonly type: "line";
  readonly orientation: IrOrientation;
  readonly length: number;
  readonly thickness: number;
  readonly color?: string;
  readonly strokeStyle?: IrStrokeStyle;
  readonly style?: string;
}

/** A rectangle element with optional border, fill, dash style, and rounded corners. */
export interface IrRectElement extends IrElementCommon, IrPositioned {
  readonly type: "rect";
  readonly w: number;
  readonly h: number;
  readonly borderWidth: number;
  readonly borderColor?: string;
  readonly fillColor?: string;
  readonly borderStyle?: IrStrokeStyle;
  readonly cornerRadius?: number;
  readonly style?: string;
}

/** An ellipse element with optional border and fill. Always solid-stroked with no corner radius (see resolveEllipseStyle). */
export interface IrEllipseElement extends IrElementCommon, IrPositioned {
  readonly type: "ellipse";
  readonly w: number;
  readonly h: number;
  readonly borderWidth: number;
  readonly borderColor?: string;
  readonly fillColor?: string;
}

/** A fixed value that overrides a table's computed cell content at (`row`, `key`), taking precedence over the bound data for that one cell. */
export interface IrTableCellOverride {
  readonly row: number;
  readonly key: string;
  readonly value: string;
}

/** A data-bound table that can expand across multiple pages (see rule M09 for pagination geometry constraints). */
export interface IrTableElement extends IrElementCommon {
  readonly type: "table";
  readonly x: number;
  readonly y: number;
  readonly bind: string;
  readonly columns: readonly IrColumn[];
  readonly rowHeight: number;
  readonly headerHeight: number;
  readonly fontSize: number;
  readonly maxY: number;
  readonly continuationY: number;
  readonly minRows: number;
  readonly cellOverrides?: readonly IrTableCellOverride[];
  readonly stripeColor?: string;
  readonly style?: string;
}

/** An image element. `src` is a data URI (rule M08 requires a PNG or JPEG payload). */
export interface IrImageElement extends IrElementCommon, IrPositioned {
  readonly type: "image";
  readonly w: number;
  readonly h: number;
  readonly src: string;
}

/** A supported barcode symbology. */
export type IrBarcodeSymbology = "qrcode" | "code39" | "code128" | "ean13";

/** A barcode element. `value` may contain `{key}` interpolation tokens. */
export interface IrBarcodeElement extends IrElementCommon, IrPositioned {
  readonly type: "barcode";
  readonly w: number;
  readonly h: number;
  readonly symbology: IrBarcodeSymbology;
  readonly value: string;
}

/**
 * A flex container that lays out `children` along `direction`, distributing
 * `gap` and alignment per `justifyContent`/`alignItems`. Resolved away by
 * resolveFlex before rendering; `w`/`h` are the cross-axis size when set
 * (the main axis is sized to content unless explicitly given).
 */
export interface IrFlexElement extends IrElementCommon {
  readonly type: "flex";
  readonly x: number;
  readonly y: number;
  readonly pages: IrPages;
  readonly direction: IrFlexDirection;
  readonly w?: number;
  readonly h?: number;
  readonly gap: number;
  readonly justifyContent: IrFlexAlign;
  readonly alignItems: IrFlexAlign;
  readonly children: readonly IrFlexChild[];
}

/**
 * A text element whose content is generated per page from `format` (which
 * supports `{n}`/`{N}` placeholders for the current and total page number)
 * rather than from bound data.
 */
export interface IrPageNumberElement extends IrElementCommon, IrPositioned {
  readonly type: "pageNumber";
  readonly w: number;
  readonly h: number;
  readonly format: string;
  readonly fontSize: number;
  readonly align: IrAlign;
  readonly lineHeight: number;
  readonly style?: string;
}

/** Any top-level document element. */
export type IrElement =
  | IrTextElement
  | IrLineElement
  | IrRectElement
  | IrEllipseElement
  | IrTableElement
  | IrImageElement
  | IrFlexElement
  | IrPageNumberElement
  | IrBarcodeElement;

/** The `type` discriminant of IrElement. */
export type IrElementType = IrElement["type"];

/**
 * An IrElement usable inside a flex container: like IrElement but without
 * `x`/`y`/`pages`, since the container computes its children's position.
 * `table` cannot be a flex child.
 */
export type IrFlexChild =
  | Omit<IrTextElement, "x" | "y" | "pages">
  | Omit<IrLineElement, "x" | "y" | "pages">
  | Omit<IrRectElement, "x" | "y" | "pages">
  | Omit<IrEllipseElement, "x" | "y" | "pages">
  | Omit<IrImageElement, "x" | "y" | "pages">
  | Omit<IrPageNumberElement, "x" | "y" | "pages">
  | Omit<IrFlexElement, "x" | "y" | "pages">
  | Omit<IrBarcodeElement, "x" | "y" | "pages">;

/** A single footnote definition, referenced by `{#id}` marks in top-level text elements. */
export interface IrFootnoteNote {
  readonly id: string;
  readonly text: string;
}

/**
 * A document's footnote configuration: geometry (`x`/`w`/`bottom`, in mm) and
 * typography for the notes block resolveFootnotes appends, plus the note
 * definitions referenced by `{#id}` marks.
 */
export interface IrFootnotes {
  readonly x: number;
  readonly w: number;
  readonly bottom: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly pages: IrPages;
  readonly notes: readonly IrFootnoteNote[];
}

/** A parsed and normalized IR document, as returned by parseIr. */
export interface IrDocument {
  readonly version: string;
  readonly page: IrPage;
  readonly font: IrFont;
  readonly styles?: readonly IrNamedStyle[];
  readonly elements: readonly IrElement[];
  readonly docType?: IrDocType;
  readonly footnotes?: IrFootnotes;
}

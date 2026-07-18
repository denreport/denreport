import type { IrBarcodeSymbology } from "@denreport/core";

/** A pdfme `basePdf` describing a blank page of the given size (mm) with no margins. */
export interface PdfmeBlankBasePdf {
  readonly width: number;
  readonly height: number;
  readonly padding: readonly [number, number, number, number];
}

/** An element's position (mm) within a pdfme schema. */
export interface PdfmePosition {
  readonly x: number;
  readonly y: number;
}

interface PdfmeSchemaBase {
  readonly name: string;
  readonly position: PdfmePosition;
  readonly width: number;
  readonly height: number;
}

/**
 * A pdfme text schema: one per rendered line when justified alignment
 * requires per-line character spacing, otherwise one per text element.
 */
export interface PdfmeTextSchema extends PdfmeSchemaBase {
  readonly type: "text";
  readonly fontSize: number;
  readonly fontName: string;
  readonly alignment: "left" | "center" | "right";
  readonly verticalAlignment: "top";
  readonly lineHeight: number;
  /** justify（均等割付）の行のみ設定する。単位は fontSize と同じ pt */
  readonly characterSpacing?: number;
}

/** A pdfme line schema. */
export interface PdfmeLineSchema extends PdfmeSchemaBase {
  readonly type: "line";
  readonly color: string;
}

/** A pdfme rectangle schema. `radius` is set only when the source element has a positive corner radius. */
export interface PdfmeRectangleSchema extends PdfmeSchemaBase {
  readonly type: "rectangle";
  readonly borderWidth: number;
  readonly borderColor: string;
  readonly color: string;
  readonly radius?: number;
}

export interface PdfmeEllipseSchema extends PdfmeSchemaBase {
  readonly type: "ellipse";
  readonly borderWidth: number;
  readonly borderColor: string;
  readonly color: string;
}

/** A pdfme image schema. The image data is supplied separately via the input record (see PdfmeInputRecord). */
export interface PdfmeImageSchema extends PdfmeSchemaBase {
  readonly type: "image";
}

export interface PdfmeBarcodeSchema extends PdfmeSchemaBase {
  readonly type: IrBarcodeSymbology;
  readonly backgroundColor: string;
  readonly barColor: string;
  readonly includetext?: boolean;
}

/** Union of every pdfme schema type this package can emit. */
export type PdfmeSchema =
  | PdfmeTextSchema
  | PdfmeLineSchema
  | PdfmeRectangleSchema
  | PdfmeEllipseSchema
  | PdfmeImageSchema
  | PdfmeBarcodeSchema;

/** A pdfme template: a blank `basePdf` and one schema array per page. */
export interface PdfmeTemplate {
  readonly basePdf: PdfmeBlankBasePdf;
  readonly schemas: readonly (readonly PdfmeSchema[])[];
}

/** A pdfme `inputs` record: schema name to its bound value (text content, image data URI, or barcode content). */
export type PdfmeInputRecord = Readonly<Record<string, string>>;

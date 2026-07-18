export type { CompatFinding } from "./compat/check";
export { checkCompat } from "./compat/check";
export { COMPAT_MATRICES } from "./compat/registry";
export type {
  CompatEntry,
  CompatLevel,
  CompatTargetId,
  ElementCompat,
  TargetCompatMatrix,
} from "./compat/types";
export {
  PAGE_COUNT_MAX,
  PT_TO_MM,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_TEXT_OFFSET_Y,
  TABLE_FRAME_WIDTH,
  TABLE_GRID_WIDTH,
  TABLE_HEADER_TEXT_OFFSET_Y,
} from "./ir/constants";
export type { DataProblem, IrData } from "./ir/data";
export { analyzeData, emptyDataFor, validateData } from "./ir/data";
export type { IrError, IrRuleId } from "./ir/errors";
export type { IrPlacedElement } from "./ir/flex";
export { resolveFlex } from "./ir/flex";
export { resolveFootnotes } from "./ir/footnotes";
export { textTemplateKeys } from "./ir/interpolate";
export { checkQualifiedInvoice } from "./ir/invoice";
export type {
  LoweredBarcodeElement,
  LoweredDocument,
  LoweredElement,
  LoweredEllipseElement,
  LoweredImageElement,
  LoweredLineElement,
  LoweredRectElement,
  LoweredTextElement,
  LowerIrResult,
} from "./ir/lower";
export { lowerIr } from "./ir/lower";
export type { ParseIrResult } from "./ir/parse";
export { parseIr } from "./ir/parse";
export type { ResolvedShapeStyle, ResolvedStroke } from "./ir/style";
export {
  resolveEllipseStyle,
  resolveLineStyle,
  resolveRectStyle,
  STROKE_DASH_MM,
} from "./ir/style";
export { applicableStyleAttrs, STYLEABLE_ATTRS } from "./ir/styles";
export type {
  CharWidthEm,
  LaidOutLine,
  TextLayoutInput,
} from "./ir/text-layout";
export { layoutTextLines } from "./ir/text-layout";
export type {
  IrAlign,
  IrBarcodeElement,
  IrBarcodeSymbology,
  IrColumn,
  IrDocType,
  IrDocument,
  IrElement,
  IrElementType,
  IrEllipseElement,
  IrFlexAlign,
  IrFlexChild,
  IrFlexDirection,
  IrFlexElement,
  IrFont,
  IrFootnoteNote,
  IrFootnotes,
  IrImageElement,
  IrLineElement,
  IrNamedStyle,
  IrOrientation,
  IrPage,
  IrPageNumberElement,
  IrPages,
  IrRectElement,
  IrStrokeStyle,
  IrStyleAttrs,
  IrTableCellOverride,
  IrTableElement,
  IrTextElement,
  StyleAttrKey,
} from "./ir/types";
export { IR_VERSION } from "./ir/types";
export { validateIr } from "./ir/validate";

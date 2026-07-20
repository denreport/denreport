export type { CompatFinding } from "./compat/check.js";
export { checkCompat } from "./compat/check.js";
export { COMPAT_MATRICES } from "./compat/registry.js";
export type {
  CompatEntry,
  CompatLevel,
  CompatTargetId,
  ElementCompat,
  TargetCompatMatrix,
} from "./compat/types.js";
export {
  PAGE_COUNT_MAX,
  PT_TO_MM,
  TABLE_CELL_PADDING_X,
  TABLE_CELL_TEXT_OFFSET_Y,
  TABLE_FRAME_WIDTH,
  TABLE_GRID_WIDTH,
  TABLE_HEADER_TEXT_OFFSET_Y,
} from "./ir/constants.js";
export type { DataProblem, IrData, IrTableRow } from "./ir/data.js";
export { analyzeData, emptyDataFor, validateData } from "./ir/data.js";
export type { IrError, IrRuleId } from "./ir/errors.js";
export type { IrPlacedElement } from "./ir/flex.js";
export { resolveFlex } from "./ir/flex.js";
export { resolveFontSlot } from "./ir/font.js";
export { resolveFootnotes } from "./ir/footnotes.js";
export { textTemplateKeys } from "./ir/interpolate.js";
export { checkQualifiedInvoice } from "./ir/invoice.js";
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
} from "./ir/lower.js";
export { lowerIr } from "./ir/lower.js";
export type { ParseIrResult } from "./ir/parse.js";
export { parseIr } from "./ir/parse.js";
export type {
  ResolvedShapeStyle,
  ResolvedStroke,
  ResolvedTextStyle,
} from "./ir/style.js";
export {
  resolveEllipseStyle,
  resolveLineStyle,
  resolveRectStyle,
  resolveTextStyle,
  STROKE_DASH_MM,
} from "./ir/style.js";
export { applicableStyleAttrs, STYLEABLE_ATTRS } from "./ir/styles.js";
export type {
  SkipRange,
  TableChunkMerges,
  TableMergeRect,
} from "./ir/table-merge.js";
export { computeChunkMerges, subtractSkips } from "./ir/table-merge.js";
export type {
  CharWidthEm,
  LaidOutLine,
  TextLayoutInput,
} from "./ir/text-layout.js";
export { layoutTextLines } from "./ir/text-layout.js";
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
  IrFontSlot,
  IrFontStyle,
  IrFontWeight,
  IrFootnoteNote,
  IrFootnotes,
  IrGroup,
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
  IrTableCellSpan,
  IrTableElement,
  IrTextElement,
  StyleAttrKey,
} from "./ir/types.js";
export { IR_VERSION } from "./ir/types.js";
export { validateIr } from "./ir/validate.js";

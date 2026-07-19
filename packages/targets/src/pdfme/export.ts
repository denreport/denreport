import type {
  IrData,
  IrDocument,
  IrError,
  IrFontSlot,
  LaidOutLine,
  LoweredElement,
  LoweredTextElement,
} from "@denreport/core";
import {
  layoutTextLines,
  lowerIr,
  PT_TO_MM,
  resolveFontSlot,
} from "@denreport/core";
import type { FontSetData, ResolvedSlotFont } from "../fonts/set";
import { effectiveFontOf, resolveFontSetData } from "../fonts/set";
import type { FontIssue } from "../fonts/validate";
import { expandStrokes, rotatePointCw } from "./dash";
import type {
  PdfmeBarcodeSchema,
  PdfmeEllipseSchema,
  PdfmeImageSchema,
  PdfmeInputRecord,
  PdfmeLineSchema,
  PdfmeRectangleSchema,
  PdfmeSchema,
  PdfmeTemplate,
} from "./types";

/**
 * Result of exportPdfme. On success, `template` and `inputs` are ready to
 * pass to pdfme's generator and `warnings` holds non-fatal data problems. On
 * failure, `errors` holds IR/data validation errors and `fontIssues`
 * explains any font problem that prevented export (either may be empty
 * depending on which caused the failure).
 */
export type ExportPdfmeResult =
  | {
      readonly ok: true;
      readonly template: PdfmeTemplate;
      readonly inputs: readonly [PdfmeInputRecord];
      readonly warnings: readonly IrError[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly IrError[];
      readonly fontIssues: readonly FontIssue[];
    };

/** rotate は 0 のときスキーマにキーを出さない（既存スキーマ形の安定のため） */
function rotateAttr(rotate: number): { readonly rotate?: number } {
  return rotate === 0 ? {} : { rotate };
}

/** underline も false のときはキーを出さない（既存スキーマ形の安定のため） */
function underlineAttr(underline: boolean): { readonly underline?: boolean } {
  return underline ? { underline } : {};
}

function toStaticAlignment(
  align: LoweredTextElement["align"],
): "left" | "center" | "right" {
  return align === "justify" ? "left" : align;
}

// 全行 charSpacePt === 0（非 justify、または justify でも伸長不要）の1スキーマ経路
function textSchema(
  name: string,
  element: LoweredTextElement,
  fontName: string,
): PdfmeSchema {
  return {
    type: "text",
    name,
    position: { x: element.x, y: element.y },
    width: element.w,
    height: element.h,
    fontSize: element.fontSize,
    fontName,
    fontColor: element.color,
    alignment: toStaticAlignment(element.align),
    verticalAlignment: "top",
    lineHeight: element.lineHeight,
    ...underlineAttr(element.underline),
    ...rotateAttr(element.rotate),
  };
}

// justify で伸長が要る行を1行1スキーマに分割する経路
function justifyLineSchema(
  name: string,
  element: LoweredTextElement,
  fontName: string,
  line: LaidOutLine,
  lineIndex: number,
): PdfmeSchema {
  const lineHeightMm = element.lineHeight * element.fontSize * PT_TO_MM;
  // characterSpacing は末尾グリフの後ろにも字間を足すため、width を字間分広げないと
  // pdfme が内部再計測でこの行を再折り返ししてしまう
  const width = element.w + line.charSpacePt * PT_TO_MM;
  const unrotated = { x: element.x, y: element.y + lineIndex * lineHeightMm };
  // pdfme の回転はスキーマ中心周りのため、行スキーマの中心を要素中心周りに
  // 回転写像した位置へ置けば、要素全体を1回で回すのと等価になる
  const center = rotatePointCw(
    { x: unrotated.x + width / 2, y: unrotated.y + lineHeightMm / 2 },
    { x: element.x + element.w / 2, y: element.y + element.h / 2 },
    element.rotate,
  );
  return {
    type: "text",
    name,
    position: { x: center.x - width / 2, y: center.y - lineHeightMm / 2 },
    width,
    height: lineHeightMm,
    fontSize: element.fontSize,
    fontName,
    fontColor: element.color,
    alignment: "left",
    verticalAlignment: "top",
    lineHeight: element.lineHeight,
    characterSpacing: line.charSpacePt,
    ...underlineAttr(element.underline),
    ...rotateAttr(element.rotate),
  };
}

function toSchema(
  name: string,
  element: Exclude<LoweredElement, LoweredTextElement>,
): {
  readonly schema: PdfmeSchema;
  readonly input?: readonly [string, string];
} {
  const position = { x: element.x, y: element.y };
  switch (element.type) {
    case "line": {
      const schema: PdfmeLineSchema = {
        type: "line",
        name,
        position,
        width:
          element.orientation === "horizontal"
            ? element.length
            : element.thickness,
        height:
          element.orientation === "horizontal"
            ? element.thickness
            : element.length,
        color: element.color,
        ...rotateAttr(element.rotate),
      };
      return { schema };
    }
    case "rect": {
      const schema: PdfmeRectangleSchema = {
        type: "rectangle",
        name,
        position,
        width: element.w,
        height: element.h,
        borderWidth: element.borderWidth,
        borderColor: element.borderColor,
        color: element.fillColor ?? "",
        ...(element.cornerRadius > 0 ? { radius: element.cornerRadius } : {}),
        ...rotateAttr(element.rotate),
      };
      return { schema };
    }
    case "ellipse": {
      const schema: PdfmeEllipseSchema = {
        type: "ellipse",
        name,
        position,
        width: element.w,
        height: element.h,
        borderWidth: element.borderWidth,
        borderColor: element.borderColor,
        color: element.fillColor ?? "",
        ...rotateAttr(element.rotate),
      };
      return { schema };
    }
    case "image": {
      const schema: PdfmeImageSchema = {
        type: "image",
        name,
        position,
        width: element.w,
        height: element.h,
        ...rotateAttr(element.rotate),
      };
      return { schema, input: [name, element.src] };
    }
    case "barcode": {
      const schema: PdfmeBarcodeSchema = {
        type: element.symbology,
        name,
        position,
        width: element.w,
        height: element.h,
        backgroundColor: "#ffffff",
        barColor: "#000000",
        ...(element.symbology === "ean13" ? { includetext: true } : {}),
        ...rotateAttr(element.rotate),
      };
      return { schema, input: [name, element.content] };
    }
  }
}

/**
 * Lowers `document` with `data` and converts the result into a pdfme
 * template plus its single input record, using `fonts` to measure text for
 * wrapping and justification — each element measures with the font of its
 * resolved slot. Every slot in `fonts` must be a valid TTF (see validateFont)
 * with readable metrics; otherwise export fails with fontIssues explaining
 * why.
 */
export function exportPdfme(
  document: IrDocument,
  data: IrData,
  fonts: FontSetData,
): ExportPdfmeResult {
  const fontSet = resolveFontSetData(fonts);
  const result = lowerIr(document, data);
  if (!fontSet.ok || !result.ok) {
    return {
      ok: false,
      errors: result.ok ? [] : result.errors,
      fontIssues: fontSet.ok ? [] : fontSet.issues,
    };
  }

  const font = effectiveFontOf(document.font, fonts);
  const slotFor = (element: LoweredTextElement): IrFontSlot =>
    resolveFontSlot(font, element.fontWeight, element.fontStyle);
  const slotFontFor = (slot: IrFontSlot): ResolvedSlotFont =>
    // effectiveFontOf により解決先スロットのデータ存在は保証される
    fontSet.slots.get(slot) as ResolvedSlotFont;

  const lowered = result.document;
  const inputs: Record<string, string> = {};
  const schemas = lowered.pages.map((pageElements, pageIndex) => {
    const seqBySourceId = new Map<string, number>();
    const nextName = (sourceId: string): string => {
      const seq = seqBySourceId.get(sourceId) ?? 0;
      seqBySourceId.set(sourceId, seq + 1);
      return `p${pageIndex + 1}_${sourceId}_${seq}`;
    };
    return expandStrokes(pageElements).flatMap((element): PdfmeSchema[] => {
      if (element.type !== "text") {
        const name = nextName(element.sourceId);
        const { schema, input } = toSchema(name, element);
        if (input) inputs[input[0]] = input[1];
        return [schema];
      }
      const slot = slotFor(element);
      const fontName = font[slot] as string;
      const lines = layoutTextLines(
        {
          content: element.content,
          widthMm: element.w,
          fontSize: element.fontSize,
          align: element.align,
        },
        slotFontFor(slot).charWidthEm,
      );
      if (lines.every((line) => line.charSpacePt === 0)) {
        const name = nextName(element.sourceId);
        inputs[name] = lines.map((line) => line.text).join("\n");
        return [textSchema(name, element, fontName)];
      }
      return lines.map((line, lineIndex) => {
        const name = nextName(element.sourceId);
        inputs[name] = line.text;
        return justifyLineSchema(name, element, fontName, line, lineIndex);
      });
    });
  });

  return {
    ok: true,
    template: {
      basePdf: {
        width: lowered.page.width,
        height: lowered.page.height,
        padding: [0, 0, 0, 0],
      },
      schemas,
    },
    inputs: [inputs],
    warnings: result.warnings,
  };
}

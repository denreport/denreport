import type { ExtractedPdf, ExtractedTextItem } from "./pdf-text";
import type { ExpectedLine, ReferenceExpectation } from "./reference-text";

export const BASELINE_GROUP_EPS_MM = 0.3;
export const REF_BASELINE_TOL_MM = 0.2;
export const REF_EXTENT_MARGIN_MM = 0.5;
export const CROSS_BASELINE_TOL_MM = 1.0;
export const CROSS_X_TOL_MM = 1.0;
export const CROSS_WIDTH_TOL_MM = 1.0;

const PAGE_SIZE_TOL_MM = 0.2;

export interface EquivalenceMismatch {
  readonly page: number;
  readonly message: string;
}

interface MatchedLine {
  readonly indices: readonly number[];
  readonly minX: number;
  readonly baselineY: number;
  readonly extentWidth: number;
}

function fmt(value: number): string {
  return value.toFixed(2);
}

function clusterByBaseline(
  candidates: readonly { item: ExtractedTextItem; index: number }[],
): { item: ExtractedTextItem; index: number }[][] {
  const sorted = [...candidates].sort(
    (a, b) => a.item.baselineY - b.item.baselineY,
  );
  const clusters: { item: ExtractedTextItem; index: number }[][] = [];
  for (const candidate of sorted) {
    const current = clusters[clusters.length - 1];
    const head = current?.[0];
    if (
      current !== undefined &&
      head !== undefined &&
      candidate.item.baselineY - head.item.baselineY <= BASELINE_GROUP_EPS_MM
    ) {
      current.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }
  return clusters;
}

function matchExpectedLine(
  items: readonly ExtractedTextItem[],
  consumed: ReadonlySet<number>,
  line: ExpectedLine,
): { readonly matches: readonly MatchedLine[] } {
  const baselineMin = line.baselineY - REF_BASELINE_TOL_MM;
  const baselineMax = line.baselineY + REF_BASELINE_TOL_MM;
  const extentLeft = line.x - REF_EXTENT_MARGIN_MM;
  const extentRight = line.x + line.w + REF_EXTENT_MARGIN_MM;

  const candidates = items.flatMap((item, index) => {
    if (consumed.has(index) || item.str.trim() === "") return [];
    if (item.baselineY < baselineMin || item.baselineY > baselineMax) return [];
    if (item.x < extentLeft || item.x + item.width > extentRight) return [];
    return [{ item, index }];
  });

  const matches: MatchedLine[] = [];
  for (const cluster of clusterByBaseline(candidates)) {
    const inX = [...cluster].sort((a, b) => a.item.x - b.item.x);
    const joined = inX.map((c) => c.item.str).join("");
    if (joined.trim() !== line.text.trim()) continue;
    const minX = Math.min(...inX.map((c) => c.item.x));
    const maxRight = Math.max(...inX.map((c) => c.item.x + c.item.width));
    matches.push({
      indices: inX.map((c) => c.index),
      minX,
      baselineY: inX.reduce((sum, c) => sum + c.item.baselineY, 0) / inX.length,
      extentWidth: maxRight - minX,
    });
  }
  return { matches };
}

function checkPageGeometry(
  pdf: ExtractedPdf,
  expectation: ReferenceExpectation,
): EquivalenceMismatch[] {
  const mismatches: EquivalenceMismatch[] = [];
  if (pdf.pageCount !== expectation.pageCount) {
    mismatches.push({
      page: 0,
      message: `ページ数不一致: 期待 ${expectation.pageCount}, 実測 ${pdf.pageCount}`,
    });
  }
  if (
    Math.abs(pdf.pageWidth - expectation.pageWidth) > PAGE_SIZE_TOL_MM ||
    Math.abs(pdf.pageHeight - expectation.pageHeight) > PAGE_SIZE_TOL_MM
  ) {
    mismatches.push({
      page: 0,
      message:
        `ページ寸法不一致: 期待 ${fmt(expectation.pageWidth)}x${fmt(expectation.pageHeight)}mm, ` +
        `実測 ${fmt(pdf.pageWidth)}x${fmt(pdf.pageHeight)}mm`,
    });
  }
  return mismatches;
}

export function checkAgainstReference(
  pdf: ExtractedPdf,
  expectation: ReferenceExpectation,
): readonly EquivalenceMismatch[] {
  const mismatches: EquivalenceMismatch[] = [
    ...checkPageGeometry(pdf, expectation),
  ];
  const consumedByPage = pdf.pages.map(() => new Set<number>());

  for (const line of expectation.lines) {
    const page = pdf.pages[line.page - 1];
    const consumed = consumedByPage[line.page - 1];
    if (page === undefined || consumed === undefined) {
      mismatches.push({
        page: line.page,
        message: `期待行「${line.text}」のページ ${line.page} が PDF に存在しません`,
      });
      continue;
    }
    const { matches } = matchExpectedLine(page.textItems, consumed, line);
    const match = matches[0];
    if (match === undefined) {
      mismatches.push({
        page: line.page,
        message:
          `期待行「${line.text}」が見つかりません ` +
          `(x=[${fmt(line.x)}, ${fmt(line.x + line.w)}], ` +
          `規範ベースライン y=${fmt(line.baselineY)}±${fmt(REF_BASELINE_TOL_MM)})`,
      });
      continue;
    }
    if (matches.length > 1) {
      mismatches.push({
        page: line.page,
        message: `期待行「${line.text}」に ${matches.length} 個の候補がマッチしました（一意に定まりません）`,
      });
      continue;
    }
    for (const index of match.indices) consumed.add(index);
  }

  pdf.pages.forEach((page, pageIndex) => {
    const consumed = consumedByPage[pageIndex];
    page.textItems.forEach((item, index) => {
      if (consumed?.has(index) || item.str.trim() === "") return;
      mismatches.push({
        page: pageIndex + 1,
        message: `どの期待行にもマッチしないテキスト「${item.str}」(x=${fmt(item.x)}, baselineY=${fmt(item.baselineY)})`,
      });
    });
    const expectedImages = expectation.imageCountByPage[pageIndex] ?? 0;
    if (page.imageDrawCount !== expectedImages) {
      mismatches.push({
        page: pageIndex + 1,
        message: `画像描画件数不一致: 期待 ${expectedImages}, 実測 ${page.imageDrawCount}`,
      });
    }
  });

  return mismatches;
}

export function checkCrossTarget(
  a: ExtractedPdf,
  b: ExtractedPdf,
  expectation: ReferenceExpectation,
): readonly EquivalenceMismatch[] {
  const mismatches: EquivalenceMismatch[] = [];
  if (a.pageCount !== b.pageCount) {
    mismatches.push({
      page: 0,
      message: `ページ数不一致: a=${a.pageCount}, b=${b.pageCount}`,
    });
  }
  const consumedA = a.pages.map(() => new Set<number>());
  const consumedB = b.pages.map(() => new Set<number>());

  for (const line of expectation.lines) {
    const matchIn = (
      pdf: ExtractedPdf,
      consumedByPage: Set<number>[],
    ): MatchedLine | undefined => {
      const page = pdf.pages[line.page - 1];
      const consumed = consumedByPage[line.page - 1];
      if (page === undefined || consumed === undefined) return undefined;
      const { matches } = matchExpectedLine(page.textItems, consumed, line);
      const match = matches[0];
      if (match === undefined || matches.length > 1) return undefined;
      for (const index of match.indices) consumed.add(index);
      return match;
    };
    const matchA = matchIn(a, consumedA);
    const matchB = matchIn(b, consumedB);
    if (matchA === undefined || matchB === undefined) {
      mismatches.push({
        page: line.page,
        message:
          `期待行「${line.text}」が一意にマッチしません ` +
          `(a=${matchA === undefined ? "不成立" : "成立"}, b=${matchB === undefined ? "不成立" : "成立"})`,
      });
      continue;
    }
    const dx = Math.abs(matchA.minX - matchB.minX);
    const dBaseline = Math.abs(matchA.baselineY - matchB.baselineY);
    const dWidth = Math.abs(matchA.extentWidth - matchB.extentWidth);
    if (dx > CROSS_X_TOL_MM) {
      mismatches.push({
        page: line.page,
        message: `行「${line.text}」の左端差 ${fmt(dx)}mm が許容 ${fmt(CROSS_X_TOL_MM)}mm を超過 (a=${fmt(matchA.minX)}, b=${fmt(matchB.minX)})`,
      });
    }
    if (dBaseline > CROSS_BASELINE_TOL_MM) {
      mismatches.push({
        page: line.page,
        message: `行「${line.text}」のベースライン差 ${fmt(dBaseline)}mm が許容 ${fmt(CROSS_BASELINE_TOL_MM)}mm を超過 (a=${fmt(matchA.baselineY)}, b=${fmt(matchB.baselineY)})`,
      });
    }
    if (dWidth > CROSS_WIDTH_TOL_MM) {
      mismatches.push({
        page: line.page,
        message: `行「${line.text}」の全幅差 ${fmt(dWidth)}mm が許容 ${fmt(CROSS_WIDTH_TOL_MM)}mm を超過 (a=${fmt(matchA.extentWidth)}, b=${fmt(matchB.extentWidth)})`,
      });
    }
  }

  return mismatches;
}

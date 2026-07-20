import type { IrPage } from "@denreport/core";

/** axis "x" = a vertical line (x position), "y" = a horizontal line. Structurally compatible with snapping.ts's SnapGuide */
export interface CustomGuide {
  readonly id: string;
  readonly axis: "x" | "y";
  readonly positionMm: number;
}

function nextGuideId(guides: readonly CustomGuide[]): string {
  const used = new Set(guides.map((guide) => guide.id));
  let n = 1;
  while (used.has(`guide${n}`)) {
    n += 1;
  }
  return `guide${n}`;
}

export function addGuide(
  guides: readonly CustomGuide[],
  axis: "x" | "y",
  positionMm: number,
): { readonly guides: readonly CustomGuide[]; readonly id: string } {
  const id = nextGuideId(guides);
  return { guides: [...guides, { id, axis, positionMm }], id };
}

export function moveGuide(
  guides: readonly CustomGuide[],
  id: string,
  positionMm: number,
): readonly CustomGuide[] {
  return guides.map((guide) =>
    guide.id === id ? { ...guide, positionMm } : guide,
  );
}

export function removeGuide(
  guides: readonly CustomGuide[],
  id: string,
): readonly CustomGuide[] {
  return guides.filter((guide) => guide.id !== id);
}

/** Returns only guides within the page range [0, size] (excludes orphans left after a page size change from rendering/snapping) */
export function guidesInPage(
  guides: readonly CustomGuide[],
  page: IrPage,
): readonly CustomGuide[] {
  return guides.filter((guide) => {
    const size = guide.axis === "x" ? page.width : page.height;
    return guide.positionMm >= 0 && guide.positionMm <= size;
  });
}

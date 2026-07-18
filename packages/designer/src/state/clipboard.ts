import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
} from "@denreport/core";
import { PASTE_OFFSET_MM } from "./constants";
import { addElement } from "./elements";
import { roundMm } from "./geometry";
import type { ElementGroup } from "./groups";
import { livingGroups } from "./groups";

/** アプリ内クリップボードの値。elements は格納時点の要素（文書順）。
    pasteCount はこの内容を貼り付けた回数（オフセット累積用） */
export interface ClipboardState {
  readonly elements: readonly IrElement[];
  readonly pasteCount: number;
  /** elements への添字集合の列。格納時点で同一グループだった要素のまとまり */
  readonly groupIndexes: readonly (readonly number[])[];
}

export interface PasteResult {
  readonly document: IrDocument;
  /** 貼り付けた新要素のトップレベル id（新しい選択にする） */
  readonly pastedIds: readonly string[];
  /** pasteCount を +1 した次のクリップボード値 */
  readonly clipboard: ClipboardState;
}

/** selection のうちトップレベル要素だけを文書順で抜き出して格納値を作る。
    該当が 0 件なら null（コピー/切り取りは成立しない） */
export function clipboardFromSelection(
  document: IrDocument,
  selection: readonly string[],
  groups: readonly ElementGroup[],
): ClipboardState | null {
  const idSet = new Set(selection);
  const elements = document.elements.filter((el) => idSet.has(el.id));
  if (elements.length === 0) {
    return null;
  }
  const indexById = new Map(elements.map((el, index) => [el.id, index]));
  const groupIndexes: number[][] = [];
  for (const group of livingGroups(groups, document)) {
    const indexes = group.memberIds
      .map((id) => indexById.get(id))
      .filter((index): index is number => index !== undefined);
    if (indexes.length >= 2) {
      groupIndexes.push(indexes);
    }
  }
  return { elements, pasteCount: 0, groupIndexes };
}

function collectUsedIds(document: IrDocument): Set<string> {
  const ids = new Set<string>();
  function visit(el: IrElement | IrFlexChild): void {
    ids.add(el.id);
    if (el.type === "flex") {
      for (const child of el.children) {
        visit(child);
      }
    }
  }
  for (const el of document.elements) {
    visit(el);
  }
  return ids;
}

/** used から見た "<type><n>" の最小空き番号を採り、used に加えて返す */
function claimId(used: Set<string>, type: IrElementType): string {
  let n = 1;
  while (used.has(`${type}${n}`)) {
    n += 1;
  }
  const id = `${type}${n}`;
  used.add(id);
  return id;
}

function cloneFlexChild(child: IrFlexChild, used: Set<string>): IrFlexChild {
  const id = claimId(used, child.type);
  if (child.type === "flex") {
    return {
      ...child,
      id,
      children: child.children.map((c) => cloneFlexChild(c, used)),
    };
  }
  return { ...child, id };
}

function cloneTopElement(
  el: IrElement,
  used: Set<string>,
  dx: number,
  dy: number,
): IrElement {
  const id = claimId(used, el.type);
  switch (el.type) {
    case "table":
      return {
        ...el,
        id,
        x: roundMm(el.x + dx),
        y: roundMm(el.y + dy),
        continuationY: roundMm(el.continuationY + dy),
      };
    case "flex":
      return {
        ...el,
        id,
        x: roundMm(el.x + dx),
        y: roundMm(el.y + dy),
        children: el.children.map((child) => cloneFlexChild(child, used)),
      };
    default:
      return { ...el, id, x: roundMm(el.x + dx), y: roundMm(el.y + dy) };
  }
}

/** clipboard.elements を id 再採番・オフセット適用のうえ document 末尾に追加する。
    オフセットは (pasteCount + 1) × PASTE_OFFSET_MM を x/y 両方向に適用 */
export function pasteFromClipboard(
  document: IrDocument,
  clipboard: ClipboardState,
): PasteResult {
  const offset = (clipboard.pasteCount + 1) * PASTE_OFFSET_MM;
  const used = collectUsedIds(document);
  let nextDocument = document;
  const pastedIds: string[] = [];
  for (const el of clipboard.elements) {
    const cloned = cloneTopElement(el, used, offset, offset);
    nextDocument = addElement(nextDocument, cloned);
    pastedIds.push(cloned.id);
  }
  return {
    document: nextDocument,
    pastedIds,
    clipboard: { ...clipboard, pasteCount: clipboard.pasteCount + 1 },
  };
}

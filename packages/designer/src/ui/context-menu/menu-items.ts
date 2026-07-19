import type { Messages } from "../../i18n/messages";

export type CanvasMenuAction =
  | "mergeCells"
  | "unmergeCells"
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "group"
  | "ungroup"
  | "delete";

export interface CanvasMenuItem {
  readonly action: CanvasMenuAction;
  /** 表示名（例: コピー） */
  readonly label: string;
  /** ショートカット表示（例: Ctrl+C）。複製は null */
  readonly shortcut: string | null;
  readonly disabled: boolean;
}

export interface ContextTarget {
  /** メニュー操作の対象になる選択（右クリックによる単独選択への追従を反映済み） */
  readonly selection: readonly string[];
  /** true = 要素上の右クリック、false = 背景 */
  readonly onElement: boolean;
}

/** 右クリック対象 id（背景は null）と現在の選択から、メニューの対象を決める */
export function resolveContextTarget(
  selection: readonly string[],
  targetId: string | null,
): ContextTarget {
  if (targetId === null) {
    return { selection, onElement: false };
  }
  if (selection.includes(targetId)) {
    return { selection, onElement: true };
  }
  return { selection: [targetId], onElement: true };
}

export interface CellMenuContext {
  readonly canMerge: boolean;
  readonly canUnmerge: boolean;
}

/** 要素操作7項目に、セル文脈があれば先頭へセル結合の2項目を加えて構築する */
export function buildCanvasMenuItems(
  m: Messages["contextMenu"],
  input: {
    readonly onElement: boolean;
    /** clipboardFromSelection が非 null（= トップレベル要素を含む選択） */
    readonly canCopy: boolean;
    readonly hasSelection: boolean;
    readonly hasClipboard: boolean;
    readonly canGroup: boolean;
    readonly canUngroup: boolean;
    readonly cell?: CellMenuContext | null;
  },
): readonly CanvasMenuItem[] {
  const {
    onElement,
    canCopy,
    hasSelection,
    hasClipboard,
    canGroup,
    canUngroup,
    cell,
  } = input;
  const copyEnabled = onElement && canCopy;
  const cellItems: CanvasMenuItem[] =
    cell === undefined || cell === null
      ? []
      : [
          {
            action: "mergeCells",
            label: m.mergeCells,
            shortcut: null,
            disabled: !cell.canMerge,
          },
          {
            action: "unmergeCells",
            label: m.unmergeCells,
            shortcut: null,
            disabled: !cell.canUnmerge,
          },
        ];
  return [
    ...cellItems,
    {
      action: "copy",
      label: m.copy,
      shortcut: "Ctrl+C",
      disabled: !copyEnabled,
    },
    {
      action: "cut",
      label: m.cut,
      shortcut: "Ctrl+X",
      disabled: !copyEnabled,
    },
    {
      action: "paste",
      label: m.paste,
      shortcut: "Ctrl+V",
      disabled: !hasClipboard,
    },
    {
      action: "duplicate",
      label: m.duplicate,
      shortcut: null,
      disabled: !copyEnabled,
    },
    {
      action: "group",
      label: m.group,
      shortcut: "Ctrl+G",
      disabled: !(onElement && canGroup),
    },
    {
      action: "ungroup",
      label: m.ungroup,
      shortcut: "Ctrl+Shift+G",
      disabled: !(onElement && canUngroup),
    },
    {
      action: "delete",
      label: m.delete,
      shortcut: "Delete",
      disabled: !(onElement && hasSelection),
    },
  ];
}

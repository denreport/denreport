import type { Messages } from "../../i18n/messages/index.js";

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
  /** Display name (e.g. Copy) */
  readonly label: string;
  /** Shortcut display (e.g. Ctrl+C). null for duplicate */
  readonly shortcut: string | null;
  readonly disabled: boolean;
}

export interface ContextTarget {
  /** The selection targeted by the menu operation (already reflects following a right-click's single-selection) */
  readonly selection: readonly string[];
  /** true = right-click on an element, false = background */
  readonly onElement: boolean;
}

/** Determines the menu's target from the right-clicked id (null for background) and the current selection */
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

/** Builds the 7 element-operation items, prepending the 2 cell-merge items at the front if a cell context is present */
export function buildCanvasMenuItems(
  m: Messages["contextMenu"],
  input: {
    readonly onElement: boolean;
    /** clipboardFromSelection is non-null (= a selection that includes a top-level element) */
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

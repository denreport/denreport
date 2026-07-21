import { describe, expect, it } from "vitest";
import { workspaceEn } from "../../i18n/messages/en/workspace";
import { workspaceJa } from "../../i18n/messages/ja/workspace";
import {
  buildCanvasMenuItems,
  type CanvasMenuAction,
  resolveContextTarget,
} from "./menu-items";

const m = workspaceJa.contextMenu;

describe("resolveContextTarget", () => {
  it("switches to a single selection when the element is outside the selection, with onElement=true", () => {
    expect(resolveContextTarget(["a"], "b")).toEqual({
      selection: ["b"],
      onElement: true,
    });
  });

  it("keeps the selection when the element is inside it, with onElement=true", () => {
    expect(resolveContextTarget(["a", "b"], "a")).toEqual({
      selection: ["a", "b"],
      onElement: true,
    });
  });

  it("keeps the selection for the background (targetId=null), with onElement=false", () => {
    expect(resolveContextTarget(["a", "b"], null)).toEqual({
      selection: ["a", "b"],
      onElement: false,
    });
  });
});

describe("buildCanvasMenuItems", () => {
  it("returns 7 items in a fixed order", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
    });
    expect(items.map((item) => item.action)).toEqual<CanvasMenuAction[]>([
      "copy",
      "cut",
      "paste",
      "duplicate",
      "group",
      "ungroup",
      "delete",
    ]);
  });

  it("all items are enabled when on an element, copyable, clipboard non-empty, and group/ungroup available", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
    });
    expect(items.every((item) => !item.disabled)).toBe(true);
  });

  it("everything but paste is disabled on the background", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: false,
      canCopy: false,
      hasSelection: false,
      hasClipboard: true,
      canGroup: false,
      canUngroup: false,
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("paste")?.disabled).toBe(false);
    expect(byAction.get("copy")?.disabled).toBe(true);
    expect(byAction.get("cut")?.disabled).toBe(true);
    expect(byAction.get("duplicate")?.disabled).toBe(true);
    expect(byAction.get("group")?.disabled).toBe(true);
    expect(byAction.get("ungroup")?.disabled).toBe(true);
    expect(byAction.get("delete")?.disabled).toBe(true);
  });

  it("omitting cell keeps the original 7 items without cell items", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
    });
    expect(items).toHaveLength(7);
    expect(items.some((item) => item.action === "mergeCells")).toBe(false);
    expect(items.some((item) => item.action === "unmergeCells")).toBe(false);
  });

  it("adds 2 cell-merge items at the front when cell is non-null", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
      cell: { canMerge: true, canUnmerge: false },
    });
    expect(items.map((item) => item.action)).toEqual<CanvasMenuAction[]>([
      "mergeCells",
      "unmergeCells",
      "copy",
      "cut",
      "paste",
      "duplicate",
      "group",
      "ungroup",
      "delete",
    ]);
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("mergeCells")?.disabled).toBe(false);
    expect(byAction.get("unmergeCells")?.disabled).toBe(true);
  });

  it("excludes cell items when cell is null", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
      cell: null,
    });
    expect(items).toHaveLength(7);
  });

  it("paste is disabled when the clipboard is empty", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: false,
      canGroup: true,
      canUngroup: true,
    });
    expect(items.find((item) => item.action === "paste")?.disabled).toBe(true);
  });

  it("only delete is enabled when the selection is flex-children-only equivalent (canCopy=false)", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: false,
      hasSelection: true,
      hasClipboard: false,
      canGroup: false,
      canUngroup: false,
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("copy")?.disabled).toBe(true);
    expect(byAction.get("cut")?.disabled).toBe(true);
    expect(byAction.get("duplicate")?.disabled).toBe(true);
    expect(byAction.get("delete")?.disabled).toBe(false);
  });

  it("delete is disabled when the selection is empty even on an element", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: false,
      hasSelection: false,
      hasClipboard: false,
      canGroup: false,
      canUngroup: false,
    });
    expect(items.find((item) => item.action === "delete")?.disabled).toBe(true);
  });

  it("group/ungroup are disabled even on an element when canGroup/canUngroup are false", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: false,
      canGroup: false,
      canUngroup: false,
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("group")?.disabled).toBe(true);
    expect(byAction.get("ungroup")?.disabled).toBe(true);
  });

  it("group/ungroup are disabled on the background even when canGroup/canUngroup are true", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: false,
      canCopy: false,
      hasSelection: false,
      hasClipboard: false,
      canGroup: true,
      canUngroup: true,
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("group")?.disabled).toBe(true);
    expect(byAction.get("ungroup")?.disabled).toBe(true);
  });

  it("shortcut display exists for copy/cut/paste/group/ungroup/delete, and is null for duplicate", () => {
    const items = buildCanvasMenuItems(m, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("copy")?.shortcut).toBe("Ctrl+C");
    expect(byAction.get("cut")?.shortcut).toBe("Ctrl+X");
    expect(byAction.get("paste")?.shortcut).toBe("Ctrl+V");
    expect(byAction.get("group")?.shortcut).toBe("Ctrl+G");
    expect(byAction.get("ungroup")?.shortcut).toBe("Ctrl+Shift+G");
    expect(byAction.get("delete")?.shortcut).toBe("Delete");
    expect(byAction.get("duplicate")?.shortcut).toBeNull();
  });

  it("labels become English when the en m is passed", () => {
    const items = buildCanvasMenuItems(workspaceEn.contextMenu, {
      onElement: true,
      canCopy: true,
      hasSelection: true,
      hasClipboard: true,
      canGroup: true,
      canUngroup: true,
      cell: { canMerge: true, canUnmerge: true },
    });
    const byAction = new Map(items.map((item) => [item.action, item]));
    expect(byAction.get("copy")?.label).toBe("Copy");
    expect(byAction.get("delete")?.label).toBe("Delete");
    expect(byAction.get("mergeCells")?.label).toBe("Merge cells");
  });
});

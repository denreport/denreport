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
  it("選択外の要素なら単独選択に切り替え、onElement=true", () => {
    expect(resolveContextTarget(["a"], "b")).toEqual({
      selection: ["b"],
      onElement: true,
    });
  });

  it("選択内の要素なら選択を維持し、onElement=true", () => {
    expect(resolveContextTarget(["a", "b"], "a")).toEqual({
      selection: ["a", "b"],
      onElement: true,
    });
  });

  it("背景（targetId=null）なら選択を維持し、onElement=false", () => {
    expect(resolveContextTarget(["a", "b"], null)).toEqual({
      selection: ["a", "b"],
      onElement: false,
    });
  });
});

describe("buildCanvasMenuItems", () => {
  it("7項目・固定順で返す", () => {
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

  it("要素上・コピー可能・クリップボードあり・グループ化/解除可能なら全項目が有効", () => {
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

  it("背景では貼り付け以外が無効", () => {
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

  it("cell 省略時はセル項目を含まない従来7項目のまま", () => {
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

  it("cell が非 null なら先頭にセル結合2項目を足す", () => {
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

  it("cell が null ならセル項目を含まない", () => {
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

  it("クリップボードが空なら貼り付けが無効", () => {
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

  it("flex 子のみの選択相当（canCopy=false）では削除だけ有効", () => {
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

  it("要素上でも選択が空なら削除が無効", () => {
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

  it("canGroup/canUngroup が false なら要素上でもグループ化/解除は無効", () => {
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

  it("背景では canGroup/canUngroup が true でもグループ化/解除は無効", () => {
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

  it("ショートカット表示はコピー/切り取り/貼り付け/グループ化/グループ解除/削除にあり、複製は null", () => {
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

  it("en の m を渡すとラベルが英語になる", () => {
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

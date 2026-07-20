import type { StyleAttrKey } from "@denreport/core";

export const dialogsManageJa = {
  styles: {
    title: "スタイル",
    addNew: "＋ 新しいスタイル",
    addFromSelection: "選択要素から作成",
    empty: "スタイルはまだありません。",
    nameLabel: "名前",
    nameFor: (n: number): string => `スタイル${n}`,
    deleteAriaLabel: (name: string): string => `スタイル "${name}" を削除`,
    attrLabels: {
      fontSize: "文字サイズ",
      align: "整列",
      lineHeight: "行間",
      fontWeight: "太字",
      fontStyle: "斜体",
      underline: "下線",
      borderWidth: "枠線幅",
      thickness: "太さ",
    } satisfies Record<StyleAttrKey, string>,
    fontWeightOptions: { normal: "標準", bold: "太字" },
    fontStyleOptions: { normal: "正体", italic: "斜体" },
    underlineOptions: { on: "あり", off: "なし" },
    summary: {
      lineHeight: (value: number): string => `行間${value}`,
      fontWeightBold: "太字",
      fontWeightNormal: "標準太さ",
      fontStyleItalic: "斜体",
      fontStyleNormal: "正体",
      underlineOn: "下線",
      underlineOff: "下線なし",
      borderWidth: (value: number): string => `枠線${value}mm`,
      thickness: (value: number): string => `太さ${value}mm`,
      empty: "（属性なし）",
    },
  },
  shortcuts: {
    title: "キーボードショートカット",
    groups: {
      edit: "編集",
      selectMove: "選択・移動",
      view: "表示",
      file: "ファイル",
      help: "ヘルプ",
    },
    items: {
      undo: { keys: "Ctrl/⌘+Z", description: "元に戻す" },
      redo: { keys: "Ctrl/⌘+Shift+Z、Ctrl/⌘+Y", description: "やり直す" },
      copy: { keys: "Ctrl/⌘+C", description: "コピー" },
      cut: { keys: "Ctrl/⌘+X", description: "切り取り" },
      paste: { keys: "Ctrl/⌘+V", description: "貼り付け" },
      duplicate: { keys: "Ctrl/⌘+D", description: "複製" },
      group: { keys: "Ctrl/⌘+G", description: "グループ化" },
      ungroup: { keys: "Ctrl/⌘+Shift+G", description: "グループ解除" },
      deleteSelection: {
        keys: "Delete、Backspace",
        description: "選択要素を削除",
      },
      selectAll: { keys: "Ctrl/⌘+A", description: "すべての要素を選択" },
      moveSelection: {
        keys: "矢印キー",
        description:
          "選択要素を移動（スナップ有効時5mm、無効時1mm、Shift併用で0.1mm）",
      },
      deselectOrCancel: {
        keys: "Escape",
        description: "選択解除・操作のキャンセル",
      },
      switchToSelect: { keys: "V", description: "選択モードに切り替え" },
      switchToPan: { keys: "H", description: "移動（パン）モードに切り替え" },
      tempPan: {
        keys: "Space 長押し",
        description: "一時的にパンモードで操作",
      },
      zoomIn: { keys: "Ctrl/⌘+「+」", description: "ズームイン" },
      zoomOut: { keys: "Ctrl/⌘+「−」", description: "ズームアウト" },
      save: { keys: "Ctrl/⌘+S", description: "保存" },
      openShortcuts: {
        keys: "?、F1",
        description: "このショートカット一覧を開く",
      },
    },
  },
  scenarios: {
    selectAriaLabel: "サンプルデータのシナリオ",
    nameAriaLabel: "シナリオ名",
    add: "追加",
    duplicate: "複製",
    remove: "削除",
  },
  sampleData: {
    label: "サンプルデータ (JSON)",
    generate: "bind キーから生成",
  },
  dialog: {
    close: "閉じる",
  },
};

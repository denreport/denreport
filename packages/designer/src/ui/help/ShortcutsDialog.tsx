import type { ReactNode } from "react";
import { Dialog } from "../dialog/Dialog";

interface ShortcutItem {
  readonly keys: string;
  readonly description: string;
}

interface ShortcutGroup {
  readonly heading: string;
  readonly items: readonly ShortcutItem[];
}

const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    heading: "編集",
    items: [
      { keys: "Ctrl/⌘+Z", description: "元に戻す" },
      { keys: "Ctrl/⌘+Shift+Z、Ctrl/⌘+Y", description: "やり直す" },
      { keys: "Ctrl/⌘+C", description: "コピー" },
      { keys: "Ctrl/⌘+X", description: "切り取り" },
      { keys: "Ctrl/⌘+V", description: "貼り付け" },
      { keys: "Ctrl/⌘+D", description: "複製" },
      { keys: "Ctrl/⌘+G", description: "グループ化" },
      { keys: "Ctrl/⌘+Shift+G", description: "グループ解除" },
      { keys: "Delete、Backspace", description: "選択要素を削除" },
    ],
  },
  {
    heading: "選択・移動",
    items: [
      { keys: "Ctrl/⌘+A", description: "すべての要素を選択" },
      {
        keys: "矢印キー",
        description:
          "選択要素を移動（スナップ有効時5mm、無効時1mm、Shift併用で0.1mm）",
      },
      { keys: "Escape", description: "選択解除・操作のキャンセル" },
      { keys: "V", description: "選択モードに切り替え" },
      { keys: "H", description: "移動（パン）モードに切り替え" },
      { keys: "Space 長押し", description: "一時的にパンモードで操作" },
    ],
  },
  {
    heading: "表示",
    items: [
      { keys: "Ctrl/⌘+「+」", description: "ズームイン" },
      { keys: "Ctrl/⌘+「−」", description: "ズームアウト" },
    ],
  },
  {
    heading: "ファイル",
    items: [{ keys: "Ctrl/⌘+S", description: "保存" }],
  },
  {
    heading: "ヘルプ",
    items: [{ keys: "?、F1", description: "このショートカット一覧を開く" }],
  },
];

export function ShortcutsDialog(props: {
  readonly onClose: () => void;
}): ReactNode {
  const { onClose } = props;
  return (
    <Dialog
      title="キーボードショートカット"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={onClose}
        >
          閉じる
        </button>
      }
    >
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.heading} className="apx-shortcuts-group">
          <h3 className="apx-shortcuts-h">{group.heading}</h3>
          <table className="apx-shortcuts-table">
            <tbody>
              {group.items.map((item) => (
                <tr key={item.keys}>
                  <td className="apx-shortcuts-keys">{item.keys}</td>
                  <td>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </Dialog>
  );
}

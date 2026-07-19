import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import type { Messages } from "../../i18n/messages";
import { Dialog } from "../dialog/Dialog";

interface ShortcutItem {
  readonly keys: string;
  readonly description: string;
}

interface ShortcutGroup {
  readonly heading: string;
  readonly items: readonly ShortcutItem[];
}

function shortcutGroups(m: Messages["shortcuts"]): readonly ShortcutGroup[] {
  return [
    {
      heading: m.groups.edit,
      items: [
        { keys: "Ctrl/⌘+Z", description: m.items.undo },
        { keys: "Ctrl/⌘+Shift+Z、Ctrl/⌘+Y", description: m.items.redo },
        { keys: "Ctrl/⌘+C", description: m.items.copy },
        { keys: "Ctrl/⌘+X", description: m.items.cut },
        { keys: "Ctrl/⌘+V", description: m.items.paste },
        { keys: "Ctrl/⌘+D", description: m.items.duplicate },
        { keys: "Ctrl/⌘+G", description: m.items.group },
        { keys: "Ctrl/⌘+Shift+G", description: m.items.ungroup },
        { keys: "Delete、Backspace", description: m.items.deleteSelection },
      ],
    },
    {
      heading: m.groups.selectMove,
      items: [
        { keys: "Ctrl/⌘+A", description: m.items.selectAll },
        { keys: "矢印キー", description: m.items.moveSelection },
        { keys: "Escape", description: m.items.deselectOrCancel },
        { keys: "V", description: m.items.switchToSelect },
        { keys: "H", description: m.items.switchToPan },
        { keys: "Space 長押し", description: m.items.tempPan },
      ],
    },
    {
      heading: m.groups.view,
      items: [
        { keys: "Ctrl/⌘+「+」", description: m.items.zoomIn },
        { keys: "Ctrl/⌘+「−」", description: m.items.zoomOut },
      ],
    },
    {
      heading: m.groups.file,
      items: [{ keys: "Ctrl/⌘+S", description: m.items.save }],
    },
    {
      heading: m.groups.help,
      items: [{ keys: "?、F1", description: m.items.openShortcuts }],
    },
  ];
}

export function ShortcutsDialog(props: {
  readonly onClose: () => void;
}): ReactNode {
  const { onClose } = props;
  const messages = useMessages();
  const m = messages.shortcuts;
  return (
    <Dialog
      title={m.title}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="apx-btn apx-btn-secondary"
          onClick={onClose}
        >
          {messages.dialog.close}
        </button>
      }
    >
      {shortcutGroups(m).map((group) => (
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

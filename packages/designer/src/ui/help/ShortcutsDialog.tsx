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
        m.items.undo,
        m.items.redo,
        m.items.copy,
        m.items.cut,
        m.items.paste,
        m.items.duplicate,
        m.items.group,
        m.items.ungroup,
        m.items.deleteSelection,
      ],
    },
    {
      heading: m.groups.selectMove,
      items: [
        m.items.selectAll,
        m.items.moveSelection,
        m.items.deselectOrCancel,
        m.items.switchToSelect,
        m.items.switchToPan,
        m.items.tempPan,
      ],
    },
    {
      heading: m.groups.view,
      items: [m.items.zoomIn, m.items.zoomOut],
    },
    {
      heading: m.groups.file,
      items: [m.items.save],
    },
    {
      heading: m.groups.help,
      items: [m.items.openShortcuts],
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

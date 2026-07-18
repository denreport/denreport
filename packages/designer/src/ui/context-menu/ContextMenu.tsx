import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasMenuAction, CanvasMenuItem } from "./menu-items";
import { clampMenuPosition } from "./position";

export function ContextMenu(props: {
  /** 右クリック位置（viewport 座標 px）。表示時に clampMenuPosition で補正する */
  readonly x: number;
  readonly y: number;
  readonly items: readonly CanvasMenuItem[];
  readonly onAction: (action: CanvasMenuAction) => void;
  readonly onClose: () => void;
}): ReactNode {
  const { x, y, items, onAction, onClose } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState({ x, y });
  const [visible, setVisible] = useState(false);

  // 初回は渡された座標で非表示描画し、実測サイズが分かってからクランプ位置を確定する
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) {
      return;
    }
    setPos(
      clampMenuPosition({
        x,
        y,
        menuWidth: menu.offsetWidth,
        menuHeight: menu.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    );
    setVisible(true);
  }, [x, y]);

  // visible が確定する前は visibility: hidden のため、その間の focus() はブラウザに無視される
  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);
    const target =
      firstEnabledIndex === -1
        ? menuRef.current
        : itemRefs.current[firstEnabledIndex];
    target?.focus();
  }, [visible, items]);

  useEffect(() => {
    const onPointerDownOutside = (e: PointerEvent): void => {
      const menu = menuRef.current;
      if (menu !== null && !menu.contains(e.target as Node)) {
        onClose();
      }
    };
    const onScroll = (): void => {
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDownOutside, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  function currentIndex(): number {
    return itemRefs.current.indexOf(
      document.activeElement as HTMLButtonElement | null,
    );
  }

  function focusIndex(index: number): void {
    const count = items.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  }

  function activateIndex(index: number): void {
    const item = items[index];
    if (item === undefined || item.disabled) {
      return;
    }
    onAction(item.action);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    e.stopPropagation();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusIndex(currentIndex() + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusIndex(currentIndex() - 1);
        break;
      case "Home":
        e.preventDefault();
        focusIndex(0);
        break;
      case "End":
        e.preventDefault();
        focusIndex(items.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activateIndex(currentIndex());
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab":
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={menuRef}
      className="apx-context-menu"
      role="menu"
      tabIndex={-1}
      style={{
        left: pos.x,
        top: pos.y,
        visibility: visible ? "visible" : "hidden",
      }}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.action}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          className={`apx-context-menu-item${item.disabled ? " disabled" : ""}`}
          aria-disabled={item.disabled}
          tabIndex={-1}
          onClick={() => activateIndex(index)}
        >
          <span className="apx-context-menu-label">{item.label}</span>
          {item.shortcut !== null && (
            <span className="apx-context-menu-shortcut">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}

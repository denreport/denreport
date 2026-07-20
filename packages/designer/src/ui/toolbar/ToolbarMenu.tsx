import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampMenuPosition } from "../context-menu/position";

export interface ToolbarMenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
}

export function ToolbarMenu(props: {
  /** Trigger button position (viewport coordinates, px). Corrected via clampMenuPosition at display time */
  readonly x: number;
  readonly y: number;
  readonly items: readonly ToolbarMenuItem[];
  readonly onClose: () => void;
  /** The button that opens/closes this menu. Its own pointerdown is excluded from outside-click detection so the trigger's click handler stays the sole authority on toggling */
  readonly anchorEl: HTMLElement | null;
}): ReactNode {
  const { x, y, items, onClose, anchorEl } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState({ x, y });
  const [visible, setVisible] = useState(false);

  // On the first render, draw hidden at the given coordinates, then fix the clamped position once the measured size is known
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

  // Before visible is set, visibility: hidden is in effect, so focus() calls during that time are ignored by the browser
  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    itemRefs.current[0]?.focus();
  }, [visible]);

  useEffect(() => {
    const onPointerDownOutside = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) === true) {
        return;
      }
      if (anchorEl?.contains(target) === true) {
        return;
      }
      onClose();
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
  }, [onClose, anchorEl]);

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

  function selectIndex(index: number): void {
    const item = items[index];
    if (item === undefined) {
      return;
    }
    item.onSelect();
    onClose();
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
        selectIndex(currentIndex());
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
      className="dr-context-menu"
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
          key={item.id}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          className="dr-context-menu-item"
          tabIndex={-1}
          onClick={() => selectIndex(index)}
        >
          <span className="dr-context-menu-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

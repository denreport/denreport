import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvelopePreset } from "../../state/envelope-presets";
import type { CustomGuide } from "../../state/guides";
import { GuidesLayer } from "./GuidesLayer";
import type { GuideDragApi } from "./useGuideDrag";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function noopDrag(overrides: Partial<GuideDragApi> = {}): GuideDragApi {
  return {
    startFromRuler: vi.fn(),
    startFromGuide: vi.fn(),
    draggingId: null,
    ...overrides,
  };
}

const ENVELOPE: EnvelopePreset = {
  id: "l3-w80h45",
  windowBox: { x: 7.5, y: 11.5, w: 80, h: 45 },
  safeBox: { x: 12.5, y: 16.5, w: 70, h: 35 },
};

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function render(props: {
  readonly guides: readonly CustomGuide[];
  readonly envelopePreset: EnvelopePreset | null;
  readonly drag: GuideDragApi;
  readonly onPaperPointerDown?: () => void;
}): void {
  const { onPaperPointerDown, ...rest } = props;
  act(() => {
    root.render(
      (
        <div onPointerDown={onPaperPointerDown}>
          <GuidesLayer {...rest} />
        </div>
      ) as ReactNode,
    );
  });
}

describe("GuidesLayer のガイド描画", () => {
  it("axis ごとに dr-cguide-v / dr-cguide-h を描画する", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 30 },
      { id: "guide2", axis: "y", positionMm: 50 },
    ];
    render({ guides, envelopePreset: null, drag: noopDrag() });

    const vertical = container.querySelector(".dr-cguide-v");
    const horizontal = container.querySelector(".dr-cguide-h");
    expect(vertical).not.toBeNull();
    expect(horizontal).not.toBeNull();
    expect((vertical as HTMLElement).style.getPropertyValue("--gx")).toBe("30");
    expect((horizontal as HTMLElement).style.getPropertyValue("--gy")).toBe(
      "50",
    );
  });

  it("掴みハンドルの pointerdown が startFromGuide に届き、親要素へ伝播しない", () => {
    const guides: readonly CustomGuide[] = [
      { id: "guide1", axis: "x", positionMm: 30 },
    ];
    const drag = noopDrag();
    let bubbled = false;
    render({
      guides,
      envelopePreset: null,
      drag,
      onPaperPointerDown: () => {
        bubbled = true;
      },
    });

    const hit = container.querySelector(".dr-cguide-hit");
    if (hit === null) {
      throw new Error("hit ハンドルが見つからない");
    }
    act(() => {
      hit.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });

    expect(drag.startFromGuide).toHaveBeenCalledWith(
      "guide1",
      "x",
      expect.anything(),
    );
    expect(bubbled).toBe(false);
  });
});

describe("GuidesLayer の封筒プリセット", () => {
  it("envelopePreset が null なら封筒枠を描かない", () => {
    render({ guides: [], envelopePreset: null, drag: noopDrag() });
    expect(container.querySelector(".dr-env-window")).toBeNull();
    expect(container.querySelector(".dr-env-safe")).toBeNull();
  });

  it("envelopePreset があれば windowBox / safeBox を描く", () => {
    render({ guides: [], envelopePreset: ENVELOPE, drag: noopDrag() });
    const windowEl = container.querySelector(".dr-env-window");
    const safeEl = container.querySelector(".dr-env-safe");
    expect(windowEl).not.toBeNull();
    expect(safeEl).not.toBeNull();
    expect((windowEl as HTMLElement).style.getPropertyValue("--w")).toBe("80");
    expect((safeEl as HTMLElement).style.getPropertyValue("--w")).toBe("70");
  });
});

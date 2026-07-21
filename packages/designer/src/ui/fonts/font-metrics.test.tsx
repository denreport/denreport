import type { IrFont } from "@denreport/core";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
  EMBEDDED_FONT_URL,
} from "@denreport/targets";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisteredFont } from "../../state/fonts";
import type { FontMetricsSet } from "./font-metrics";
import { charWidthsFor, useFontMetrics } from "./font-metrics";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// A minimal sfnt that readCharWidths can read (only head.unitsPerEm, hhea.numberOfHMetrics,
// one hmtx entry, and an empty cmap format4 subtable have real values; same layout as preview-font.test.ts)
function sfntWith(unitsPerEm: number): Uint8Array {
  const headOffset = 12 + 4 * 16;
  const headLength = 20;
  const hheaOffset = headOffset + headLength;
  const hheaLength = 36;
  const hmtxOffset = hheaOffset + hheaLength;
  const hmtxLength = 4;
  const cmapOffset = hmtxOffset + hmtxLength;
  const cmapSubtableLength = 24; // format4, segCount=1 (terminal segment only)
  const cmapLength = 12 + cmapSubtableLength;
  const bytes = new Uint8Array(cmapOffset + cmapLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 4);
  view.setUint32(12, 0x68656164); // 'head'
  view.setUint32(12 + 8, headOffset);
  view.setUint32(12 + 12, headLength);
  view.setUint32(28, 0x68686561); // 'hhea'
  view.setUint32(28 + 8, hheaOffset);
  view.setUint32(28 + 12, hheaLength);
  view.setUint32(44, 0x686d7478); // 'hmtx'
  view.setUint32(44 + 8, hmtxOffset);
  view.setUint32(44 + 12, hmtxLength);
  view.setUint32(60, 0x636d6170); // 'cmap'
  view.setUint32(60 + 8, cmapOffset);
  view.setUint32(60 + 12, cmapLength);

  view.setUint16(headOffset + 18, unitsPerEm);
  view.setUint16(hheaOffset + 34, 1); // numberOfHMetrics

  view.setUint16(hmtxOffset, 500); // advanceWidth
  view.setInt16(hmtxOffset + 2, 0); // lsb

  view.setUint16(cmapOffset + 2, 1); // numTables
  view.setUint16(cmapOffset + 4, 3); // platformId
  view.setUint16(cmapOffset + 6, 1); // encodingId
  view.setUint32(cmapOffset + 8, 12); // subtable offset (relative to the start of cmap)
  const subtableAbs = cmapOffset + 12;
  view.setUint16(subtableAbs, 4); // format
  view.setUint16(subtableAbs + 2, cmapSubtableLength);
  view.setUint16(subtableAbs + 6, 2); // segCountX2 (segCount=1)
  view.setUint16(subtableAbs + 14, 0xffff); // endCode[0]
  view.setUint16(subtableAbs + 18, 0xffff); // startCode[0]
  view.setInt16(subtableAbs + 20, 1); // idDelta[0]
  return bytes;
}

describe("charWidthsFor", () => {
  const REGULAR_ONLY: FontMetricsSet = { regular: () => 0.1 };
  const WITH_BOLD: FontMetricsSet = { regular: () => 0.1, bold: () => 0.2 };
  const FULL: FontMetricsSet = {
    regular: () => 0.1,
    bold: () => 0.2,
    italic: () => 0.3,
    boldItalic: () => 0.4,
  };

  it("falls back to regular even with bold/italic specified when only regular is in the set", () => {
    expect(charWidthsFor(REGULAR_ONLY, "bold", "italic")).toBe(
      REGULAR_ONLY.regular,
    );
  });

  it("returns bold when bold is specified and the set has bold", () => {
    expect(charWidthsFor(WITH_BOLD, "bold", "normal")).toBe(WITH_BOLD.bold);
  });

  it("resolves in the fallback order boldItalic → italic → bold → regular", () => {
    expect(charWidthsFor(FULL, "bold", "italic")).toBe(FULL.boldItalic);
    expect(charWidthsFor(WITH_BOLD, "bold", "italic")).toBe(WITH_BOLD.bold);
    expect(charWidthsFor(REGULAR_ONLY, "bold", "italic")).toBe(
      REGULAR_ONLY.regular,
    );
  });
});

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
  vi.unstubAllGlobals();
});

function Probe(props: {
  readonly font: IrFont;
  readonly registry: ReadonlyMap<string, RegisteredFont>;
}): ReactNode {
  const metrics = useFontMetrics(props.font, props.registry);
  return (
    <div data-testid="probe">
      {metrics === null ? "null" : String(metrics.regular(0x41))}
    </div>
  );
}

function probeText(): string {
  return container.querySelector('[data-testid="probe"]')?.textContent ?? "";
}

const EMPTY_REGISTRY: ReadonlyMap<string, RegisteredFont> = new Map();

describe("useFontMetrics — bundled font", () => {
  it("resolves char widths from a fetched TTF, and does not refetch on remount with the same URL", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        arrayBuffer: async () => sfntWith(1000).buffer,
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <Probe
          font={{ regular: EMBEDDED_FONT_NAME }}
          registry={EMPTY_REGISTRY}
        />,
      );
    });
    await vi.waitFor(() => {
      expect(probeText()).toBe("0.5");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(EMBEDDED_FONT_URL);

    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <Probe
          font={{ regular: EMBEDDED_FONT_NAME }}
          registry={EMPTY_REGISTRY}
        />,
      );
    });
    await vi.waitFor(() => {
      expect(probeText()).toBe("0.5");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays null on fetch failure without leaking an unhandled rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ネットワーク不通"))),
    );

    await act(async () => {
      root.render(
        <Probe
          font={{ regular: EMBEDDED_BOLD_FONT_NAME }}
          registry={EMPTY_REGISTRY}
        />,
      );
    });
    await act(async () => {});
    await act(async () => {});
    expect(probeText()).toBe("null");
  });
});

describe("useFontMetrics — registered font", () => {
  it("resolves a font from fontRegistry without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const registry = new Map<string, RegisteredFont>([
      [
        "MyLocalFont",
        {
          name: "MyLocalFont",
          displayName: "My Local Font",
          data: sfntWith(2000),
          ascentPerEm: 0.9,
        },
      ],
    ]);

    await act(async () => {
      root.render(
        <Probe font={{ regular: "MyLocalFont" }} registry={registry} />,
      );
    });
    await vi.waitFor(() => {
      expect(probeText()).toBe("0.25");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

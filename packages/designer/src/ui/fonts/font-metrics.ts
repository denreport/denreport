import type {
  CharWidthEm,
  IrFont,
  IrFontStyle,
  IrFontWeight,
} from "@denreport/core";
import { resolveFontSlot } from "@denreport/core";
import {
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_BOLD_FONT_URL,
  EMBEDDED_FONT_NAME,
  EMBEDDED_FONT_URL,
  readCharWidths,
} from "@denreport/targets";
import { useEffect, useState } from "react";
import type { FontResolution, RegisteredFont } from "../../state/fonts";
import { resolveFontSet } from "../../state/fonts";

/** A set of per-slot char-width functions. regular is required */
export interface FontMetricsSet {
  readonly regular: CharWidthEm;
  readonly bold?: CharWidthEm;
  readonly italic?: CharWidthEm;
  readonly boldItalic?: CharWidthEm;
}

const EMBEDDED_NAMES: ReadonlySet<string> = new Set([
  EMBEDDED_FONT_NAME,
  EMBEDDED_BOLD_FONT_NAME,
]);

const EMBEDDED_METRICS_URLS: Readonly<Record<string, URL>> = {
  [EMBEDDED_FONT_NAME]: EMBEDDED_FONT_URL,
  [EMBEDDED_BOLD_FONT_NAME]: EMBEDDED_BOLD_FONT_URL,
};

/** Resolves an element's weight/style down to a slot using core's degradation rules and returns the char-width function */
export function charWidthsFor(
  set: FontMetricsSet,
  fontWeight: IrFontWeight = "normal",
  fontStyle: IrFontStyle = "normal",
): CharWidthEm {
  const pseudo: IrFont = {
    regular: "regular",
    ...(set.bold !== undefined ? { bold: "bold" } : {}),
    ...(set.italic !== undefined ? { italic: "italic" } : {}),
    ...(set.boldItalic !== undefined ? { boldItalic: "boldItalic" } : {}),
  };
  return set[resolveFontSlot(pseudo, fontWeight, fontStyle)] ?? set.regular;
}

const embeddedCache = new Map<string, Promise<CharWidthEm>>();

function loadEmbeddedWidths(url: URL): Promise<CharWidthEm> {
  const hit = embeddedCache.get(url.href);
  if (hit !== undefined) {
    return hit;
  }
  const promise = fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error(`フォント取得失敗 (HTTP ${res.status})`);
    }
    const widths = readCharWidths(new Uint8Array(await res.arrayBuffer()));
    if (widths === null) {
      throw new Error("字幅を読み取れません");
    }
    return widths;
  });
  // Don't let a transient network failure become permanent
  promise.catch(() => {
    embeddedCache.delete(url.href);
  });
  embeddedCache.set(url.href, promise);
  return promise;
}

const registeredWidthsCache = new WeakMap<Uint8Array, CharWidthEm | null>();

function widthsOfRegistered(font: RegisteredFont): CharWidthEm | null {
  const hit = registeredWidthsCache.get(font.data);
  if (hit !== undefined) {
    return hit;
  }
  const widths = readCharWidths(font.data);
  registeredWidthsCache.set(font.data, widths);
  return widths;
}

function embeddedUrlFor(name: string): URL {
  return EMBEDDED_METRICS_URLS[name] ?? EMBEDDED_FONT_URL;
}

/** Turns a single resolveFontSet resolution result into a Promise of a char-width function.
    missing and unknown bundled names fall back to the bundled regular, and unreadable metrics
    for registered fonts also fall back to the bundled regular */
function loadResolutionWidths(
  resolution: FontResolution,
): Promise<CharWidthEm> {
  if (resolution.kind === "registered") {
    const widths = widthsOfRegistered(resolution.font);
    if (widths !== null) {
      return Promise.resolve(widths);
    }
    return loadEmbeddedWidths(EMBEDDED_FONT_URL);
  }
  return loadEmbeddedWidths(embeddedUrlFor(resolution.name));
}

/** Resolves the document's font declaration into a set of char-width functions. null while
    fetching or on failure (the caller falls back to the current rendering) */
export function useFontMetrics(
  font: IrFont,
  registry: ReadonlyMap<string, RegisteredFont>,
): FontMetricsSet | null {
  const [metrics, setMetrics] = useState<FontMetricsSet | null>(null);

  const resolutions = resolveFontSet(font, registry, EMBEDDED_NAMES);
  const resolutionKey = [...resolutions.entries()]
    .map(([slot, resolution]) =>
      resolution.kind === "registered"
        ? `${slot}:registered:${resolution.font.name}`
        : `${slot}:${resolution.kind}:${resolution.name}`,
    )
    .join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolutionKey represents changes to the resolution result
  useEffect(() => {
    let cancelled = false;
    const entries = [...resolutions.entries()];
    Promise.all(
      entries.map(([slot, resolution]) =>
        loadResolutionWidths(resolution).then(
          (widths) => [slot, widths] as const,
        ),
      ),
    ).then(
      (loaded) => {
        if (cancelled) {
          return;
        }
        const bySlot = new Map(loaded);
        const regular = bySlot.get("regular");
        if (regular === undefined) {
          setMetrics(null);
          return;
        }
        const bold = bySlot.get("bold");
        const italic = bySlot.get("italic");
        const boldItalic = bySlot.get("boldItalic");
        setMetrics({
          regular,
          ...(bold !== undefined ? { bold } : {}),
          ...(italic !== undefined ? { italic } : {}),
          ...(boldItalic !== undefined ? { boldItalic } : {}),
        });
      },
      () => {
        // Don't let a fetch rejection leak as unhandled. While waiting for it to arrive, defer to the caller's fallback display
        if (!cancelled) {
          setMetrics(null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resolutionKey]);

  return metrics;
}

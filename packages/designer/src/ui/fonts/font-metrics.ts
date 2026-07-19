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

/** スロット別の字幅関数の組。regular は必須 */
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

/** 要素の weight/style を core の劣化規則でスロットに落として字幅関数を返す */
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
  // 一時的なネットワーク失敗を固定化しない
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

/** resolveFontSet の解決結果1件を字幅関数の Promise にする。missing・未知の同梱名は
    同梱 regular で代替し、registered の計量読取不能も同梱 regular へフォールバックする */
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

/** 文書のフォント宣言を字幅関数の組に解決する。フォント取得中・失敗中は null（呼び出し側は
    現行描画にフォールバックする） */
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: resolutionKey が解決結果の変化を代表する
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
        // fetch reject を未処理のまま漏らさない。到着待ちの間は呼び出し側のフォールバック表示に任せる
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

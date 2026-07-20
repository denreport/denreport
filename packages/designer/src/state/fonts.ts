import type { IrFont, IrFontSlot } from "@denreport/core";

// The identifier pattern for IR font logical names (identical to core's IDENTIFIER_PATTERN /
// IDENTIFIER_MAX_LENGTH) must be satisfied here too, but the constant isn't exported from
// core, so it's duplicated here.
const IDENTIFIER_MAX_LENGTH = 64;

export interface RegisteredFont {
  /** IR identifier (the matching key against a font's logical name; the output of sanitizeFontName) */
  readonly name: string;
  /** Original name for UI display (FontData.fullName) */
  readonly displayName: string;
  readonly data: Uint8Array;
  /** The value of readAscentPerEm(data) (input to the preview's normative formula) */
  readonly ascentPerEm: number;
}

/** Reduces a font name to an IR identifier (^[A-Za-z_][A-Za-z0-9_]*$, 64 characters or fewer).
    Non-matching characters are stripped, a leading digit gets a "_" prefix, an empty result
    becomes "LocalFont", and the result is truncated to 64 characters */
export function sanitizeFontName(raw: string): string {
  let out = raw.replace(/[^A-Za-z0-9_]/g, "");
  if (/^[0-9]/.test(out)) {
    out = `_${out}`;
  }
  if (out === "") {
    out = "LocalFont";
  }
  return out.slice(0, IDENTIFIER_MAX_LENGTH);
}

export type FontResolution =
  | { readonly kind: "embedded"; readonly name: string }
  | { readonly kind: "registered"; readonly font: RegisteredFont }
  | { readonly kind: "missing"; readonly name: string };

/** The single definition point for resolving a logical name to actual data. Priority order:
    registry -> bundled name -> missing.
    embeddedNames is passed by the caller (the ui layer) as EMBEDDED_*_FONT_NAME
    (since state doesn't depend on targets) */
export function resolveFont(
  name: string,
  registry: ReadonlyMap<string, RegisteredFont>,
  embeddedNames: ReadonlySet<string>,
): FontResolution {
  const font = registry.get(name);
  if (font !== undefined) {
    return { kind: "registered", font };
  }
  if (embeddedNames.has(name)) {
    return { kind: "embedded", name };
  }
  return { kind: "missing", name };
}

const FONT_SLOTS: readonly IrFontSlot[] = [
  "regular",
  "bold",
  "italic",
  "boldItalic",
];

/** Resolves all of a document's declared slots at once (undeclared slots get no entry) */
export function resolveFontSet(
  font: IrFont,
  registry: ReadonlyMap<string, RegisteredFont>,
  embeddedNames: ReadonlySet<string>,
): ReadonlyMap<IrFontSlot, FontResolution> {
  const resolutions = new Map<IrFontSlot, FontResolution>();
  for (const slot of FONT_SLOTS) {
    const name = font[slot];
    if (name === undefined) continue;
    resolutions.set(slot, resolveFont(name, registry, embeddedNames));
  }
  return resolutions;
}

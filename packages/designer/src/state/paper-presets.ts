export type PaperPresetId =
  | "a3"
  | "a4"
  | "a5"
  | "b4jis"
  | "b5jis"
  | "b5iso"
  | "postcard"
  | "letter"
  | "legal";

export interface PaperPreset {
  readonly id: PaperPresetId;
  readonly width: number;
  readonly height: number;
}

const JA_PRESETS: readonly PaperPreset[] = [
  { id: "a3", width: 297, height: 420 },
  { id: "a4", width: 210, height: 297 },
  { id: "a5", width: 148, height: 210 },
  { id: "b4jis", width: 257, height: 364 },
  { id: "b5jis", width: 182, height: 257 },
  { id: "postcard", width: 100, height: 148 },
  { id: "letter", width: 215.9, height: 279.4 },
];

const INTL_PRESETS: readonly PaperPreset[] = [
  { id: "a3", width: 297, height: 420 },
  { id: "a4", width: 210, height: 297 },
  { id: "a5", width: 148, height: 210 },
  { id: "b5iso", width: 176, height: 250 },
  { id: "letter", width: 215.9, height: 279.4 },
  { id: "legal", width: 215.9, height: 355.6 },
];

/** Returns the preset list for the UI language (BCP 47 language tag). Only Japanese gets its own set; all others share the English-locale set */
export function paperPresetsForLanguage(
  language: string,
): readonly PaperPreset[] {
  return language.toLowerCase().startsWith("ja") ? JA_PRESETS : INTL_PRESETS;
}

/** The id of the preset matching width and height. undefined if there's no match (the caller uses this to show "Custom") */
export function paperPresetIdForSize(
  presets: readonly PaperPreset[],
  width: number,
  height: number,
): PaperPresetId | undefined {
  return presets.find((p) => p.width === width && p.height === height)?.id;
}

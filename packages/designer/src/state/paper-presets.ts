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
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

const JA_PRESETS: readonly PaperPreset[] = [
  { id: "a3", label: "A3", width: 297, height: 420 },
  { id: "a4", label: "A4", width: 210, height: 297 },
  { id: "a5", label: "A5", width: 148, height: 210 },
  { id: "b4jis", label: "B4", width: 257, height: 364 },
  { id: "b5jis", label: "B5", width: 182, height: 257 },
  { id: "postcard", label: "はがき", width: 100, height: 148 },
  { id: "letter", label: "レター", width: 215.9, height: 279.4 },
];

const INTL_PRESETS: readonly PaperPreset[] = [
  { id: "a3", label: "A3", width: 297, height: 420 },
  { id: "a4", label: "A4", width: 210, height: 297 },
  { id: "a5", label: "A5", width: 148, height: 210 },
  { id: "b5iso", label: "B5", width: 176, height: 250 },
  { id: "letter", label: "Letter", width: 215.9, height: 279.4 },
  { id: "legal", label: "Legal", width: 215.9, height: 355.6 },
];

/** UI 言語（BCP 47 言語タグ）に応じたプリセット一覧を返す。日本語のみ専用セット、他は英語圏セット共通 */
export function paperPresetsForLanguage(
  language: string,
): readonly PaperPreset[] {
  return language.toLowerCase().startsWith("ja") ? JA_PRESETS : INTL_PRESETS;
}

/** 幅・高さに一致するプリセットの id。一致なしは undefined（呼び出し側で「カスタム」表示に使う） */
export function paperPresetIdForSize(
  presets: readonly PaperPreset[],
  width: number,
  height: number,
): PaperPresetId | undefined {
  return presets.find((p) => p.width === width && p.height === height)?.id;
}

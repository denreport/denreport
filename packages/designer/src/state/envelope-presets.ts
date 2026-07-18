import type { MmBox } from "./geometry";

export type EnvelopePresetId =
  | "l3-w80h45"
  | "l3-w90h45"
  | "l3-w100h45"
  | "l3-w80h55"
  | "l3-w90h55"
  | "l3-w100h55";

export interface EnvelopePreset {
  readonly id: EnvelopePresetId;
  readonly label: string;
  /** ページ座標での窓外形 */
  readonly windowBox: MmBox;
  /** 配置可能領域（windowBox の内側） */
  readonly safeBox: MmBox;
}

const PRESETS_BY_ID: Record<EnvelopePresetId, EnvelopePreset> = {
  "l3-w80h45": {
    id: "l3-w80h45",
    label: "長3・窓 80×45",
    windowBox: { x: 7.5, y: 11.5, w: 80, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 70, h: 35 },
  },
  "l3-w90h45": {
    id: "l3-w90h45",
    label: "長3・窓 90×45",
    windowBox: { x: 7.5, y: 11.5, w: 90, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 80, h: 35 },
  },
  "l3-w100h45": {
    id: "l3-w100h45",
    label: "長3・窓 100×45",
    windowBox: { x: 7.5, y: 11.5, w: 100, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 90, h: 35 },
  },
  "l3-w80h55": {
    id: "l3-w80h55",
    label: "長3・窓 80×55",
    windowBox: { x: 7.5, y: 11.5, w: 80, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 70, h: 45 },
  },
  "l3-w90h55": {
    id: "l3-w90h55",
    label: "長3・窓 90×55",
    windowBox: { x: 7.5, y: 11.5, w: 90, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 80, h: 45 },
  },
  "l3-w100h55": {
    id: "l3-w100h55",
    label: "長3・窓 100×55",
    windowBox: { x: 7.5, y: 11.5, w: 100, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 90, h: 45 },
  },
};

export const ENVELOPE_PRESETS: readonly EnvelopePreset[] =
  Object.values(PRESETS_BY_ID);

export function envelopePresetById(id: EnvelopePresetId): EnvelopePreset {
  return PRESETS_BY_ID[id];
}

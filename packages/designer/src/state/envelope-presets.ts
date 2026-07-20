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
  /** The window's outer shape in page coordinates */
  readonly windowBox: MmBox;
  /** The placeable area (inside windowBox) */
  readonly safeBox: MmBox;
}

const PRESETS_BY_ID: Record<EnvelopePresetId, EnvelopePreset> = {
  "l3-w80h45": {
    id: "l3-w80h45",
    windowBox: { x: 7.5, y: 11.5, w: 80, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 70, h: 35 },
  },
  "l3-w90h45": {
    id: "l3-w90h45",
    windowBox: { x: 7.5, y: 11.5, w: 90, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 80, h: 35 },
  },
  "l3-w100h45": {
    id: "l3-w100h45",
    windowBox: { x: 7.5, y: 11.5, w: 100, h: 45 },
    safeBox: { x: 12.5, y: 16.5, w: 90, h: 35 },
  },
  "l3-w80h55": {
    id: "l3-w80h55",
    windowBox: { x: 7.5, y: 11.5, w: 80, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 70, h: 45 },
  },
  "l3-w90h55": {
    id: "l3-w90h55",
    windowBox: { x: 7.5, y: 11.5, w: 90, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 80, h: 45 },
  },
  "l3-w100h55": {
    id: "l3-w100h55",
    windowBox: { x: 7.5, y: 11.5, w: 100, h: 55 },
    safeBox: { x: 12.5, y: 16.5, w: 90, h: 45 },
  },
};

export const ENVELOPE_PRESETS: readonly EnvelopePreset[] =
  Object.values(PRESETS_BY_ID);

export function envelopePresetById(id: EnvelopePresetId): EnvelopePreset {
  return PRESETS_BY_ID[id];
}

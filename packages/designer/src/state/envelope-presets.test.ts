import { describe, expect, it } from "vitest";
import { ENVELOPE_PRESETS, envelopePresetById } from "./envelope-presets";

describe("ENVELOPE_PRESETS", () => {
  it("6件あり、80/90/100 × 45/55 の組み合わせと一致する", () => {
    expect(ENVELOPE_PRESETS).toHaveLength(6);
    const dims = ENVELOPE_PRESETS.map((p) => [p.windowBox.w, p.windowBox.h]);
    expect(dims).toEqual(
      expect.arrayContaining([
        [80, 45],
        [90, 45],
        [100, 45],
        [80, 55],
        [90, 55],
        [100, 55],
      ]),
    );
  });

  it("safeBox は windowBox の内側に包含される", () => {
    for (const preset of ENVELOPE_PRESETS) {
      const { windowBox, safeBox } = preset;
      expect(safeBox.x).toBeGreaterThanOrEqual(windowBox.x);
      expect(safeBox.y).toBeGreaterThanOrEqual(windowBox.y);
      expect(safeBox.x + safeBox.w).toBeLessThanOrEqual(
        windowBox.x + windowBox.w,
      );
      expect(safeBox.y + safeBox.h).toBeLessThanOrEqual(
        windowBox.y + windowBox.h,
      );
    }
  });
});

describe("envelopePresetById", () => {
  it("id に対応するプリセットを返す", () => {
    expect(envelopePresetById("l3-w80h45")).toEqual({
      id: "l3-w80h45",
      windowBox: { x: 7.5, y: 11.5, w: 80, h: 45 },
      safeBox: { x: 12.5, y: 16.5, w: 70, h: 35 },
    });
  });
});

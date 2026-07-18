import { describe, expect, it } from "vitest";
import {
  CANVAS_PADDING_PX,
  MM_TO_PX,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
} from "../../state/constants";
import {
  anchoredScroll,
  fitPageZoom,
  nextWheelZoom,
  zoomStepIn,
  zoomStepOut,
} from "./zoom";

describe("fitPageZoom", () => {
  it("幅制約が厳しいときは幅比率が選ばれる", () => {
    const viewportWidth = 500;
    const viewportHeight = 2000;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 100,
    });
    const widthRatio =
      (viewportWidth - 2 * CANVAS_PADDING_PX) / (210 * MM_TO_PX);
    const heightRatio =
      (viewportHeight - 2 * CANVAS_PADDING_PX) / (100 * MM_TO_PX);
    expect(widthRatio).toBeLessThan(heightRatio);
    expect(zoom).toBeCloseTo(widthRatio, 10);
  });

  it("高さ制約が厳しいときは高さ比率が選ばれる", () => {
    const viewportWidth = 2000;
    const viewportHeight = 500;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 100,
      pageHeightMm: 297,
    });
    const widthRatio =
      (viewportWidth - 2 * CANVAS_PADDING_PX) / (100 * MM_TO_PX);
    const heightRatio =
      (viewportHeight - 2 * CANVAS_PADDING_PX) / (297 * MM_TO_PX);
    expect(heightRatio).toBeLessThan(widthRatio);
    expect(zoom).toBeCloseTo(heightRatio, 10);
  });

  it("極端に大きいビューポートでは ZOOM_MAX にクランプされる", () => {
    const zoom = fitPageZoom({
      viewportWidth: 100_000,
      viewportHeight: 100_000,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBe(ZOOM_MAX);
  });

  it("極端に小さいビューポートでは ZOOM_MIN にクランプされる", () => {
    const zoom = fitPageZoom({
      viewportWidth: 50,
      viewportHeight: 50,
      rulerWidth: 0,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBe(ZOOM_MIN);
  });

  it("可用幅が 0 以下なら null", () => {
    const zoom = fitPageZoom({
      viewportWidth: 20,
      viewportHeight: 2000,
      rulerWidth: 30,
      rulerHeight: 0,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBeNull();
  });

  it("可用高が 0 以下なら null", () => {
    const zoom = fitPageZoom({
      viewportWidth: 2000,
      viewportHeight: 20,
      rulerWidth: 0,
      rulerHeight: 30,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).toBeNull();
  });

  it("A4 縦ページが代表的ビューポートに収まる", () => {
    const viewportWidth = 1200;
    const viewportHeight = 800;
    const rulerWidth = 24;
    const rulerHeight = 24;
    const zoom = fitPageZoom({
      viewportWidth,
      viewportHeight,
      rulerWidth,
      rulerHeight,
      pageWidthMm: 210,
      pageHeightMm: 297,
    });
    expect(zoom).not.toBeNull();
    const availH = viewportHeight - rulerHeight - 2 * CANVAS_PADDING_PX;
    expect((zoom ?? 0) * 297 * MM_TO_PX).toBeLessThanOrEqual(availH);
  });
});

describe("nextWheelZoom", () => {
  it("deltaY > 0 で縮小する", () => {
    expect(nextWheelZoom(1, 100, 0)).toBeLessThan(1);
  });

  it("deltaY < 0 で拡大する", () => {
    expect(nextWheelZoom(1, -100, 0)).toBeGreaterThan(1);
  });

  it("ZOOM_MAX 到達後にさらに拡大しても変わらない", () => {
    expect(nextWheelZoom(ZOOM_MAX, -100, 0)).toBe(ZOOM_MAX);
  });

  it("ZOOM_MIN 到達後にさらに縮小しても変わらない", () => {
    expect(nextWheelZoom(ZOOM_MIN, 100, 0)).toBe(ZOOM_MIN);
  });

  it("deltaMode = 1（line）は pixel 換算より大きく効く", () => {
    const pixel = nextWheelZoom(1, 100, 0);
    const line = nextWheelZoom(1, 100, 1);
    expect(Math.abs(1 - line)).toBeGreaterThan(Math.abs(1 - pixel));
  });

  it("deltaY = 0 で恒等", () => {
    expect(nextWheelZoom(1, 0, 0)).toBe(1);
  });
});

describe("zoomStepIn / zoomStepOut", () => {
  it("段の中間値からは前後の段を返す", () => {
    expect(zoomStepIn(1.13)).toBe(1.25);
    expect(zoomStepOut(1.13)).toBe(1);
  });

  it("段ちょうどの値からは隣の段へ遷移する", () => {
    expect(zoomStepIn(1)).toBe(1.25);
    expect(zoomStepOut(1)).toBe(0.75);
  });

  it("上端では zoomStepIn が null", () => {
    expect(zoomStepIn(ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 0)).toBeNull();
  });

  it("下端では zoomStepOut が null", () => {
    expect(zoomStepOut(ZOOM_STEPS[0] ?? 0)).toBeNull();
  });
});

describe("anchoredScroll", () => {
  const base = {
    prevZoom: 1,
    nextZoom: 2,
    anchorX: 300,
    anchorY: 200,
    paperLeft: 50,
    paperTop: 40,
    scrollLeft: 100,
    scrollTop: 80,
  };

  it("アンカー直下の紙上 mm 座標を保存する", () => {
    const cases = [
      base,
      { ...base, nextZoom: 0.5 },
      { ...base, anchorX: 0, anchorY: 0 },
      { ...base, prevZoom: 2, nextZoom: 0.75, scrollLeft: 400, scrollTop: 10 },
    ];
    for (const c of cases) {
      const result = anchoredScroll(c);
      const before = (c.scrollLeft + c.anchorX - c.paperLeft) / c.prevZoom;
      const afterX = (result.left + c.anchorX - c.paperLeft) / c.nextZoom;
      const beforeY = (c.scrollTop + c.anchorY - c.paperTop) / c.prevZoom;
      const afterY = (result.top + c.anchorY - c.paperTop) / c.nextZoom;
      expect(afterX).toBeCloseTo(before, 10);
      expect(afterY).toBeCloseTo(beforeY, 10);
    }
  });

  it("prevZoom === nextZoom で恒等", () => {
    const result = anchoredScroll({ ...base, nextZoom: base.prevZoom });
    expect(result.left).toBeCloseTo(base.scrollLeft, 10);
    expect(result.top).toBeCloseTo(base.scrollTop, 10);
  });

  it("中心をアンカーにすると現行の中心維持計算と一致する", () => {
    const viewportWidth = 600;
    const viewportHeight = 400;
    const input = {
      prevZoom: 1,
      nextZoom: 1.5,
      anchorX: viewportWidth / 2,
      anchorY: viewportHeight / 2,
      paperLeft: 20,
      paperTop: 30,
      scrollLeft: 10,
      scrollTop: 5,
    };
    const result = anchoredScroll(input);

    const centerX =
      (input.scrollLeft + viewportWidth / 2 - input.paperLeft) /
      (MM_TO_PX * input.prevZoom);
    const centerY =
      (input.scrollTop + viewportHeight / 2 - input.paperTop) /
      (MM_TO_PX * input.prevZoom);
    const expectedLeft =
      centerX * MM_TO_PX * input.nextZoom + input.paperLeft - viewportWidth / 2;
    const expectedTop =
      centerY * MM_TO_PX * input.nextZoom + input.paperTop - viewportHeight / 2;

    expect(result.left).toBeCloseTo(expectedLeft, 10);
    expect(result.top).toBeCloseTo(expectedTop, 10);
  });
});

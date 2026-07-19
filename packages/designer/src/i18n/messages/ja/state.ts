import type { IrElementType } from "@denreport/core";
import type { EnvelopePresetId } from "../../../state/envelope-presets";
import type { PaperPresetId } from "../../../state/paper-presets";

export const stateJa = {
  elementTypes: {
    text: "テキスト",
    line: "直線",
    rect: "矩形",
    ellipse: "楕円",
    table: "表",
    image: "画像",
    flex: "フレックス",
    pageNumber: "ページ番号",
    barcode: "バーコード",
  } satisfies Record<IrElementType, string>,
  paperPresets: {
    a3: "A3",
    a4: "A4",
    a5: "A5",
    b4jis: "B4",
    b5jis: "B5",
    b5iso: "B5",
    postcard: "はがき",
    letter: "レター",
    legal: "リーガル",
  } satisfies Record<PaperPresetId, string>,
  envelopePresets: {
    "l3-w80h45": "長3・窓 80×45",
    "l3-w90h45": "長3・窓 90×45",
    "l3-w100h45": "長3・窓 100×45",
    "l3-w80h55": "長3・窓 80×55",
    "l3-w90h55": "長3・窓 90×55",
    "l3-w100h55": "長3・窓 100×55",
  } satisfies Record<EnvelopePresetId, string>,
  defaults: {
    text: "テキスト",
    columnName: (n: number): string => `列${n}`,
    imagePlaceholder: "画像未設定",
    scenarioName: (n: number): string => `シナリオ ${n}`,
    copyOf: (name: string): string => `${name} のコピー`,
  },
};

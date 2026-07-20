import type { IrElementType } from "@denreport/core";
import type { EnvelopePresetId } from "../../../state/envelope-presets";
import type { PaperPresetId } from "../../../state/paper-presets";

export const stateEn = {
  elementTypes: {
    text: "Text",
    line: "Line",
    rect: "Rectangle",
    ellipse: "Ellipse",
    table: "Table",
    image: "Image",
    flex: "Flex",
    pageNumber: "Page number",
    barcode: "Barcode",
  } satisfies Record<IrElementType, string>,
  textIconGlyph: "A",
  paperPresets: {
    a3: "A3",
    a4: "A4",
    a5: "A5",
    b4jis: "B4",
    b5jis: "B5",
    b5iso: "B5",
    postcard: "Postcard",
    letter: "Letter",
    legal: "Legal",
  } satisfies Record<PaperPresetId, string>,
  envelopePresets: {
    "l3-w80h45": "Chou 3 · Window 80×45",
    "l3-w90h45": "Chou 3 · Window 90×45",
    "l3-w100h45": "Chou 3 · Window 100×45",
    "l3-w80h55": "Chou 3 · Window 80×55",
    "l3-w90h55": "Chou 3 · Window 90×55",
    "l3-w100h55": "Chou 3 · Window 100×55",
  } satisfies Record<EnvelopePresetId, string>,
  sampleJson: {
    notObject:
      "The sample data is not a top-level object, so it is treated as empty data.",
    invalidJson:
      "The sample data cannot be parsed as JSON, so it is treated as empty data.",
  },
  scenarioNames: {
    nth: (n: number): string => `Scenario ${n}`,
    copyOf: (name: string): string => `${name} copy`,
  },
};

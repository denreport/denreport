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
    "l3-w80h45": "Long 3 · window 80×45",
    "l3-w90h45": "Long 3 · window 90×45",
    "l3-w100h45": "Long 3 · window 100×45",
    "l3-w80h55": "Long 3 · window 80×55",
    "l3-w90h55": "Long 3 · window 90×55",
    "l3-w100h55": "Long 3 · window 100×55",
  } satisfies Record<EnvelopePresetId, string>,
  defaults: {
    text: "Text",
    column1: "Column 1",
    column2: "Column 2",
    scenarioName: (n: number): string => `Scenario ${n}`,
    copyOf: (name: string): string => `${name} copy`,
  },
};

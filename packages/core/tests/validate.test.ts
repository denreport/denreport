import { describe, expect, it } from "vitest";
import type { IrRuleId } from "../src/ir/errors";
import type {
  IrColumn,
  IrDocument,
  IrElement,
  IrFlexElement,
  IrFootnotes,
  IrNamedStyle,
} from "../src/ir/types";
import { validateIr } from "../src/ir/validate";

function requireColumn(columns: readonly IrColumn[]): IrColumn {
  const column = columns[0];
  if (!column) throw new Error("expected at least one column");
  return column;
}

function baseDocument(): IrDocument {
  return {
    version: "1.0",
    page: { width: 210, height: 297 },
    font: { name: "NotoSansJP" },
    elements: [
      {
        type: "text",
        id: "t1",
        x: 0,
        y: 0,
        pages: "first",
        w: 50,
        h: 10,
        text: "hello",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      {
        type: "line",
        id: "l1",
        x: 0,
        y: 20,
        pages: "first",
        orientation: "horizontal",
        length: 50,
        thickness: 0.3,
      },
      {
        type: "rect",
        id: "r1",
        x: 0,
        y: 30,
        pages: "first",
        w: 50,
        h: 10,
        borderWidth: 0.3,
      },
      {
        type: "table",
        id: "tbl1",
        x: 0,
        y: 50,
        bind: "items",
        rowHeight: 9,
        headerHeight: 9,
        fontSize: 10,
        maxY: 297,
        continuationY: 50,
        minRows: 0,
        columns: [{ key: "name", label: "Name", width: 40, align: "left" }],
      },
      {
        type: "image",
        id: "img1",
        x: 0,
        y: 100,
        pages: "first",
        w: 20,
        h: 20,
        src: "data:image/png;base64,AAAA",
      },
      {
        type: "flex",
        id: "flex1",
        x: 0,
        y: 130,
        pages: "first",
        direction: "column",
        h: 20,
        gap: 1,
        justifyContent: "start",
        alignItems: "start",
        children: [
          {
            type: "text",
            id: "ft1",
            w: 10,
            h: 5,
            text: "a",
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
          {
            type: "text",
            id: "ft2",
            w: 10,
            h: 5,
            text: "b",
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      },
      {
        type: "pageNumber",
        id: "pn1",
        x: 0,
        y: 160,
        pages: "all",
        w: 50,
        h: 6,
        format: "{n} / {N}",
        fontSize: 10,
        align: "left",
        lineHeight: 1.25,
      },
      {
        type: "ellipse",
        id: "e1",
        x: 150,
        y: 170,
        pages: "first",
        w: 30,
        h: 20,
        borderWidth: 0.3,
      },
      {
        type: "barcode",
        id: "bc1",
        x: 0,
        y: 170,
        pages: "first",
        w: 30,
        h: 30,
        symbology: "qrcode",
        value: "{code}",
      },
    ],
  };
}

function withElements(
  doc: IrDocument,
  elements: readonly IrElement[],
): IrDocument {
  return { ...doc, elements };
}

function withStyles(
  doc: IrDocument,
  styles: readonly IrNamedStyle[],
): IrDocument {
  return { ...doc, styles };
}

function expectRule(
  errors: readonly { rule: IrRuleId; path: string }[],
  rule: IrRuleId,
  pathIncludes?: string,
) {
  const match = errors.find(
    (e) =>
      e.rule === rule &&
      (pathIncludes === undefined || e.path.includes(pathIncludes)),
  );
  expect(
    match,
    `expected ${rule} error${pathIncludes ? ` at ${pathIncludes}` : ""}, got ${JSON.stringify(errors)}`,
  ).toBeDefined();
}

function expectNoRule(errors: readonly { rule: IrRuleId }[], rule: IrRuleId) {
  expect(errors.filter((e) => e.rule === rule)).toEqual([]);
}

describe("validateIr", () => {
  it("accepts the base valid document", () => {
    expect(validateIr(baseDocument())).toEqual([]);
  });

  describe("M01", () => {
    it("rejects an id that does not match the identifier pattern", () => {
      const doc = baseDocument();
      const [text, ...rest] = doc.elements as [IrElement, ...IrElement[]];
      const bad = withElements(doc, [{ ...text, id: "1bad" }, ...rest]);
      expectRule(validateIr(bad), "M01", "elements[0].id");
    });

    it("rejects duplicate ids, including across flex descendants", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "rect" ? { ...el, id: "t1" } : el,
      );
      const errors = validateIr(withElements(doc, elements));
      const m01 = errors.filter((e) => e.rule === "M01");
      expect(m01.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("M02", () => {
    it("rejects an element extending past the right edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, w: 300 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[2].x",
      );
    });

    it("accepts an element that exactly touches the page edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, x: 160, w: 50 } : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M02");
    });

    it("rejects an element 1mm past the page edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, x: 161, w: 50 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[2].x",
      );
    });

    it("checks the flex container's own box, exactly fitting the page", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "flex1" ? { ...el, x: 200 } : el,
      );
      // column 方向のコンテナ幅は交差軸導出（子の w の最大値 = 10）なので x=200 で 200+10=210 に収まる
      expectNoRule(validateIr(withElements(doc, elements)), "M02");
    });

    it("rejects a flex container 1mm past the page edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "flex1" ? { ...el, x: 201 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[5].x",
      );
    });

    it("rejects a table wider than the page", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, columns: [{ ...requireColumn(el.columns), width: 300 }] }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[3].x",
      );
    });

    it("rejects a table with a negative y", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, y: -50 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[3].y",
      );
    });

    it("rejects an ellipse extending past the right edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "e1" ? { ...el, x: 200 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[7].x",
      );
    });

    it("rejects a barcode extending past the bottom edge", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "barcode" ? { ...el, h: 300 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M02",
        "elements[8].y",
      );
    });
  });

  describe("M03", () => {
    it("rejects a non-positive dimension", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, w: 0 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M03",
        "elements[2].w",
      );
    });

    it("rejects a non-positive barcode dimension", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "barcode" ? { ...el, w: 0 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M03",
        "elements[8].w",
      );
    });

    it("rejects a negative gap but allows a zero gap", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "flex1" ? { ...el, gap: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M03",
        "elements[5].gap",
      );

      const zeroGap = doc.elements.map((el) =>
        el.id === "flex1" ? { ...el, gap: 0 } : el,
      );
      expectNoRule(validateIr(withElements(doc, zeroGap)), "M03");
    });

    it("rejects a non-positive explicit flex main-axis dimension (and also reports M12)", () => {
      const doc = baseDocument();
      const zero = doc.elements.map((el) =>
        el.type === "flex" ? { ...el, h: 0 } : el,
      );
      const zeroErrors = validateIr(withElements(doc, zero));
      expectRule(zeroErrors, "M03", "elements[5].h");
      // 内容寸法 11 に対し明示値 0 は下回るため、全件列挙により M12 も同時に報告される
      expectRule(zeroErrors, "M12", "elements[5].h");

      const negative = doc.elements.map((el) =>
        el.type === "flex" ? { ...el, h: -5 } : el,
      );
      expectRule(
        validateIr(withElements(doc, negative)),
        "M03",
        "elements[5].h",
      );
    });

    it("allows a zero borderWidth on rect and ellipse (M03 relaxation)", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "rect" || el.type === "ellipse"
          ? { ...el, borderWidth: 0 }
          : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M03");
    });

    it("rejects a negative borderWidth on rect and ellipse", () => {
      const doc = baseDocument();
      const rectNegative = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, borderWidth: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, rectNegative)),
        "M03",
        "elements[2].borderWidth",
      );

      const ellipseNegative = doc.elements.map((el) =>
        el.id === "e1" ? { ...el, borderWidth: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, ellipseNegative)),
        "M03",
        "elements[7].borderWidth",
      );
    });

    it("rejects non-positive ellipse dimensions", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "e1" ? { ...el, w: 0 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M03",
        "elements[7].w",
      );
    });
  });

  describe("M04", () => {
    it("rejects fontSize out of range and accepts the boundary value", () => {
      const doc = baseDocument();
      const tooLarge = doc.elements.map((el) =>
        el.id === "t1" ? { ...el, fontSize: 201 } : el,
      );
      expectRule(
        validateIr(withElements(doc, tooLarge)),
        "M04",
        "elements[0].fontSize",
      );

      const boundary = doc.elements.map((el) =>
        el.id === "t1" ? { ...el, fontSize: 200 } : el,
      );
      expectNoRule(validateIr(withElements(doc, boundary)), "M04");
    });

    it("rejects lineHeight out of range", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "t1" ? { ...el, lineHeight: 5.1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M04",
        "elements[0].lineHeight",
      );
    });
  });

  describe("M05", () => {
    it("rejects a page dimension out of range", () => {
      const doc = { ...baseDocument(), page: { width: 0, height: 297 } };
      expectRule(validateIr(doc), "M05", "page.width");
    });

    it("accepts the boundary page dimensions", () => {
      const doc = { ...baseDocument(), page: { width: 1, height: 5000 } };
      expectNoRule(validateIr(doc), "M05");
    });
  });

  describe("M06", () => {
    it("rejects a table with no columns", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, columns: [] } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M06",
        "elements[3].columns",
      );
    });

    it("rejects duplicate column keys", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? {
              ...el,
              columns: [
                requireColumn(el.columns),
                { ...requireColumn(el.columns), label: "Name2" },
              ],
            }
          : el,
      );
      const errors = validateIr(withElements(doc, elements));
      const m06 = errors.filter((e) => e.rule === "M06");
      expect(m06.length).toBe(2);
    });
  });

  describe("M07", () => {
    it("rejects an invalid table.bind and column key", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? {
              ...el,
              bind: "1bad",
              columns: [{ ...requireColumn(el.columns), key: "1bad" }],
            }
          : el,
      );
      const errors = validateIr(withElements(doc, elements));
      expectRule(errors, "M07", "elements[3].bind");
      expectRule(errors, "M07", "elements[3].columns[0].key");
    });

    it("rejects a font.name that is not a valid identifier", () => {
      const doc = { ...baseDocument(), font: { name: "日本語!" } };
      expectRule(validateIr(doc), "M07", "font.name");
    });
  });

  describe("M08", () => {
    it("rejects an unsupported mediatype", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "img1" ? { ...el, src: "data:image/gif;base64,AAAA" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M08",
        "elements[4].src",
      );
    });

    it("rejects an undecodable base64 payload", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "img1" ? { ...el, src: "data:image/png;base64,A" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M08",
        "elements[4].src",
      );
    });
  });

  describe("M09", () => {
    it("accepts the boundary where exactly one row fits", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, maxY: el.y + el.headerHeight + el.rowHeight }
          : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M09");
    });

    it("rejects when the first page cannot fit even one row", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, maxY: el.y + el.headerHeight + el.rowHeight - 1 }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M09",
        "elements[3].maxY",
      );
    });

    it("rejects a negative continuationY", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, continuationY: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M09",
        "elements[3].continuationY",
      );
    });

    it("rejects maxY greater than the page height", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, maxY: 298 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M09",
        "elements[3].maxY",
      );
    });
  });

  describe("M10", () => {
    it("rejects a negative minRows", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, minRows: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M10",
        "elements[3].minRows",
      );
    });

    it("rejects a non-integer minRows", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table" ? { ...el, minRows: 2.5 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M10",
        "elements[3].minRows",
      );
    });
  });

  describe("M11", () => {
    it("rejects a flex with no children", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "flex" ? { ...el, children: [] } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M11",
        "elements[5].children",
      );
    });
  });

  describe("M12", () => {
    it("rejects an explicit main-axis dimension below the content dimension", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "flex" ? { ...el, h: 10 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M12",
        "elements[5].h",
      );
    });

    it("accepts the boundary where the explicit dimension equals the content dimension", () => {
      const doc = baseDocument();
      // children: h=5 + h=5 + gap(1) = 11 の内容寸法ちょうど
      const elements = doc.elements.map((el) =>
        el.type === "flex" ? { ...el, h: 11 } : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M12");
    });

    it("rejects an explicit row main-axis dimension (w) below the content dimension", () => {
      const doc = baseDocument();
      const rowFlex: IrFlexElement = {
        type: "flex",
        id: "rowFlex",
        x: 0,
        y: 200,
        pages: "first",
        direction: "row",
        w: 5,
        gap: 0,
        justifyContent: "start",
        alignItems: "start",
        children: [
          {
            type: "text",
            id: "rc1",
            w: 10,
            h: 5,
            text: "a",
            fontSize: 10,
            align: "left",
            lineHeight: 1.25,
          },
        ],
      };
      const elements = [...doc.elements, rowFlex];
      expectRule(
        validateIr(withElements(doc, elements)),
        "M12",
        "elements[9].w",
      );
    });
  });

  describe("M13", () => {
    it("accepts a table with no cellOverrides attribute", () => {
      expect(validateIr(baseDocument())).toEqual([]);
    });

    it("rejects a negative row", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, cellOverrides: [{ row: -1, key: "name", value: "x" }] }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M13",
        "elements[3].cellOverrides[0].row",
      );
    });

    it("rejects a non-integer row", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, cellOverrides: [{ row: 1.5, key: "name", value: "x" }] }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M13",
        "elements[3].cellOverrides[0].row",
      );
    });

    it("rejects a key not present in columns", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? { ...el, cellOverrides: [{ row: 0, key: "missing", value: "x" }] }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M13",
        "elements[3].cellOverrides[0].key",
      );
    });

    it("rejects duplicate (row, key) entries", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? {
              ...el,
              cellOverrides: [
                { row: 0, key: "name", value: "a" },
                { row: 0, key: "name", value: "b" },
              ],
            }
          : el,
      );
      const errors = validateIr(withElements(doc, elements));
      const m13 = errors.filter((e) => e.rule === "M13");
      expect(m13.length).toBe(2);
    });

    it("accepts a valid entry even when row exceeds the bound data length", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "table"
          ? {
              ...el,
              cellOverrides: [{ row: 999, key: "name", value: "x" }],
            }
          : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M13");
    });
  });

  describe("M14", () => {
    it("accepts a document with no styles", () => {
      expect(validateIr(baseDocument())).toEqual([]);
    });

    it("accepts a valid style definition", () => {
      const doc = withStyles(baseDocument(), [
        { name: "見出し", attrs: { fontSize: 14, align: "center" } },
      ]);
      expectNoRule(validateIr(doc), "M14");
    });

    it("rejects an empty name", () => {
      const doc = withStyles(baseDocument(), [
        { name: "", attrs: { fontSize: 10 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].name");
    });

    it("rejects a name longer than 64 characters", () => {
      const doc = withStyles(baseDocument(), [
        { name: "a".repeat(65), attrs: { fontSize: 10 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].name");
    });

    it("rejects duplicate names", () => {
      const doc = withStyles(baseDocument(), [
        { name: "見出し", attrs: { fontSize: 10 } },
        { name: "見出し", attrs: { fontSize: 12 } },
      ]);
      const errors = validateIr(doc).filter((e) => e.rule === "M14");
      expect(errors.length).toBe(2);
    });

    it("rejects an empty attrs", () => {
      const doc = withStyles(baseDocument(), [{ name: "空", attrs: {} }]);
      expectRule(validateIr(doc), "M14", "styles[0].attrs");
    });

    it("rejects fontSize out of range", () => {
      const doc = withStyles(baseDocument(), [
        { name: "x", attrs: { fontSize: 0 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].attrs.fontSize");
    });

    it("rejects lineHeight out of range", () => {
      const doc = withStyles(baseDocument(), [
        { name: "x", attrs: { lineHeight: 6 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].attrs.lineHeight");
    });

    it("rejects borderWidth <= 0", () => {
      const doc = withStyles(baseDocument(), [
        { name: "x", attrs: { borderWidth: 0 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].attrs.borderWidth");
    });

    it("rejects thickness <= 0", () => {
      const doc = withStyles(baseDocument(), [
        { name: "x", attrs: { thickness: -1 } },
      ]);
      expectRule(validateIr(doc), "M14", "styles[0].attrs.thickness");
    });
  });

  describe("M16", () => {
    it("rejects a 3-digit shorthand color", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "l1" ? { ...el, color: "#fff" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M16",
        "elements[1].color",
      );
    });

    it("rejects a CSS color name", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "l1" ? { ...el, color: "red" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M16",
        "elements[1].color",
      );
    });

    it("rejects a color with an alpha channel", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, fillColor: "#ff0000ff" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M16",
        "elements[2].fillColor",
      );
    });

    it("accepts an uppercase hex color", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "l1" ? { ...el, color: "#FF00AA" } : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M16");
    });

    it("rejects an invalid ellipse borderColor and table stripeColor", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) => {
        if (el.id === "e1") return { ...el, borderColor: "blue" };
        if (el.type === "table") return { ...el, stripeColor: "blue" };
        return el;
      });
      const errors = validateIr(withElements(doc, elements));
      expectRule(errors, "M16", "elements[7].borderColor");
      expectRule(errors, "M16", "elements[3].stripeColor");
    });

    it("rejects an invalid text color and pageNumber color", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) => {
        if (el.id === "t1") return { ...el, color: "blue" };
        if (el.id === "pn1") return { ...el, color: "#abc" };
        return el;
      });
      const errors = validateIr(withElements(doc, elements));
      expectRule(errors, "M16", "elements[0].color");
      expectRule(errors, "M16", "elements[6].color");
    });
  });

  describe("M15", () => {
    it("accepts an element style referencing a defined style", () => {
      const doc = baseDocument();
      const withDef = withStyles(doc, [
        { name: "見出し", attrs: { fontSize: 14 } },
      ]);
      const elements = withDef.elements.map((el) =>
        el.id === "t1" ? { ...el, style: "見出し" } : el,
      );
      expectNoRule(validateIr(withElements(withDef, elements)), "M15");
    });

    it("rejects an element style referencing an undefined style", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "t1" ? { ...el, style: "見出し" } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M15",
        "elements[0].style",
      );
    });

    it("rejects an undefined style referenced by a flex descendant", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.type === "flex"
          ? {
              ...el,
              children: el.children.map((child, i) =>
                i === 0 ? { ...child, style: "見出し" } : child,
              ),
            }
          : el,
      );
      const errors = validateIr(withElements(doc, elements));
      expectRule(errors, "M15", "elements[5].children[0].style");
    });
  });

  describe("M17", () => {
    it("rejects a negative cornerRadius", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, cornerRadius: -1 } : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M17",
        "elements[2].cornerRadius",
      );
    });

    it("rejects a cornerRadius above min(w, h) / 2 and accepts the boundary", () => {
      const doc = baseDocument();
      // r1: w=50, h=10 → min/2 = 5
      const tooLarge = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, cornerRadius: 6 } : el,
      );
      expectRule(
        validateIr(withElements(doc, tooLarge)),
        "M17",
        "elements[2].cornerRadius",
      );

      const boundary = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, cornerRadius: 5 } : el,
      );
      expectNoRule(validateIr(withElements(doc, boundary)), "M17");
    });

    it("rejects cornerRadius combined with a non-solid borderStyle", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1"
          ? { ...el, cornerRadius: 2, borderStyle: "dashed" as const }
          : el,
      );
      expectRule(
        validateIr(withElements(doc, elements)),
        "M17",
        "elements[2].borderStyle",
      );
    });

    it("allows cornerRadius with an explicit solid borderStyle", () => {
      const doc = baseDocument();
      const elements = doc.elements.map((el) =>
        el.id === "r1"
          ? { ...el, cornerRadius: 2, borderStyle: "solid" as const }
          : el,
      );
      expectNoRule(validateIr(withElements(doc, elements)), "M17");
    });
  });

  describe("F02-F06 (footnotes)", () => {
    function withFootnotes(
      doc: IrDocument,
      footnotes: IrFootnotes,
    ): IrDocument {
      return { ...doc, footnotes };
    }

    function withMark(doc: IrDocument, mark: string): IrDocument {
      const elements = doc.elements.map((el) =>
        el.id === "t1" && el.type === "text"
          ? { ...el, text: `${el.text}${mark}` }
          : el,
      );
      return withElements(doc, elements);
    }

    it("accepts a document with a valid footnotes block", () => {
      const doc = withFootnotes(withMark(baseDocument(), "{#tax}"), {
        x: 15,
        w: 180,
        bottom: 10,
        fontSize: 8,
        lineHeight: 1.25,
        pages: "all",
        notes: [{ id: "tax", text: "本体価格は税抜表示です" }],
      });
      expectNoRule(validateIr(doc), "F02");
      expectNoRule(validateIr(doc), "F03");
      expectNoRule(validateIr(doc), "F04");
      expectNoRule(validateIr(doc), "F05");
      expectNoRule(validateIr(doc), "F06");
    });

    describe("F02", () => {
      it("rejects a note id that does not match the identifier pattern", () => {
        const doc = withFootnotes(baseDocument(), {
          x: 15,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "1bad", text: "本文" }],
        });
        expectRule(validateIr(doc), "F02", "footnotes.notes[0].id");
      });

      it("rejects duplicate note ids", () => {
        const doc = withFootnotes(baseDocument(), {
          x: 15,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [
            { id: "tax", text: "本文1" },
            { id: "tax", text: "本文2" },
          ],
        });
        const errors = validateIr(doc);
        expect(errors.filter((e) => e.rule === "F02").length).toBe(2);
      });
    });

    describe("F03", () => {
      it("rejects a mark that references an undefined note", () => {
        const doc = withMark(baseDocument(), "{#missing}");
        expectRule(validateIr(doc), "F03", "elements[0].text");
      });
    });

    describe("F04", () => {
      it("rejects a mark inside a flex descendant text", () => {
        const doc = baseDocument();
        const elements = doc.elements.map((el) =>
          el.type === "flex"
            ? {
                ...el,
                children: el.children.map((child) =>
                  child.id === "ft1" && child.type === "text"
                    ? { ...child, text: "{#a}" }
                    : child,
                ),
              }
            : el,
        );
        expectRule(
          validateIr(withElements(doc, elements)),
          "F04",
          "elements[5].children[0].text",
        );
      });

      it("rejects a mark in a table column label", () => {
        const doc = baseDocument();
        const elements = doc.elements.map((el) =>
          el.type === "table"
            ? {
                ...el,
                columns: el.columns.map((col) => ({
                  ...col,
                  label: "{#a}",
                })),
              }
            : el,
        );
        expectRule(
          validateIr(withElements(doc, elements)),
          "F04",
          "elements[3].columns[0].label",
        );
      });

      it("rejects a mark in a table cellOverrides value", () => {
        const doc = baseDocument();
        const elements = doc.elements.map((el) =>
          el.type === "table"
            ? {
                ...el,
                cellOverrides: [{ row: 0, key: "name", value: "{#a}" }],
              }
            : el,
        );
        expectRule(
          validateIr(withElements(doc, elements)),
          "F04",
          "elements[3].cellOverrides[0].value",
        );
      });

      it("rejects a mark in pageNumber.format", () => {
        const doc = baseDocument();
        const elements = doc.elements.map((el) =>
          el.type === "pageNumber" ? { ...el, format: "{#a}" } : el,
        );
        expectRule(
          validateIr(withElements(doc, elements)),
          "F04",
          "elements[6].format",
        );
      });

      it("rejects a mark inside a note's own text", () => {
        const doc = withFootnotes(baseDocument(), {
          x: 15,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "a", text: "{#b}" }],
        });
        expectRule(validateIr(doc), "F04", "footnotes.notes[0].text");
      });
    });

    describe("F05", () => {
      it("rejects a note that no mark references", () => {
        const doc = withFootnotes(baseDocument(), {
          x: 15,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "unused", text: "本文" }],
        });
        expectRule(validateIr(doc), "F05", "footnotes.notes[0].id");
      });
    });

    describe("F06", () => {
      it("rejects a negative x", () => {
        const doc = withFootnotes(withMark(baseDocument(), "{#a}"), {
          x: -1,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "a", text: "本文" }],
        });
        expectRule(validateIr(doc), "F06", "footnotes.x");
      });

      it("rejects a block wider than the page", () => {
        const doc = withFootnotes(withMark(baseDocument(), "{#a}"), {
          x: 200,
          w: 180,
          bottom: 10,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "a", text: "本文" }],
        });
        expectRule(validateIr(doc), "F06", "footnotes.w");
      });

      it("rejects a block that overflows the top of the page", () => {
        const doc = withFootnotes(withMark(baseDocument(), "{#a}"), {
          x: 15,
          w: 180,
          bottom: 296,
          fontSize: 8,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "a", text: "本文" }],
        });
        expectRule(validateIr(doc), "F06", "footnotes.bottom");
      });

      it("rejects fontSize out of range", () => {
        const doc = withFootnotes(withMark(baseDocument(), "{#a}"), {
          x: 15,
          w: 180,
          bottom: 10,
          fontSize: 300,
          lineHeight: 1.25,
          pages: "all",
          notes: [{ id: "a", text: "本文" }],
        });
        expectRule(validateIr(doc), "F06", "footnotes.fontSize");
      });
    });
  });

  describe("multiple violations", () => {
    it("reports every violation across rules", () => {
      const doc = { ...baseDocument(), page: { width: 0, height: 297 } };
      const elements = doc.elements.map((el) =>
        el.id === "r1" ? { ...el, w: 0 } : el,
      );
      const errors = validateIr(withElements(doc, elements));
      expectRule(errors, "M05", "page.width");
      expectRule(errors, "M03", "elements[2].w");
    });
  });

  describe("docType", () => {
    it("does not change the result for a document with docType set", () => {
      const doc = { ...baseDocument(), docType: "qualifiedInvoice" as const };
      expect(validateIr(doc)).toEqual(validateIr(baseDocument()));
    });
  });
});

import type { IrElement, IrFlexChild, IrStrokeStyle } from "@denreport/core";
import type { CSSProperties, ReactNode } from "react";
import { IMAGE_PLACEHOLDER_SRC } from "../../state/constants";
import { ELEMENT_TYPE_LABEL } from "../../state/element-labels";
import type { PlacedElementView } from "../../state/geometry";
import { visibleInContext } from "../../state/geometry";
import type { TableCellSource } from "../../state/table-cells";
import type { PageContext } from "../../state/types";
import { BarcodeSketch } from "./BarcodeSketch";
import { TableSketch } from "./TableSketch";

// キャンバスは模式表示に割り切り、二点鎖線・一点鎖線は dashed で近似する（正確な線種はプレビューで確認する）
function cssLineStyle(
  strokeStyle: IrStrokeStyle,
): "solid" | "dotted" | "dashed" {
  switch (strokeStyle) {
    case "solid":
      return "solid";
    case "dotted":
      return "dotted";
    case "dashed":
    case "dashdot":
    case "dashdotdot":
      return "dashed";
  }
}

function elementContent(el: IrElement | IrFlexChild): ReactNode {
  switch (el.type) {
    case "text":
      return el.text;
    case "pageNumber":
      return <span className="apx-bind">{el.format}</span>;
    case "image":
      if (el.src === IMAGE_PLACEHOLDER_SRC) {
        return <span className="apx-image-placeholder">画像未設定</span>;
      }
      return (
        <img className="apx-el-img" src={el.src} alt="" draggable={false} />
      );
    case "barcode":
      return <BarcodeSketch symbology={el.symbology} value={el.value} />;
    default:
      return null;
  }
}

export function PaperElement(props: {
  readonly view: PlacedElementView;
  readonly context: PageContext;
  readonly dragging: boolean;
  readonly tableCells?: TableCellSource | undefined;
}): ReactNode {
  const { view } = props;
  const el = view.element;
  const ghost = !visibleInContext(view.pages, props.context);

  const classes = ["apx-el", `apx-el-${el.type}`];
  if (el.type === "line") {
    classes.push(
      el.orientation === "horizontal" ? "apx-el-line-h" : "apx-el-line-v",
    );
  }
  if (el.type === "text" || el.type === "pageNumber") {
    classes.push(`apx-align-${el.align}`);
  }
  if (el.type === "image" && el.src === IMAGE_PLACEHOLDER_SRC) {
    classes.push("is-placeholder");
  }
  // 枠線幅 0 は「枠なし」の正当な状態であり、下限クランプの対象から外す
  if ((el.type === "rect" || el.type === "ellipse") && el.borderWidth === 0) {
    classes.push("is-borderless");
  }
  if (ghost) {
    classes.push("is-otherpage");
  }
  if (props.dragging) {
    classes.push("is-dragging");
  }

  const vars: Record<string, number | string> = {
    "--x": view.box.x,
    "--y": view.box.y,
    "--w": view.box.w,
    "--h": view.box.h,
  };
  if (el.type !== "table" && el.type !== "flex" && el.rotate !== undefined) {
    vars["--rot"] = `${el.rotate}deg`;
  }
  let lineHeight: number | undefined;
  switch (el.type) {
    case "text":
    case "pageNumber":
      vars["--fs"] = el.fontSize;
      lineHeight = el.lineHeight;
      if (el.color !== undefined) vars["--tc"] = el.color;
      break;
    case "line":
      vars["--t"] = el.thickness;
      if (el.color !== undefined) vars["--lc"] = el.color;
      if (el.strokeStyle !== undefined)
        vars["--ls"] = cssLineStyle(el.strokeStyle);
      break;
    case "rect":
      vars["--bw"] = el.borderWidth;
      if (el.borderColor !== undefined) vars["--bc"] = el.borderColor;
      if (el.fillColor !== undefined) vars["--fc"] = el.fillColor;
      if (el.borderStyle !== undefined)
        vars["--ls"] = cssLineStyle(el.borderStyle);
      if (el.cornerRadius !== undefined) vars["--rr"] = el.cornerRadius;
      break;
    case "ellipse":
      vars["--bw"] = el.borderWidth;
      if (el.borderColor !== undefined) vars["--bc"] = el.borderColor;
      if (el.fillColor !== undefined) vars["--fc"] = el.fillColor;
      break;
    case "table":
      if (el.frameWidth !== undefined) vars["--frame-w"] = el.frameWidth;
      if (el.gridWidth !== undefined) vars["--grid-w"] = el.gridWidth;
      if (el.frameStyle !== undefined)
        vars["--frame-ls"] = cssLineStyle(el.frameStyle);
      if (el.gridStyle !== undefined)
        vars["--grid-ls"] = cssLineStyle(el.gridStyle);
      break;
    default:
      break;
  }

  // キャンバスは実フォントを使わない模式表示のため、太字・斜体は合成でよい
  const textStyle: Record<string, string> = {};
  if (el.type === "text") {
    if (el.fontWeight === "bold") textStyle.fontWeight = "bold";
    if (el.fontStyle === "italic") textStyle.fontStyle = "italic";
    if (el.underline === true) textStyle.textDecoration = "underline";
  }

  const style = { ...vars, lineHeight, ...textStyle } as CSSProperties;

  return (
    <div className={classes.join(" ")} style={style} data-apx-id={view.id}>
      {el.type === "flex" && (
        <span className="apx-el-chip apx-el-chip--muted">
          {ELEMENT_TYPE_LABEL.flex} · {el.id}
        </span>
      )}
      {ghost && view.pages !== null && (
        <span className="apx-el-chip apx-el-chip--muted">
          pages: {view.pages}
        </span>
      )}
      {el.type === "table" ? (
        <TableSketch element={el} box={view.box} cells={props.tableCells} />
      ) : (
        elementContent(el)
      )}
    </div>
  );
}

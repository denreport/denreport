import type { IrElementType } from "@denreport/core";

/** 要素型の日本語表示名。UI での型名表示はすべてこの表を情報源とする */
export const ELEMENT_TYPE_LABEL: Readonly<Record<IrElementType, string>> = {
  text: "テキスト",
  line: "直線",
  rect: "矩形",
  ellipse: "楕円",
  table: "表",
  image: "画像",
  flex: "フレックス",
  pageNumber: "ページ番号",
  barcode: "バーコード",
};

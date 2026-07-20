import { getMessages } from "../i18n/messages/index.js";
import type { TargetCompatMatrix } from "./types.js";

export const pdfmeCompatMatrix = {
  target: "pdfme",
  displayName: "pdfme",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "折り返し・行頭禁則・均等割付はコンパイラ計算で両ターゲット一致。縦方向のはみ出し時の挙動のみ IR が規定せず、pdfme の描画に従う",
        userMessage: (locale) => getMessages(locale).compat.pdfme.textElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
        underline: {
          level: "approximated",
          note: "下線の位置・太さは IR が規定せず、pdfme text スキーマの underline 描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.textUnderline,
        },
      },
    },
    line: {
      element: { level: "supported" },
      attributes: {
        color: { level: "supported" },
        thickness: {
          level: "approximated",
          note: "太さ分の塗りが基準線のどちら側に付くかは IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.lineThickness,
        },
        strokeStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、短い実線線分の列へ静的展開して近似する（パターン端数・位相はターゲット近似）",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.lineStrokeStyle,
        },
        rotate: { level: "supported" },
      },
    },
    rect: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        borderWidth: {
          level: "approximated",
          note: "枠線の太さ分の塗りの位置は IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.rectBorderWidth,
        },
        borderStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、4辺を線分列に分解して近似する（角でパターンが継続しない）",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.rectBorderStyle,
        },
        cornerRadius: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    ellipse: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    table: {
      element: {
        level: "approximated",
        note: "明細の分割・ページ割当は書き出し時に確定するため対応。セル文字列の描画（折り返し・行頭禁則・均等割付は対応、縦方向のはみ出しのみ近似）は text と同じ扱い",
        userMessage: (locale) => getMessages(locale).compat.pdfme.tableElement,
      },
      attributes: {
        stripeColor: { level: "supported" },
        frameWidth: {
          level: "approximated",
          note: "枠線の太さ分の塗りの位置は IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableFrameWidth,
        },
        gridWidth: {
          level: "approximated",
          note: "太さ分の塗りが基準線のどちら側に付くかは IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableGridWidth,
        },
        frameStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、4辺を線分列に分解して近似する（角でパターンが継続しない）",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableFrameStyle,
        },
        gridStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、短い実線線分の列へ静的展開して近似する（パターン端数・位相はターゲット近似）",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableGridStyle,
        },
      },
    },
    image: {
      element: { level: "supported" },
      attributes: {
        rotate: { level: "supported" },
      },
    },
    flex: {
      element: { level: "supported" },
    },
    pageNumber: {
      element: {
        level: "approximated",
        note: "確定文字列に展開されるため対応。文字列の描画（折り返し・行頭禁則・均等割付は対応、縦方向のはみ出しのみ近似）は text と同じ扱い",
        userMessage: (locale) =>
          getMessages(locale).compat.pdfme.pageNumberElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    barcode: {
      element: {
        level: "approximated",
        note: "規格は qrcode / code39 / code128 / ean13。w×h への伸縮のみ IR が規定し、バー太さ・クワイエットゾーン・人間可読文字（ean13 のみあり）の細部はターゲットの描画に従う。値の規格適合（チェックデジット等）は検証しない",
        userMessage: (locale) =>
          getMessages(locale).compat.pdfme.barcodeElement,
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;

import { getMessages } from "../i18n/messages";
import type { TargetCompatMatrix } from "./types";

export const reportlabCompatMatrix = {
  target: "reportlab",
  displayName: "ReportLab",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "折り返し・行頭禁則・均等割付はコンパイラ計算で両ターゲット一致。縦方向のはみ出し時の挙動のみ IR が規定せず、生成コードの描画に従う",
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.textElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
        underline: {
          level: "approximated",
          note: "下線の位置・太さは IR が規定せず、生成コードの線描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.textUnderline,
        },
      },
    },
    line: {
      element: { level: "supported" },
      attributes: {
        color: { level: "supported" },
        strokeStyle: { level: "supported" },
        thickness: {
          level: "approximated",
          note: "太さ分の塗りが基準線のどちら側に付くかは IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.lineThickness,
        },
        rotate: { level: "supported" },
      },
    },
    rect: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        borderStyle: { level: "supported" },
        borderWidth: {
          level: "approximated",
          note: "枠線の太さ分の塗りの位置は IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.rectBorderWidth,
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
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.tableElement,
      },
      attributes: {
        stripeColor: { level: "supported" },
        frameStyle: { level: "supported" },
        gridStyle: { level: "supported" },
        frameWidth: {
          level: "approximated",
          note: "枠線の太さ分の塗りの位置は IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.tableFrameWidth,
        },
        gridWidth: {
          level: "approximated",
          note: "太さ分の塗りが基準線のどちら側に付くかは IR が規定せず、ターゲットの描画に従う",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.tableGridWidth,
        },
      },
    },
    image: {
      element: { level: "supported" },
      attributes: {
        src: {
          level: "approximated",
          note: "画像の描画には生成コードの実行環境に Pillow が必要（実行要件として生成コードの冒頭に明記される）。PNG は実行環境の Pillow が PNG コーデックを持つ場合のみ描画できる",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.imageSrc,
        },
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
          getMessages(locale).compat.reportlab.pageNumberElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    barcode: {
      element: {
        level: "approximated",
        note: "規格は qrcode / code39 / code128 / ean13。w×h への伸縮のみ IR が規定し、バー太さ・クワイエットゾーン・人間可読文字（ean13 のみあり）の細部はターゲットの描画に従う。値の規格適合（チェックデジット等）は検証しない。EAN-13 はチェックデジット自動補完（12桁入力時）が働く",
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.barcodeElement,
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;

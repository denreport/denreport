import type { TargetCompatMatrix } from "./types";

export const pdfmeCompatMatrix = {
  target: "pdfme",
  displayName: "pdfme",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "折り返し・行頭禁則・均等割付はコンパイラ計算で両ターゲット一致。縦方向のはみ出し時の挙動のみ IR が規定せず、pdfme の描画に従う",
        userMessage:
          "文字の折り返しや配置は出力先によらず同じになります。ボックスの高さに文字が収まりきらないときの表示だけ、出力先によってわずかに異なることがあります。",
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
        underline: {
          level: "approximated",
          note: "下線の位置・太さは IR が規定せず、pdfme text スキーマの underline 描画に従う",
          userMessage:
            "下線の位置や太さは出力先によってわずかに異なることがあります。",
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
          userMessage:
            "線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
        },
        strokeStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、短い実線線分の列へ静的展開して近似する（パターン端数・位相はターゲット近似）",
          userMessage:
            "破線・点線は短い実線をつなげた形で表示されます。間隔や開始位置が出力先によってわずかに変わることがあります。",
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
          userMessage:
            "枠線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
        },
        borderStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、4辺を線分列に分解して近似する（角でパターンが継続しない）",
          userMessage:
            "四角形の破線・点線の枠は、4辺をそれぞれ短い線に分けて表示されるため、角で模様がつながらないことがあります。",
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
        userMessage:
          "表の行がページをまたぐときの分割は書き出し時に確定するため、正しく出力されます。セル内の文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
      },
      attributes: {
        stripeColor: { level: "supported" },
        frameWidth: {
          level: "approximated",
          note: "枠線の太さ分の塗りの位置は IR が規定せず、ターゲットの描画に従う",
          userMessage:
            "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
        },
        gridWidth: {
          level: "approximated",
          note: "太さ分の塗りが基準線のどちら側に付くかは IR が規定せず、ターゲットの描画に従う",
          userMessage:
            "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
        },
        frameStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、4辺を線分列に分解して近似する（角でパターンが継続しない）",
          userMessage:
            "表の外枠を破線・点線にすると、角の部分で破線の模様がつながらないことがあります。",
        },
        gridStyle: {
          level: "approximated",
          note: "pdfme のスキーマは破線指定を持たないため、短い実線線分の列へ静的展開して近似する（パターン端数・位相はターゲット近似）",
          userMessage:
            "表の中の罫線を破線・点線にすると、破線の間隔が出力先によってわずかに変わることがあります。",
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
        userMessage:
          "ページ番号は書き出し時に確定した文字列に変換されるため、正しく出力されます。文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
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
        userMessage:
          "バーコードは指定した幅・高さに収まるように表示されます。バーの太さや余白などの細部は出力先によってわずかに変わることがあります。入力した値がバーコードの規格（チェックデジット等）に合っているかどうかは確認されません。",
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;

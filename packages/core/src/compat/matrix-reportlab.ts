import type { TargetCompatMatrix } from "./types";

export const reportlabCompatMatrix = {
  target: "reportlab",
  displayName: "ReportLab",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "折り返し・行頭禁則・均等割付はコンパイラ計算で両ターゲット一致。縦方向のはみ出し時の挙動のみ IR が規定せず、生成コードの描画に従う",
        userMessage:
          "文字の折り返しや配置は出力先によらず同じになります。ボックスの高さに文字が収まりきらないときの表示だけ、出力先によってわずかに異なることがあります。",
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
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
          userMessage:
            "線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
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
          userMessage:
            "枠線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
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
        frameStyle: { level: "supported" },
        gridStyle: { level: "supported" },
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
      },
    },
    image: {
      element: { level: "supported" },
      attributes: {
        src: {
          level: "approximated",
          note: "画像の描画には生成コードの実行環境に Pillow が必要（実行要件として生成コードの冒頭に明記される）。PNG は実行環境の Pillow が PNG コーデックを持つ場合のみ描画できる",
          userMessage:
            "画像を出力するには、生成された Python スクリプトの実行環境に Pillow というライブラリのインストールが必要です。PNG 画像を表示するには、その Pillow が PNG に対応している必要があります。",
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
        note: "規格は qrcode / code39 / code128 / ean13。w×h への伸縮のみ IR が規定し、バー太さ・クワイエットゾーン・人間可読文字（ean13 のみあり）の細部はターゲットの描画に従う。値の規格適合（チェックデジット等）は検証しない。EAN-13 はチェックデジット自動補完（12桁入力時）が働く",
        userMessage:
          "バーコードは指定した幅・高さに収まるように表示されます。バーの太さや余白などの細部は出力先によってわずかに変わることがあります。入力した値がバーコードの規格（チェックデジット等）に合っているかどうかは確認されません。ただし EAN-13 は、12桁で入力するとチェックデジットが自動的に補われます。",
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;

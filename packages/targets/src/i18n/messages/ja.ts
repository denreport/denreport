export const ja = {
  fontIssue: {
    rejection: {
      cff: "CFF（OTF）アウトラインのフォントは書き出しに使用できません。TrueType アウトラインの TTF フォントを使用してください。",
      collection:
        "フォントコレクション（TTC/OTC）は書き出しに使用できません。単一フォントの TTF フォントを使用してください。",
      woff: "WOFF 形式のフォントは書き出しに使用できません。圧縮されていない TTF フォントを使用してください。",
      woff2:
        "WOFF2 形式のフォントは書き出しに使用できません。圧縮されていない TTF フォントを使用してください。",
      unknown:
        "フォント形式を判定できませんでした。TrueType アウトラインの TTF フォントを使用してください。",
    },
    metricsUnreadable:
      "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。",
    widthUnreadable:
      "フォントの字幅（cmap / hmtx テーブル）を読み取れないため、テキストの折り返し・均等割付を計算できません。別の TTF フォントを使用してください。",
  },
  reportlab: {
    header: {
      notice: "生成物であり、手編集を想定しない。",
      requirement: "実行要件: Python 3, reportlab",
      requirementWithImage:
        "実行要件: Python 3, reportlab, Pillow（画像の描画に使用）",
      fontNoticeLine1:
        "フォント: 書き出し時に併せて出力されるフォントファイル（FONTS の各ファイル）を",
      fontNoticeLine2:
        "このファイルと同じディレクトリに置くこと。見つからない場合はエラー終了する。",
      usage: "使い方: python <このファイル> [出力.pdf]（省略時 output.pdf）",
      templateUsageLine1:
        "使い方: python <このファイル> [出力.pdf]（省略時 output.pdf。データなしで実行され、",
      templateUsageLine2: "差し込みキーがある場合はエラー終了する）",
      templateProgrammatic:
        'プログラムから: from report import build; build("出力.pdf", data)',
      templateDataDescription:
        "data は差し込み値の辞書。text 内の {key} トークンのキー → 文字列、table の bind キー → 行辞書のリスト。",
    },
    fontFileMissing:
      "フォントファイルが見つかりません: {font_path}（このファイルと同じディレクトリに置くこと）",
    bindStrMissingKey: 'データにキー "{key}" がありません',
    bindStrNotString: 'キー "{key}" の値が string ではありません',
    bindRowsNotArray: 'キー "{key}" の値が配列ではありません',
    bindRowsRowNotObject: "{t}行目がオブジェクトではありません",
    bindRowsCellNotString:
      '{t}行目のキー "{column_key}" の値が string ではありません',
    chunkSizesNoRoomInContinuation: "表が継続ページに1行も入りません",
    multipleMultiPageTables: "2ページ以上に展開される表が複数あります",
    pageCountExceeded:
      "展開後の総ページ数 {page_count} が上限 {PAGE_COUNT_MAX} を超えています",
  },
};

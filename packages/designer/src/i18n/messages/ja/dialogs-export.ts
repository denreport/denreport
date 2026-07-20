export const dialogsExportJa = {
  export: {
    title: "書き出し",
    close: "閉じる",
    run: "書き出す",
    blockedByErrors: (count: number): string =>
      `検証エラーが ${count} 件あるため実行できません。`,
    warningsNote:
      "警告は書き出しを妨げません。検証エラーがある場合は実行できません。",
    targetDescriptions: {
      pdfme: "テンプレート+inputs（JSON）",
      reportlab: "生成コード（.py + フォント、zip）",
    },
    fullEmbedFont: "フォントをまるごと埋め込む（サブセット化しない）",
    fullEmbedFontNote:
      "pdfme は既定で使用文字のみを埋め込みますが、一部の日本語フォントで文字化けする場合が あります。文字化けする場合はオンにしてください。",
    compatWarnings: "互換性警告",
    compatOk: "✓ 選択中のターゲットですべての要素を書き出せます。",
    compatLevel: {
      approximated: "近似",
      unsupported: "非対応",
    },
    findingCount: (count: number): string => `${count} 箇所`,
    templateModeNote:
      "サンプルデータが未入力のため、雛形として書き出します。pdfme は差し込み値が空の テンプレート、ReportLab は build(出力パス, data) にデータを渡す形式になります。",
    running: "書き出しています…",
    noArtifact: "生成物は作成されていません。",
    fontFetchFailed:
      "同梱フォントを取得できませんでした。もう一度お試しください。",
    fontMissing: (slotLabel: string, name: string): string =>
      `${slotLabel}フォント「${name}」の実データがありません。文書設定のフォント欄で選び直してください。`,
    failed: "書き出せませんでした。",
    warningsProduced:
      "生成物は作成されています。次のキーがサンプルデータに無かったため、テキストは空文字列・表は空行（minRows 分）で出力しました。",
    jsonParseError:
      "サンプルデータを JSON として解釈できません。プレビューのサンプルデータ欄で入力・生成できます。",
    notObjectError:
      "サンプルデータのトップレベルがオブジェクトではありません。プレビューのサンプルデータ欄で入力・生成できます。",
  },
  preview: {
    title: "プレビュー",
    close: "閉じる",
    pageCount: (count: number): string => `${count} ページ`,
    validationErrorsNote: (count: number): string =>
      `検証エラーが ${count} 件あります。検証エラーを解消してください。`,
    cannotDisplay: "プレビューを表示できません。",
    loadingFont: "フォントを読み込んでいます…",
    fontLoadFailed:
      "同梱フォントを読み込めなかったため、システムフォントで表示しています",
    fontMissing: (slotLabel: string, name: string): string =>
      `${slotLabel}フォント「${name}」の実データが未選択のため、同梱フォントで表示しています。文書設定のフォント欄で選び直せます`,
    jsonParseError: (detail: string): string =>
      `JSON として解釈できません: ${detail}`,
    pageAriaLabel: "プレビューページ",
    scenarios: {
      ariaLabel: "サンプルデータのシナリオ",
      nameAriaLabel: "シナリオ名",
      add: "追加",
      duplicate: "複製",
      remove: "削除",
    },
    sampleData: {
      label: "サンプルデータ (JSON)",
      generate: "bind キーから生成",
    },
    removeScenario: {
      ariaLabel: "シナリオの削除",
      heading: "シナリオの削除",
      body: "現在のシナリオを削除します。続行しますか？",
      cancel: "キャンセル",
      confirm: "削除する",
    },
    regenerateSample: {
      ariaLabel: "サンプルデータの上書き",
      heading: "サンプルデータの上書き",
      body: "現在のサンプルデータを生成した内容で置き換えます。続行しますか？",
      cancel: "キャンセル",
      confirm: "置き換える",
    },
  },
  fonts: {
    slotLabels: {
      regular: "標準",
      bold: "太字",
      italic: "斜体",
      boldItalic: "太字斜体",
    },
    selectTitle: (slotLabel: string): string => `${slotLabel}のフォントを選択`,
    licenseNote:
      "選択したフォントは書き出し物に埋め込まれます。フォントのライセンスをご確認ください。",
    cancel: "キャンセル",
    useThisFont: "このフォントを使う",
    revertToEmbedded: (name: string): string => `同梱フォント（${name}）に戻す`,
    clearToDefault: "未設定に戻す（標準フォントで代替）",
    loadingList: "フォント一覧を取得しています…",
    retry: "再試行",
    searchPlaceholder: "フォント名で検索",
    loadDataFailed: "フォントデータを取得できませんでした。",
    metricsUnreadable:
      "フォントの計量（head / hhea テーブル）を読み取れないため、テキストのベースライン位置を確定できません。別の TTF フォントを使用してください。",
    reasons: {
      unsupported:
        "お使いのブラウザは PC 内フォントの一覧取得に対応していません（Chromium 系ブラウザで利用できます）",
      denied:
        "フォントへのアクセスが許可されませんでした。ブラウザのサイト設定から許可できます",
      error: "フォント一覧を取得できませんでした。",
    },
  },
};

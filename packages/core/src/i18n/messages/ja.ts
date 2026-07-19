import type { IrRuleId } from "../../ir/errors";

/**
 * Japanese message catalog: the source of truth for every user-visible
 * string core produces (parse/validate/lower/invoice error messages, IR rule
 * descriptions, and compat userMessage text). `en.ts` mirrors this shape and
 * is checked against it via the `Messages` type.
 */
export const ja = {
  parse: {
    invalidJson: "入力を JSON として解析できません",
    rootNotObject: "ルートは JSON オブジェクトである必要があります",
    missingRequiredKey: (key: string) => `必須キー "${key}" がありません`,
    unknownKey: (key: string) => `未知のキー "${key}" です`,
    unknownAttribute: (key: string) => `未知の属性 "${key}" です`,
    notAnObject: (field: string) =>
      `${field} はオブジェクトである必要があります`,
    typeMustBe: (field: string, kind: string) =>
      `${field} は ${kind} である必要があります`,
    typeMustBeRequired: (field: string, kind: string) =>
      `${field} は ${kind} である必要があります（必須）`,
    mustBeArray: (field: string) => `${field} は配列である必要があります`,
    invalidValue: (field: string, value: string) =>
      `${field} の値が不正です: "${value}"`,
    docTypeInvalid: (valueDisplay: string) =>
      `docType の値が不正です: ${valueDisplay}`,
    unsupportedMinorVersion: (value: string, supported: string) =>
      `未対応の minor バージョンです: "${value}"（対応: ${supported} 以下）`,
    unsupportedMajorVersion: (value: string) =>
      `未対応の major バージョンです: "${value}"（対応: 1.x）`,
    invalidVersionFormat: (value: string) =>
      `version の形式が不正です: "${value}"`,
    elementNotObject: "要素はオブジェクトである必要があります",
    invalidElementType: (typeDisplay: string) =>
      `type は要素型のいずれかである必要があります: ${typeDisplay}`,
    flexChildCannotBeTable: "flex の子には table を含められません",
    stylesItemNotObject: "styles の要素はオブジェクトである必要があります",
    columnNotObject: "column はオブジェクトである必要があります",
    cellOverrideNotObject:
      "cellOverrides の要素はオブジェクトである必要があります",
    cellSpanNotObject: "cellSpans の要素はオブジェクトである必要があります",
    cellSpanRowInvalid: 'row は number または "header" である必要があります',
    groupNotObject: "groups の要素はオブジェクトである必要があります",
    memberIdsInvalid: "memberIds は string の配列である必要があります",
    noteNotObject: "note はオブジェクトである必要があります",
    bindAttributeRemoved: (key: string) =>
      `未知の属性 "${key}" です（text の全体差し込みは廃止されました。text: "{キー名}" を使用してください）`,
    imageSrcInvalid: "src は data URI 形式である必要があります",
    flexChildNotObject: "子要素はオブジェクトである必要があります",
  },
  validate: {
    idNotIdentifier: (id: string) =>
      `id "${id}" は識別子パターンに一致しません`,
    idDuplicate: (id: string) => `id "${id}" が文書内で重複しています`,
    xNegative: "x が 0 未満です",
    yNegative: "y が 0 未満です",
    tableWidthExceedsPage: "table の幅が用紙の右端を超えています",
    elementExceedsPageRight: "要素が用紙の右端を超えています",
    elementExceedsPageBottom: "要素が用紙の下端を超えています",
    mustBePositive: (field: string) => `${field} は 0 より大きい必要があります`,
    mustBeNonNegative: (field: string) =>
      `${field} は 0 以上である必要があります`,
    mustBeInRange: (field: string, max: number) =>
      `${field} は 0 より大きく ${max} 以下である必要があります`,
    pageDimensionRange: (field: string, min: number, max: number) =>
      `${field} は ${min} 以上 ${max} 以下である必要があります`,
    columnsRequired: "columns は1個以上必要です",
    columnKeyDuplicate: (key: string) =>
      `key "${key}" が table 内で重複しています`,
    fontNameNotIdentifier: (slot: string, name: string) =>
      `font.${slot} "${name}" は識別子パターンに一致しません`,
    bindNotIdentifier: (bind: string) =>
      `bind "${bind}" は識別子パターンに一致しません`,
    columnKeyNotIdentifier: (key: string) =>
      `key "${key}" は識別子パターンに一致しません`,
    unsupportedMediatype: (mediatype: string) =>
      `対応していない mediatype です: "${mediatype}"`,
    base64DecodeFailed: "base64 payload をデコードできません",
    maxYExceedsPageHeight: "maxY が用紙の高さを超えています",
    firstPageNoRowCapacity: "先頭ページの行容量が1行分もありません",
    continuationPageNoRowCapacity: "継続ページの行容量が1行分もありません",
    minRowsInvalid: "minRows は0以上の整数である必要があります",
    flexChildrenRequired: "children は1個以上必要です",
    mainAxisTooSmall: "主軸寸法が内容寸法を下回っています",
    rowMustBeNonNegativeInteger: "row は0以上の整数である必要があります",
    keyNotInColumns: (key: string) =>
      `key "${key}" が table の columns にありません`,
    rowKeyDuplicate: "(row, key) の組み合わせが table 内で重複しています",
    styleNameLengthInvalid: (max: number) =>
      `name は1文字以上${max}文字以下である必要があります`,
    styleNameDuplicate: (name: string) =>
      `name "${name}" が文書内で重複しています`,
    styleAttrsRequired: "attrs は1フィールド以上必要です",
    styleNotFound: (style: string) =>
      `style "${style}" を参照するスタイルが見つかりません`,
    colorFormatInvalid: (field: string, value: string) =>
      `${field} は #rrggbb 形式である必要があります: "${value}"`,
    cornerRadiusRange: (maxRadius: number) =>
      `cornerRadius は 0 以上 ${maxRadius} 以下である必要があります`,
    cornerRadiusRequiresSolidBorder:
      "cornerRadius を指定する場合、borderStyle は solid（省略含む）である必要があります",
    nameLengthInvalid: (max: number) =>
      `name は${max}文字以下である必要があります`,
    rotateInvalid: (max: number) =>
      `rotate は −${max} 以上 ${max} 以下の有限の number である必要があります`,
    cellSpanRowNotNonNegativeIntegerOrHeader:
      'row は0以上の整数または "header" である必要があります',
    mustBePositiveInteger: (field: string) =>
      `${field} は1以上の整数である必要があります`,
    spanMustHaveOneGreaterThanOne:
      "rowSpan・colSpan の少なくとも一方は2以上である必要があります",
    headerRowSpanMustBeOne: '"header" 行では rowSpan は1である必要があります',
    spanExceedsColumnRange: "結合範囲が列範囲を超えています",
    spanOverlapsMergedColumn: (key: string) =>
      `結合範囲が mergeSameValue の列 "${key}" に掛かっています`,
    spanOverlapsOtherSpan: (index: number) =>
      `結合範囲が cellSpans[${index}] と重なっています`,
    noteIdDuplicate: (id: string) =>
      `id "${id}" が footnotes 内で重複しています`,
    footnoteRefNotDefined: (id: string) =>
      `参照先の注記 "${id}" が定義されていません`,
    markNotAllowedInFlexText: "脚注マークは flex 内の text には書けません",
    markNotAllowedInPageNumberFormat:
      "脚注マークは pageNumber の format には書けません",
    markNotAllowedInColumnLabel: "脚注マークは table の列見出しには書けません",
    markNotAllowedInCellOverride:
      "脚注マークは table の固定値上書きには書けません",
    markNotAllowedInNoteText: "脚注マークは注記本文には書けません",
    noteNotReferenced: (id: string) =>
      `note "${id}" がどのマークからも参照されていません`,
    footnotesExceedPageRight: "注記ブロックが用紙の右端を超えています",
    footnotesExceedPageTop: "注記ブロックが用紙の上端を超えています",
  },
  lower: {
    multiplePagingTables: "2ページ以上に展開される表が複数あります",
    pageCountExceeded: (pageCount: number, max: number) =>
      `展開後の総ページ数 ${pageCount} が上限 ${max} を超えています`,
  },
  invoice: {
    itemLabels: {
      registrationNumber: "発行者の登録番号",
      transactionDate: "取引年月日",
      description: "取引内容",
      taxableAmount: "税率ごとに区分した対価の額・適用税率",
      taxAmount: "税率ごとに区分した消費税額等",
      customerName: "交付を受ける事業者の氏名又は名称",
    },
    missingField: (label: string, keys: string, tokens: string) =>
      `適格請求書の記載事項「${label}」の差し込み欄がありません（キー ${keys} の ${tokens} トークンまたは表の列キーを配置してください）`,
  },
  rules: {
    S01: "入力が JSON として構文解析できる",
    S02: "ルートはオブジェクトで、必須キーは version/page/font/elements の4つ、任意キーは docType・footnotes・groups（未知キー拒否）",
    S03: "version は仕様のバージョン文字列で、実装がサポートする minor 以下である",
    S04: "page は { width, height }（number・未知キー拒否）",
    S05: "font は { name }（string・未知キー拒否）",
    S06: "elements は配列で、各要素はオブジェクトである",
    S07: "各要素の type が9種のいずれかである",
    S08t: "text の必須属性が揃い、各属性の型が正しい",
    S08l: "line の必須属性が揃い、各属性の型が正しい",
    S08r: "rect の必須属性が揃い、各属性の型が正しい",
    S08e: "ellipse の必須属性が揃い、各属性の型が正しい",
    S08b: "table の必須属性が揃い、各属性の型が正しい",
    S08i: "image の必須属性が揃い、各属性の型が正しい",
    S08f: "flex の必須属性が揃い、各属性の型が正しい",
    S08p: "pageNumber の必須属性が揃い、各属性の型が正しい",
    S08c: "barcode の必須属性が揃い、各属性の型が正しい",
    S09: "要素・Column に未知の属性がない",
    S10: "enum 値が定義域内である",
    S12: "image の src が data URI 構文に一致する",
    S13: "flex の children は配列で、各子は table 以外の要素である",
    S14: "styles は配列で、各要素は name（string）と attrs（定義済みキーのみ・型が正しいオブジェクト）からなる",
    S15: "groups は配列で、各要素は id（string）と memberIds（string の配列）からなる（未知キー拒否）",
    M01: "id が識別子パターンに一致し、flex の子孫を含む文書内で一意である",
    M02: "全要素が用紙内に収まる",
    M03: "寸法が正である（gap・rect / ellipse の borderWidth のみ 0 以上）",
    M04: "fontSize・lineHeight が許容範囲内である",
    M05: "page の width・height が許容範囲内である",
    M06: "table の columns が1個以上で、key が table 内で一意である",
    M07: "table の bind・columns[].key が識別子パターンに一致する",
    M08: "image の src の mediatype が対応形式で、base64 payload がデコード可能である",
    M09: "table のページ領域が成立する",
    M10: "minRows が0以上の整数である",
    M11: "flex の children が1個以上である",
    M12: "flex の主軸寸法（明示時）が内容寸法以上である",
    M13: "cellOverrides の row が0以上の整数で、key が columns[].key のいずれかであり、(row, key) が table 内で一意である",
    M14: "styles の各定義の name が非空・64文字以下・文書内一意であり、attrs が1フィールド以上で各値が許容範囲内である",
    M15: "要素（flex の子孫を含む）の style が styles 内に存在する name を指す",
    M16: "色属性（line.color、rect / ellipse の borderColor・fillColor、table.stripeColor）が #rrggbb 形式である",
    M17: "rect の cornerRadius が 0 以上 min(w, h) / 2 以下であり、0 より大きい場合は borderStyle が solid（省略含む）である",
    M18: "要素（flex の子孫を含む）の name（指定時）が64文字以下である",
    M19: "要素（flex の子孫を含む）の rotate（指定時）が有限の number で −360 以上 360 以下である",
    M20: 'cellSpans の row が0以上の整数または "header"、key が columns[].key のいずれか、rowSpan・colSpan が1以上の整数で少なくとも一方が2以上、結合範囲が列範囲に収まり、"header" 行では rowSpan が1であり、結合範囲同士が table 内で重ならず、mergeSameValue が true の列に掛からない',
    C01: "text の text・barcode の value 内の {key} トークンのキーがデータに存在し、値が string である（キー欠落は警告、値が string でない場合はエラー）",
    C02: "table の bind キーがデータに存在し、値がオブジェクト配列で全行が全 columns[].key に string 値を持つ（キー欠落は警告、値・形が不正な場合はエラー）",
    C03: "2ページ以上に展開される表は文書内で同時に1つまでである",
    C04: "展開後の総ページ数が上限以下である",
    Q01: "docType が qualifiedInvoice の文書に、適格請求書の記載事項に対応する差し込み欄（text の {key} または table の列キー）が揃っている（欠落は警告）",
    F01: "footnotes は { x, w, bottom, fontSize, lineHeight, pages, notes } のオブジェクトで、各属性の型が正しく、未知キーがない。notes は { id, text }（string・未知キー拒否）の配列",
    F02: "notes[].id が識別子パターンに一致し、footnotes 内で一意である",
    F03: "トップレベル text 内の {#id} マークが notes[].id のいずれかを参照している",
    F04: "{#id} マークはトップレベル text 要素の text にのみ書ける。flex 子孫の text・table の columns[].label / cellOverrides[].value・pageNumber の format・notes[].text 内のマークはエラー",
    F05: "すべての note が少なくとも1つのマークから参照されている",
    F06: "footnotes の x/w/bottom が 0 以上、fontSize・lineHeight が M04 と同じ許容範囲内、注記ブロックが用紙内に収まる（x + w ≤ page.width かつ 自動計算 y ≥ 0）",
  } satisfies Record<IrRuleId, string>,
  compat: {
    pdfme: {
      textElement:
        "文字の折り返しや配置は出力先によらず同じになります。ボックスの高さに文字が収まりきらないときの表示だけ、出力先によってわずかに異なることがあります。",
      textUnderline:
        "下線の位置や太さは出力先によってわずかに異なることがあります。",
      lineThickness:
        "線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
      lineStrokeStyle:
        "破線・点線は短い実線をつなげた形で表示されます。間隔や開始位置が出力先によってわずかに変わることがあります。",
      rectBorderWidth:
        "枠線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
      rectBorderStyle:
        "四角形の破線・点線の枠は、4辺をそれぞれ短い線に分けて表示されるため、角で模様がつながらないことがあります。",
      tableElement:
        "表の行がページをまたぐときの分割は書き出し時に確定するため、正しく出力されます。セル内の文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
      tableFrameWidth:
        "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
      tableGridWidth:
        "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
      tableFrameStyle:
        "表の外枠を破線・点線にすると、角の部分で破線の模様がつながらないことがあります。",
      tableGridStyle:
        "表の中の罫線を破線・点線にすると、破線の間隔が出力先によってわずかに変わることがあります。",
      pageNumberElement:
        "ページ番号は書き出し時に確定した文字列に変換されるため、正しく出力されます。文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
      barcodeElement:
        "バーコードは指定した幅・高さに収まるように表示されます。バーの太さや余白などの細部は出力先によってわずかに変わることがあります。入力した値がバーコードの規格（チェックデジット等）に合っているかどうかは確認されません。",
    },
    reportlab: {
      textElement:
        "文字の折り返しや配置は出力先によらず同じになります。ボックスの高さに文字が収まりきらないときの表示だけ、出力先によってわずかに異なることがあります。",
      textUnderline:
        "下線の位置や太さは出力先によってわずかに異なることがあります。",
      lineThickness:
        "線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
      rectBorderWidth:
        "枠線の太さの分だけ、線が基準位置のどちら側にずれて見えるかが出力先によって変わることがあります。",
      tableElement:
        "表の行がページをまたぐときの分割は書き出し時に確定するため、正しく出力されます。セル内の文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
      tableFrameWidth:
        "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
      tableGridWidth:
        "罫線を太くしたとき、太さが線のどちら側に広がるかは出力先によってわずかに異なることがあります。",
      imageSrc:
        "画像を出力するには、生成された Python スクリプトの実行環境に Pillow というライブラリのインストールが必要です。PNG 画像を表示するには、その Pillow が PNG に対応している必要があります。",
      pageNumberElement:
        "ページ番号は書き出し時に確定した文字列に変換されるため、正しく出力されます。文字の表示は通常の文字と同じ扱いで、高さに収まりきらないときの表示だけ出力先によってわずかに異なることがあります。",
      barcodeElement:
        "バーコードは指定した幅・高さに収まるように表示されます。バーの太さや余白などの細部は出力先によってわずかに変わることがあります。入力した値がバーコードの規格（チェックデジット等）に合っているかどうかは確認されません。ただし EAN-13 は、12桁で入力するとチェックデジットが自動的に補われます。",
    },
  },
};

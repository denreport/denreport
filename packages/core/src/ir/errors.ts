/**
 * Identifier of an IR validation rule. Prefixes group rules by concern: S
 * (JSON syntax, checked by parseIr), M (semantic, checked by validateIr), C
 * (data binding, checked by analyzeData/validateData), Q (qualified invoice,
 * checked by checkQualifiedInvoice), and F (footnotes, checked by validateIr).
 */
export type IrRuleId =
  | "S01"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08t"
  | "S08l"
  | "S08r"
  | "S08e"
  | "S08b"
  | "S08i"
  | "S08f"
  | "S08p"
  | "S08c"
  | "S09"
  | "S10"
  | "S12"
  | "S13"
  | "S14"
  | "M01"
  | "M02"
  | "M03"
  | "M04"
  | "M05"
  | "M06"
  | "M07"
  | "M08"
  | "M09"
  | "M10"
  | "M11"
  | "M12"
  | "M13"
  | "M14"
  | "M15"
  | "M16"
  | "M17"
  | "M18"
  | "C01"
  | "C02"
  | "C03"
  | "C04"
  | "Q01"
  | "F01"
  | "F02"
  | "F03"
  | "F04"
  | "F05"
  | "F06";

/**
 * A single validation failure: which rule was violated, a JSON-pointer-like
 * `path` into the document where it occurred, and a human-readable `message`.
 */
export interface IrError {
  readonly rule: IrRuleId;
  readonly path: string;
  readonly message: string;
}

export const IR_RULES: Readonly<Record<IrRuleId, string>> = {
  S01: "入力が JSON として構文解析できる",
  S02: "ルートはオブジェクトで、必須キーは version/page/font/elements の4つ、任意キーは docType・footnotes（未知キー拒否）",
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
};

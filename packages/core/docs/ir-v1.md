# IR v1 仕様

IR（Intermediate Representation）は、帳票レイアウトを表す単一の JSON 文書である。
デザイナーが保存形式として書き出し、書き出し器が入力として受け取る。IR 自体は
データ（差し込み値）を含まない。データは書き出し時・プレビュー時に別の JSON として結合する。

## 1. トップレベル構造

```json
{
  "version": "1.1",
  "page": { "width": 210, "height": 297 },
  "font": { "name": "NotoSansJP" },
  "styles": [ ... ],
  "elements": [ ... ]
}
```

- `version` — IR 仕様のバージョン（3節）。
- `page` — 用紙（2節）。全ページ共通の寸法。文書のページ数は IR 単体では確定せず、
  データ結合時に表の展開で決まる（4.3節）。
- `footnotes` — 脚注（任意。3.10節）。
- `font` — 文書全体で使う論理フォント名。`font: { name: string }`。`name` は `id` と同じ
  識別子パターン。文書全体で1フォント（要素単位のフォント切替は非対応）。ファイルパス・
  バイナリは IR に含めない。論理名から実フォントへの解決・埋め込み・形式検証は
  書き出し器側の責務であり、本仕様の検証には含まれない。
- `styles` — 任意。名前付きスタイルの定義（3.9節）。省略時は名前付きスタイルを使わない文書。
- `elements` — 要素の配列。空配列は妥当（白紙の帳票）。配列順が描画順（後の要素が上に
  描かれる。同一ページ内の規則。flex の子はコンテナの位置に子の並び順で入る）。重なりは
  許可する。各要素のページ割当は `pages` 属性（2.1節）で表す。
- `docType` — 任意属性。値は `"qualifiedInvoice"` のみ。文書を適格請求書として宣言し、
  Q01（6節）の記載事項チェックを有効にする。省略時はキー自体を持たない。書き出し
  （pdfme・ReportLab）・互換性検証には一切影響しない、検証専用のメタデータ。

## 2. 座標系

- 原点は各ページの左上。x は右へ、y は下へ増加する。
- 長さの単位はすべて mm（JSON の number、小数可）。属性名に単位接尾辞（`widthMm` 等）は
  付けず、単位は本仕様で一元定義する。唯一の例外は `fontSize` と `lineHeight` で、`fontSize` は
  pt（DTP ポイント、1pt = 0.352778mm）、`lineHeight` は無次元倍率。
- 用紙は `page: { width, height }`（mm）。プリセット名（"A4" 等）は持たない。寸法のみを正とする。
  縦横の区別も width/height の値で表現する。
- ターゲット固有の座標系（PDF 系の左下原点・pt 等）への変換は書き出し器の責務。
- **テキストのベースライン（規範）**: text / pageNumber（および表から展開される text 相当。
  5.3節）の行 i（0始まり）のベースラインは、要素上端 `y` から

  ```
  (ascender / unitsPerEm + (lineHeight − 1) / 2 + i × lineHeight) × fontSize
  ```

  （pt。mm への換算は 1pt = 0.352778mm）だけ下に置く。`ascender` は解決された実フォントの
  hhea テーブル（horizontal header）の ascender、`unitsPerEm` は head テーブル（font header）の
  unitsPerEm（フォント内部のテーブルの定義は OpenType 仕様
  https://learn.microsoft.com/en-us/typography/opentype/spec/hhea ・
  https://learn.microsoft.com/en-us/typography/opentype/spec/head を参照）。
  第1項が em 単位のアセント（ベースラインから行上端までの距離）、第2項はフォントサイズを
  超える行送り分（leading）を行の上下に半分ずつ配る half-leading、第3項が行送り
  （`lineHeight × fontSize`）である。この式は書き出し器の近似裁量ではなく規範であり、
  同一の実フォントを与えたすべてのターゲットで初行位置・行送りが一致する。行 i は
  `\n` の単純分割ではなく、2.1節の折り返し後の行を指す。

### 2.1 テキストの折り返し・行頭禁則（規範）

text / pageNumber（および table のヘッダ・明細セル。5.3節）の内容は、実効幅
`widthPt = 実効幅mm × 72 / 25.4` に基づき次の手順で行に分割する。実効幅は text /
pageNumber が `w`、table のヘッダ・明細セルが `column.width − 2 × TABLE_CELL_PADDING_X`。

1. `content` を `\n` で段落に分割する（空段落は空行として保持する）。
2. 段落内をコードポイント単位で貪欲に詰める。行が非空で、次の1文字を加えると行の実測幅
   （実フォントの advance の合算 × `fontSize`）が実効幅を超えるとき、その文字の前で改行する。
   文字単位の折り返しであり、欧文の単語境界は考慮しない。
3. 行頭禁則（追い出し）: 新しい行の先頭が禁則文字（下記）のとき、直前行の末尾1文字を
   新しい行の先頭へ送る。送った結果まだ先頭が禁則文字なら繰り返す。ただし直前行は最低
   1文字残す（残り1文字になったら打ち切り、禁則違反のまま許容する）。

行頭禁則の対象文字（固定・カスタマイズ不可）: `、 。 ， ． ） ｝ ］ 」 』 】 〕 〉 》 ｡ ､ ｣ , . ) ] }`。
行末禁則・ぶら下げ組版・字間圧縮による追い込みは本仕様の対象外。行の縦方向のはみ出し
（行数 × 行送りが `h` を超える場合）はこれまでどおり規定しない。

### 2.2 均等割付（`align: "justify"`）

`align` が `"justify"` の text / pageNumber / table 列は、2.1節の手順で得た各行
（最終行・唯一行を含む）について、行内の全コードポイント間へ均等な字間を加え、行の実測幅を
実効幅に一致させる。字間 `charSpacePt = (widthPt − lineWidthPt) / (n − 1)`（n = 行の
コードポイント数）。`n < 2`、または行の実測幅が実効幅以上の場合は字間 `0`（圧縮しない）。

## 3. 要素型

要素は9種: `text` / `line` / `rect` / `ellipse` / `table` / `image` / `flex` / `pageNumber` / `barcode`。

### 3.1 共通属性

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `type` | `"text" \| "line" \| "rect" \| "ellipse" \| "table" \| "image" \| "flex" \| "pageNumber"` | 必須 | 要素型 |
| `id` | string | 必須 | 文書内で一意（flex の子孫を含む）。パターン `^[A-Za-z_][A-Za-z0-9_]*$`、64文字以内 |
| `x`, `y` | number | 必須※ | 要素の左上（線は基準点）。mm（2節）。※flex の子は持たない（位置はコンテナが決める。3.7節） |
| `pages` | `"first" \| "rest" \| "last" \| "all"` | 任意 | 配置先ページ。first=1ページ目のみ / rest=2ページ目以降 / last=最終ページのみ / all=全ページ（フッタ等の共通領域）。デフォルトは `"first"`（**pageNumber のみ `"all"`**）。**table は持たない**（常に1ページ目起点で流し込み）。flex の子も持たない（コンテナから継承） |

### 3.2 text — テキスト（`{key}` による差し込み対応）

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 占有領域（mm）。先頭行の上端が `y` |
| `text` | string | 必須 | — | 文字列。`\n` で改行。`{key}` トークン（下記）を含められる |
| `fontSize` | number | 任意 | `10` | pt。mm ではない点に注意（2節） |
| `align` | `"left" \| "center" \| "right" \| "justify"` | 任意 | `"left"` | 水平揃え。`"justify"` は均等割付（2.2節） |
| `lineHeight` | number | 任意 | `1.25` | 行送り倍率 |
| `style` | string | 任意 | — | 名前付きスタイル（3.9節）への参照 |

折り返し・行頭禁則は2.1節、均等割付は2.2節の規範に従う。領域からの縦方向のはみ出し時の
挙動は本仕様では規定しない。行のベースライン位置は2節の規範式（実フォントの計量に基づく）で
一意に定まる。

`text` は `{key}` トークン（`key` は `id` と同じ識別子パターン、64文字以内）を
1個以上含められ、データ結合時（5節）にそのキーの値へ置換される（部分差し込み）。
トークンに一致しない `{`（識別子でない・65文字以上など）はリテラル文字として残る。
エスケープ構文はなく、`{{key}}` は内側の `{key}` がトークンとして展開されるため
`{値}` になる。置換は1パスのみで、データ値の中の `{key}` 形の文字列は再展開しない。

### 3.3 line — 直線（水平・垂直のみ）

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | 必須 | — | 方向 |
| `length` | number | 必須 | — | 線の長さ（mm）。horizontal は +x 方向、vertical は +y 方向へ伸びる |
| `thickness` | number | 任意 | `0.3` | 太さ（mm） |
| `style` | string | 任意 | — | 名前付きスタイル（3.9節）への参照 |

斜め線は非対応。太さ分の塗りが基準線のどちら側に付くかはターゲット近似を許容し規定しない。

### 3.4 rect — 矩形（枠線のみ、塗りつぶし無し）

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 幅・高さ（mm） |
| `borderWidth` | number | 任意 | `0.3` | 枠線の太さ（mm） |
| `style` | string | 任意 | — | 名前付きスタイル（3.9節）への参照 |

### 3.5 table — 可変明細の表（複数ページに分割可）

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `bind` | string | 必須 | — | 行データ（オブジェクト配列）のキー（5.2節） |
| `columns` | Column[] | 必須（1個以上） | — | 列定義。順に左から配置 |
| `rowHeight` | number | 必須 | — | 明細1行の高さ（mm）。行高は固定（内容で伸びない） |
| `headerHeight` | number | 必須 | — | ヘッダ行の高さ（mm） |
| `fontSize` | number | 任意 | `10` | pt。ヘッダ・明細共通 |
| `maxY` | number | 任意 | `page.height` | 各ページで行を置ける領域の下端（mm）。これを超える行は次ページへ送る（5.3節） |
| `continuationY` | number | 任意 | `table.y` | 2ページ目以降（継続ページ）の表上端（ヘッダの上端）。継続ページではヘッダを再表示する |
| `minRows` | number | 任意 | `0` | 表示する最低行数（0以上の整数）。データ行数が少ない場合は空行で埋めて N 行の枠を描く（5.3節） |
| `style` | string | 任意 | — | 名前付きスタイル（3.9節）への参照 |

Column:

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `key` | string | 必須 | — | 行オブジェクトのキー。パターンは `id` と同じ。table 内で一意 |
| `label` | string | 必須 | — | ヘッダ表示文字列（任意の文字列。日本語可） |
| `width` | number | 必須 | — | 列幅（mm） |
| `align` | `"left" \| "center" \| "right" \| "justify"` | 任意 | `"left"` | 明細セルの揃え（ヘッダは常に center。5.3節） |

表の幅は Σ列幅から導出し、属性としては持たない。表の高さ・ページ数は行数に依存するため
IR 単体では確定せず、データ結合時に決まる（5.3節）。明細が `maxY` を超える場合はエラーでは
なく改ページする。行の途中分割はせず、ヘッダは各ページで再表示する。罫線の太さ・セル内余白は
仕様定数（5.3節）とし、属性にしない。

### 3.6 image — 画像

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 描画領域（mm） |
| `src` | string | 必須 | — | data URI（`data:image/png;base64,...` または `data:image/jpeg;base64,...`）のみ |

外部 URL・相対パスは非対応（検証エラー）。描画は領域 `w × h` へ引き伸ばし（アスペクト比保持なし）。

### 3.7 flex — 子要素を逐次配置するコンテナ

絶対座標と並ぶもう一つの配置方式。コンテナ自体は絶対座標（`x`, `y`）で置き、子の位置は
コンテナが計算する（子は `x`・`y`・`pages` を持たない）。

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `direction` | `"row" \| "column"` | 必須 | — | 主軸方向。row=横並び、column=縦積み |
| `w` | number | 任意※ | —（導出） | ※`direction: "row"` のみ。主軸（横）寸法の明示（mm）。余白（justifyContent の配置対象）を定義する。column では持てない |
| `h` | number | 任意※ | —（導出） | ※`direction: "column"` のみ。主軸（縦）寸法の明示（mm）。row では持てない |
| `gap` | number | 任意 | `0` | 子の間隔（mm、0以上） |
| `justifyContent` | `"start" \| "center" \| "end"` | 任意 | `"start"` | 主軸方向の配置。余白は明示した主軸寸法からのみ生じる（省略時は余白ゼロで全値同結果） |
| `alignItems` | `"start" \| "center" \| "end"` | 任意 | `"start"` | 交差軸の揃え |
| `children` | Element[] | 必須（1個以上） | — | 子要素。table 以外の要素（text / line / rect / ellipse / image / pageNumber / flex）。入れ子可 |

**幾何解決（規範）**: flex はデータに依存しない純幾何としてコンパイル前に絶対座標へ解決する。
子の内容（テキスト実測）に依存する寸法は存在しない — 子の占有寸法は常に明示された属性から決まる。

- 子 i の占有寸法 `(w_i, h_i)`: text / rect / image / pageNumber = `(w, h)`、
  line horizontal = `(length, 0)`・vertical = `(0, length)`（太さは寸法に算入しない）、
  入れ子の flex = 下記の導出寸法（深さ優先で解決）。
- 主軸の内容寸法 `C = Σ(子の主軸寸法) + gap×(k−1)`（子 k 個）。主軸寸法 `L` = 明示値
  （row の `w` / column の `h`。省略時は `L = C`）。主軸オフセット `o` は justifyContent により
  start → `0` / center → `(L − C)/2` / end → `L − C`（主軸寸法の明示時は `L ≥ C`、つまり `o ≥ 0`
  を要求する検証規則がある）。
- `direction: "column"`: コンテナの箱は幅 `W = max(w_i)`（交差軸は常に導出）× 高さ `L`。
  子 i の上端 `y_i = flex.y + o + Σ_{j<i}(h_j + gap)`。左端は alignItems により
  start → `flex.x` / center → `flex.x + (W − w_i)/2` / end → `flex.x + W − w_i`。
- `direction: "row"` は対称: 箱は幅 `L` × 高さ `H = max(h_i)`、
  子 i の左端 `x_i = flex.x + o + Σ_{j<i}(w_j + gap)`、上端は alignItems で同様に決める。
- 解決後、子は `pages` をコンテナから継承し、描画順はコンテナの配列位置に子の並び順で展開する。
- 用紙内判定はコンテナの箱（主軸 `L` × 交差軸導出）で行う。子の箱は常にコンテナの箱に
  含まれるため、子の個別判定は不要。

grow / stretch / wrap / padding / space-between 等の均等配置は非対応。コンテナの寸法は主軸のみ
明示できる。交差軸の寸法は常に子から導出し、属性として持たない。

### 3.8 pageNumber — ページ番号（n / N）

現在ページ番号と総ページ数を表示する要素。内容はコンパイル時展開で確定文字列に置換される。

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 占有領域（mm） |
| `format` | string | 任意 | `"{n} / {N}"` | 表示書式。`{n}`=現在ページ番号（1始まり）、`{N}`=総ページ数に置換。その他の文字は字義どおり |
| `fontSize` | number | 任意 | `10` | pt |
| `align` | `"left" \| "center" \| "right" \| "justify"` | 任意 | `"left"` | 水平揃え。`"justify"` は均等割付（2.2節） |
| `lineHeight` | number | 任意 | `1.25` | 行送り倍率 |
| `style` | string | 任意 | — | 名前付きスタイル（3.9節）への参照 |

`pages` のデフォルトが `"all"` である点だけ他要素と異なる。全ページフッタは
「`pages: "all"` の pageNumber / text / line」の組で表現し、専用のヘッダ・フッタ領域
オブジェクトは持たない。

### 3.9 名前付きスタイル（styles）

文書ルートの `styles` は書式属性の組に名前を付けて定義する配列。要素の `style` 属性
（3.2〜3.5, 3.8節）はこの `name` への参照。

```json
{
  "styles": [
    { "name": "見出し", "attrs": { "fontSize": 14, "align": "center" } }
  ]
}
```

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | 必須 | 表示名。非空・64文字以内・文書内で一意（識別子パターンは課さない） |
| `attrs` | object | 必須（1フィールド以上） | `fontSize` / `align` / `lineHeight` / `borderWidth` / `thickness` の部分集合。各値の型・許容範囲は3節の対応する要素属性と同じ |

`attrs` のうち要素型に該当しない属性（例: `borderWidth` を持つスタイルを `text` へ
参照させる）は本仕様上は許容し、意味の解釈（どの属性を実際に反映するか）は書き出し器・
編集器側の責務とする。IR の検証（6節）は `style` が `styles` 内の既存の `name` を
指すことのみを保証し、参照先の属性が要素側の具体値へどう反映されるかは規定しない
（要素側の具体値属性が常に描画・書き出しの唯一の正であり、`styles` 自体は書き出しに
は関与しない）。

### 3.10 footnotes — 脚注（ルート任意キー、要素ではない）

トップレベル（フラット配列直下、flex の子孫を除く）の text 要素内に書いた参照マーク
`{#id}` を出現順に自動採番し、`*n` 形式の静的テキストへ置換したうえで、対応する注記を
1つのテキストブロックとしてページ下部へ自動配置する。要素ではなく `IrDocument` の
ルート任意キーであり、`elements` 配列には含まれない。

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `x` | number | 必須 | 注記ブロック左端（mm） |
| `w` | number | 必須 | 注記ブロック幅（mm） |
| `bottom` | number | 必須 | ページ下端から注記ブロック下端までの距離（mm） |
| `fontSize` | number | 必須 | pt |
| `lineHeight` | number | 必須 | `fontSize` に対する行送り倍率 |
| `pages` | `"first" \| "rest" \| "last" \| "all"` | 必須 | 注記ブロックを描画するページ |
| `notes` | `{ id: string, text: string }[]` | 必須 | 注記本文。`text` の `\n` は明示改行。空配列可（ブロック非生成） |

全属性が必須で、デフォルト値は持たない（補完はデザイナー層の責務。parse は補完しない）。

**マーク記法**: `{#id}`（`#` + 識別子）。既存の差し込みトークン `{key}`（先頭文字は
`[A-Za-z_]` 限定、3.2節）とは構文レベルで衝突しない。マークが書けるのはトップレベルの
text 要素の `text` のみで、flex 子孫の text・table の `columns[].label` /
`cellOverrides[].value`・pageNumber の `format`・`notes[].text` 内のマークは検証エラーになる
（6節 F04）。表の明細行（実行時データ・cellOverrides）に書かれたマーク文字列は IR の外の
値であり、検証対象にならない。

**解決（コンパイル時展開。規範）**: `document.elements` の配列順に、各トップレベル text の
`text` を先頭から走査し、`{#id}` の初出順に `1, 2, 3…` を採番する（同じ id の再出現は初出
番号を再利用する）。各マークを `*n` に置換する。参照された注記を番号昇順に `*n 本文` の行
として連結し（注記本文内の `\n` はそのまま行になる。2行目以降にプレフィックスは付けない）、
1つの text 要素として `elements` 末尾に追加する: `{ type: "text", id: "apxFootnotes", x, y,
pages, w, h, text: 連結結果, fontSize, align: "left", lineHeight }`（`x`/`w`/`pages`/
`fontSize`/`lineHeight` は `footnotes` の値をそのまま使う）。ブロックの `y` は
`page.height − bottom − blockHeight` で自動計算し、`blockHeight = 総行数 × fontSize ×
lineHeight × PT_TO_MM`（`PT_TO_MM = 25.4 / 72`）とする。この解決は `footnotes` を持たない・
`notes` が空・マークが1つも参照を持たない場合は何もしない（ブロックを追加しない）。解決後の
文書は `footnotes` キーを持たず、既存の text 要素だけで構成されるため、`lowerIr`（pdfme 側）・
ReportLab 側のいずれも脚注固有の分岐を持たずに追随する。注記本文内の `{key}` トークンは、
解決後の text 要素が通常のデータ差し込み経路（5節）に乗るため自然に展開される。

### 3.11 barcode — バーコード・QRコード

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 描画領域（mm） |
| `symbology` | `"qrcode" \| "code39" \| "code128" \| "ean13"` | 必須 | — | 規格 |
| `value` | string | 必須 | — | 符号化する値。`{key}` トークン（3.2節と同一文法）を含められる |

描画は領域 `w × h` へ引き伸ばし（アスペクト比保持なし。image と同じ）。バー太さ・
クワイエットゾーン・人間可読文字（`ean13` のみ表示）の細部は本仕様が規定せず、
ターゲットの描画に従う。`value` が `symbology` の規格に適合するか（チェックデジット・
文字種・桁数）は本仕様の検証範囲外で、利用側の責務とする。

### 3.12 ellipse — 楕円

| 属性 | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `w`, `h` | number | 必須 | — | 外接する領域の幅・高さ（mm） |
| `borderWidth` | number | 必須 | — | 枠線の太さ（mm） |

領域（`x`, `y` 起点、`w` × `h`）に内接する楕円を描く。`style`（3.9節）は参照できない。

## 4. バージョン番号と後方互換の方針

### 4.1 表現

- トップレベル必須属性 `version` に文字列 `"<major>.<minor>"` を持つ。v1 の初版は `"1.0"`。
- minor の増分 = 後方互換な追加のみ（任意属性の追加、要素型の追加、enum 値の追加）。
  既存文書の意味を変えない。
- major の増分 = 非互換変更（必須属性の追加、意味の変更、削除）。v1 の実装は
  major 2 以上の文書を読まない。
- `"1.1"`（現行の `IR_VERSION`）は `styles`（任意ルートキー）・要素の `style`（任意属性、
  3.9節）・`barcode` 要素（3.11節）を後方互換な追加として導入した minor。
  `"1.0"` の既存文書はそのまま妥当。

### 4.2 読み込み側の規則

- 実装は自分がサポートする minor（`IR_VERSION`）以下の v1 文書を受理する。
- 自分より新しい minor（例: 実装が 1.0 で文書が 1.1）は明示エラーで拒否する。
  前方互換（未知属性の黙殺）は保証しない。

### 4.3 v1 で保証すること・しないこと

保証する:

- v1.0 として妥当な文書は、将来のすべての v1.x 実装で妥当であり、意味が変わらない。
- 検証規則（6節）の規則 ID は v1 系列内で安定（規則の追加はあっても、既存 ID の意味変更はしない）。
- 複数ページの展開結果（ページ数・各ページの要素配置）は5.3節の参照意味論で
  ターゲット非依存に一意に決まる。
- テキストの初行位置・行送り: 行のベースラインは2節の規範式（実フォントの hhea ascender と
  head unitsPerEm に基づく）で一意に決まり、同一の実フォントを与えたすべてのターゲットで一致する。
- テキストの折り返し・行頭禁則・均等割付の字間: 2.1節・2.2節の規範式で一意に決まり、
  同一の実フォントを与えたすべてのターゲットで行分割・字間が一致する。

保証しない:

- 前方互換（古い実装で新しい minor の文書を読むこと）。
- ターゲット間のピクセル同一性。保証するのは5.3節の参照意味論と2節のベースライン規範の
  レベルの同等性まで（グリフのラスタライズ・字形処理の差は残る）。
- テキストの縦方向のはみ出し・線の太さの塗り位置など、本仕様が「規定しない」と
  明記した挙動。
- ページ概念を持たないターゲットでの複数ページ意味論の再現。

将来の要素追加は「要素型の追加 = minor 増分」の経路で入れる。v1 の実装が知らない
要素型は4.2節の規則により（version が上がっているため）拒否される。

## 5. データ差し込み（bind）・可変明細・複数ページ

### 5.1 データの形

データは IR とは別の JSON オブジェクト（トップレベルはオブジェクト）。

- `text` の `text`・`barcode` の `value` 内の `{key}` トークンのキーの値は string で
  なければならない。数値・日付の書式整形はデータを作る側の責務とし、IR は書式機能を持たない。
- `table.bind` のキーの値はオブジェクトの配列。各行オブジェクトは、その table の
  全 `columns[].key` に対して string 値を持たなければならない。行数 n が `minRows` 未満でも
  妥当（不足分は空行として表示する。5.3節）。
- ネストしたパス参照（`"a.b"`・配列添字）は非対応。トップレベルキーのみ。
- キーがデータに存在しない場合は警告とし、text/barcode は空文字列・table は空配列（=
  `minRows` 分の空行）で補完して書き出しを続行する。値の型・形が不正な場合
  （string でない、配列でない、行が dict でない、列値が string でない）はエラーとし
  書き出しを止める（6節 C 群）。

### 5.2 コンパイル時展開（lowering）

table 要素は IR 上では宣言的に保持し、データ結合時に text / line / rect の組へ展開
（lowering）してからターゲットへ渡す。この前提は複数ページにも及ぶ: 表の分割（改ページ）・
要素のページ割当・pageNumber の確定も lowering の責務とし、ターゲットの表機能・自動改ページ・
ページ番号機構は使わない。ターゲットに要求する能力は「複数ページにわたる基本図形
（text / line / rect / image）の絶対座標描画」だけになる。

書き出しにはデータ（少なくとも行数を決めるサンプルデータ）が必要になる（ページ数もデータで
決まる）。生成物を静的展開にするか「データを受け取ってループする関数」として生成するかは
書き出し器の設計判断に委ねる。IR 仕様が規定するのは、任意の行データに対して出力が5.3節の
参照意味論と一致すること、のみである。

### 5.3 参照展開意味論（規範）

文書とデータが与えられたとき、展開結果は以下の手順の出力と幾何的に一致しなければならない。

**(1) flex 解決** — 3.7節の規則で flex コンテナを絶対座標の子要素列に置換する（データ非依存）。

**(2) 表示行数とページ数の決定** — 各 table について:

- 表示行数 `m = max(n, minRows)`（n = bind されたデータの行数）。行番号 `t ≥ n` の行は
  空行（全セルが空文字列）。
- 先頭ページの行容量 `k_first = floor((maxY − y − headerHeight) / rowHeight)`、
  継続ページの行容量 `k_cont = floor((maxY − continuationY − headerHeight) / rowHeight)`。
  検証規則により `k_first ≥ 1`・`k_cont ≥ 1` が保証される。
- その表の必要ページ数 `P = 1`（`m ≤ k_first` のとき。m = 0 ならヘッダのみで P = 1）、
  それ以外は `P = 1 + ceil((m − k_first) / k_cont)`。

文書の総ページ数 `N = max(1, 各 table の P の最大値)`。`P ≥ 2` の表が2つ以上あればエラー、
`N` が上限を超えればエラー（6節 C 群）。

**(3) ページ割当** — table 以外の各要素（flex 解決後）を `pages` に従い割り当てる:
first → 1ページ目 / rest → 2〜Nページ目（N=1 なら出力なし）/ last → Nページ目
（N=1 なら1ページ目）/ all → 全ページ。要素の座標はどのページでも同一（用紙は全ページ同寸）。
table のチャンク p（1..P）は p ページ目に置く（表は常に1ページ目起点）。

**(4) 表の分割幾何** — チャンク p の行数 `c_p`: `c_1 = min(m, k_first)`、
以降は残り行数と `k_cont` の小さい方。チャンク p のページ内トップ
`Y0 = table.y`（p=1）/ `continuationY`（p≥2）。各チャンクは「ヘッダ + c_p 行」として、
以下の単一チャンク幾何を適用する。定数（仕様定数。属性化しない）:

| 定数 | 値 | 意味 |
|---|---|---|
| `TABLE_CELL_PADDING_X` | 1.5 mm | セル文字の左右余白 |
| `TABLE_HEADER_TEXT_OFFSET_Y` | 1.8 mm | ヘッダ文字の上端オフセット |
| `TABLE_CELL_TEXT_OFFSET_Y` | 2.0 mm | 明細文字の上端オフセット |
| `TABLE_FRAME_WIDTH` | 0.4 mm | 外枠の線太さ |
| `TABLE_GRID_WIDTH` | 0.25 mm | 内部罫線の太さ |

列 i（0始まり）の左端 `X_i = table.x + Σ_{j<i} columns[j].width`、
表の幅 `W = Σ columns[].width`、チャンクの高さ `H_p = headerHeight + c_p × rowHeight` として:

- ヘッダセル文字: 各列 i に text 相当
  （x=`X_i + PADDING_X`, y=`Y0 + HEADER_TEXT_OFFSET_Y`, w=`width_i − 2×PADDING_X`,
  h=`headerHeight − HEADER_TEXT_OFFSET_Y`, fontSize=`table.fontSize`, align=`center`,
  lineHeight=`1.25`（text 要素のデフォルトと同値）, 内容=`columns[i].label`）。各チャンクで再表示する。
- 明細セル文字: チャンク内 q 行目（0始まり。通し行番号 t）・列 i に text 相当
  （y=`Y0 + headerHeight + q×rowHeight + CELL_TEXT_OFFSET_Y`,
  h=`rowHeight − CELL_TEXT_OFFSET_Y`, align=`columns[i].align`,
  内容=行 t のデータの `columns[i].key` の値。x, w, fontSize, lineHeight はヘッダと同じ）。
  空行（t ≥ n）のセルは文字要素を生成しない（罫線・枠は生成する）。
- 外枠: rect 相当（x=`table.x`, y=`Y0`, w=`W`, h=`H_p`, borderWidth=`FRAME_WIDTH`）。
- 水平罫線: q = 0 .. c_p−1 に line 相当
  （orientation=horizontal, x=`table.x`, y=`Y0 + headerHeight + q×rowHeight`,
  length=`W`, thickness=`GRID_WIDTH`）。q=0 がヘッダ下線。チャンクの底辺は外枠が兼ねる。
- 垂直罫線: i = 1 .. 列数−1 に line 相当
  （orientation=vertical, x=`X_i`, y=`Y0`, length=`H_p`, thickness=`GRID_WIDTH`）。

行の途中分割はしない（行は丸ごと次チャンクへ送る）。

**(5) pageNumber の置換** — 割り当てられた各ページ p で text 相当
（同じ x/y/w/h/fontSize/align/lineHeight、内容 = `format` 中の `{n}` を p、`{N}` を N で
置換した文字列。その他の文字は字義どおり）。

各ページ内の描画順は `elements` 配列の元の順序を保つ（表のチャンクは table の配列位置、
flex の子はコンテナの配列位置に入る）。チャンク内部の描画順は、外枠 → 水平罫線（q 昇順）→
垂直罫線（i 昇順）→ ヘッダセル文字（列順）→ 明細セル文字（行順、行内は列順）とする
（セル文字が罫線より上に描かれる）。展開後要素の id 命名は書き出し器の規約とし、
本仕様では規定しない。

## 6. 検証規則

検証は3層に分ける。

- **S 群（構文検証）**: JSON の形が仕様に合うか。
- **M 群（意味検証）**: 形は正しいが意味が壊れている文書を弾く。
- **C 群（データ結合時検証）**: IR 単体では判定できない、データに依存する規則。書き出し器側で実施する。
- **F 群（脚注）**: `footnotes`（3.10節）専用の検証。F01 は構文層（S 群相当）、F02〜F06 は
  意味層（M 群相当）。独立したプレフィックスとし、S/M 群の番号を消費しない。

エラーは `{ rule, path, message }`（rule = 下表の ID、path = 違反箇所の JSON パス、
例 `elements[3].fontSize`）で報告する。1回の検証で検出できる違反はすべて列挙する
（最初の1件で打ち切らない）。規則 ID は本仕様の一部であり、v1 系列内で安定する。

### S 群（構文）

| ID | 規則 |
|---|---|
| S01 | 入力が JSON として構文解析できる |
| S02 | ルートはオブジェクトで、キーは `version` `page` `font` `elements` の4つが必須、`styles` `docType` `footnotes` が任意（それ以外の未知キー拒否） |
| S03 | `version` は `^1\.(0\|[1-9][0-9]*)$` に一致する文字列で、minor が実装のサポート値以下。major ≠ 1 または新しすぎる minor は専用メッセージで拒否 |
| S04 | `page` は `{ width, height }`（両方 number・未知キー拒否） |
| S05 | `font` は `{ name }`（string・未知キー拒否） |
| S06 | `elements` は配列で、各要素はオブジェクト |
| S07 | 各要素の `type` が9種のいずれか |
| S08 | 要素型ごとの必須属性が揃い、各属性の型が正しい（型ごとに個別の規則: S08t, S08l, S08r, S08e, S08b, S08i, S08f, S08p, S08c。text/line/rect/table/pageNumber の任意属性 `style` の型検証もここに含む） |
| S09 | 要素・Column に未知の属性がない（table の `pages`、flex の子の `x`/`y`/`pages`、flex の交差軸寸法＝row の `h` / column の `w`、image/flex の `style` も未知属性として拒否） |
| S10 | enum 値が定義域内（`align`, `orientation`, `direction`, `justifyContent`, `alignItems`, `pages`, `symbology`） |
| S12 | image の `src` が data URI 構文（`data:<mediatype>;base64,<payload>`）に一致する |
| S13 | flex の `children` は配列で、各子は table 以外の要素オブジェクト（入れ子の flex を含め再帰的に S 群を適用する） |
| S14 | `styles` は配列で、各要素は `name`（string）と `attrs`（定義済みキーのみ・値の型が正しいオブジェクト。`align` の enum 判定を含む）からなる（3.9節） |

S11 は欠番（かつて text の `text`/`bind` 排他を定義していたが、`bind` の廃止に伴い規則ごと削除し、
番号は再割当しない）。text の `bind` は S09（未知の属性）で拒否され、メッセージが
`{key}` トークンへの移行を案内する。

S 群通過後、任意属性のデフォルト（3節の各表。`maxY = page.height`・`continuationY = table.y` の
文書依存デフォルトも具体値で埋める。flex の主軸寸法 `w`/`h` は省略時も埋めない）を適用した
正規化済み文書を返す。

### M 群（意味）

| ID | 規則 |
|---|---|
| M01 | `id` が識別子パターン（3.1節）に一致し、flex の子孫を含む全要素で文書内一意 |
| M02 | 全要素が用紙内に収まる: `x ≥ 0`, `y ≥ 0`, `x + 幅 ≤ page.width`, `y + 高さ ≤ page.height`。幅・高さは text/rect/ellipse/image/pageNumber/barcode = `w`/`h`、line = orientation に応じ `length`（太さ方向は基準線のみで判定）、flex = 3.7節の箱（主軸寸法を明示した場合はその値。子はコンテナの箱に含まれるため個別判定しない）、table = 幅 `Σ列幅`（縦方向のページ領域は M09） |
| M03 | 寸法が正: `w`, `h`（flex の明示主軸寸法＝row の `w` / column の `h`、barcode の `w`/`h` を含む）, `length`, `thickness`, `borderWidth`, `rowHeight`, `headerHeight`, `columns[].width` はすべて `> 0`。`gap` のみ `≥ 0`（間隔ゼロの密着を許す）。M03 は「正であること」のみを見る — flex 主軸寸法と内容寸法の比較は M12 の責務 |
| M04 | `fontSize` は `0 < fontSize ≤ 200`（pt）、`lineHeight` は `0 < lineHeight ≤ 5` |
| M05 | `page.width`, `page.height` は `1 ≤ 値 ≤ 5000`（mm） |
| M06 | table の `columns` は1個以上、`key` は table 内で一意 |
| M07 | `font.name`・table の `bind`・`columns[].key` が識別子パターンに一致する |
| M08 | image の `src` の mediatype が `image/png` または `image/jpeg` で、base64 payload がデコード可能 |
| M09 | table のページ領域が成立する: `continuationY ≥ 0`、`maxY ≤ page.height`、`table.y + headerHeight + rowHeight ≤ maxY`、`continuationY + headerHeight + rowHeight ≤ maxY`（先頭・継続の各ページに最低1行入る） |
| M10 | `minRows` は0以上の整数 |
| M11 | flex の `children` は1個以上 |
| M12 | flex の主軸寸法を明示した場合（row の `w` / column の `h`）、その値が内容寸法 `C`（子の主軸寸法の合計 + `gap`×(子数−1)。3.7節）以上 |
| M14 | `styles` の各定義: `name` が非空・64文字以内・文書内一意、`attrs` が1フィールド以上で、各値が対応する要素属性と同じ許容範囲（`fontSize`/`lineHeight` は M04 と同じ範囲、`borderWidth`/`thickness` は `> 0`） |
| M15 | 要素（flex の子孫を含む）の `style` が `styles` 内に存在する `name` を指す |

### C 群（データ結合時。実装は書き出し器側）

| ID | 規則 |
|---|---|
| C01 | text の `text`・barcode の `value` 内の `{key}` トークンのキーがデータに存在し、値が string。キー欠落は警告（空文字列で補完）、値が string でない場合はエラー |
| C02 | table の `bind` キーがデータに存在し、値がオブジェクト配列で、全行が全 `columns[].key` に string 値を持つ。`bind` キー欠落は警告（空配列で補完）、値・形が不正な場合はエラー |
| C03 | 2ページ以上に展開される表（P ≥ 2。5.3節）は文書内で同時に1つまで。複数の表が同時にページを跨いだらエラー |
| C04 | 展開後の総ページ数 N が `PAGE_COUNT_MAX`（`1000`）以下 |

フォント形式（TTF/CFF）の検証は IR 検証に含めない。IR はフォントの論理名しか持たず、
形式はターゲット依存の制約であるため。

### Q 群（文書種別チェック。実装は `checkQualifiedInvoice`、`validateIr` とは別関数）

| ID | 規則 |
|---|---|
| Q01 | `docType` が `qualifiedInvoice` の文書に、適格請求書の記載事項に対応する差し込み欄（text の `{key}` または table の列キー）が揃っている |

`validateIr` の「空配列 = 合格」の契約とは別枠で、`checkQualifiedInvoice(document)` が
警告（非ブロック）として返す。`docType` が無い文書には走らない（常に空配列）。

「配置されている」の判定は、文書内の text 要素（flex 子孫を含む）の `{key}` トークン、
または table の `columns[].key` にキーが現れることで行う。`table.bind`（配列名）と
`cellOverrides`（固定表示値）は差し込み欄ではないため対象外。

国税庁の記載必要6項目それぞれに「充足キー（いずれか1つで充足）」を定義する。
項目4（適用税率）は帳票上「10%」等の静的文言で書かれるのが通例のため、税率別の
対価の額の欄で代表させる。

| # | 記載事項 | 充足キー（いずれか） |
|---|---|---|
| 1 | 発行者の登録番号 | `registrationNumber` |
| 2 | 取引年月日 | `issueDate`, `transactionDate` |
| 3 | 取引内容 | `description`, `itemName` |
| 4 | 税率ごとに区分した対価の額・適用税率 | `taxableAmount`, `taxableAmount8`, `taxableAmount10` |
| 5 | 税率ごとに区分した消費税額等 | `taxAmount`, `taxAmount8`, `taxAmount10` |
| 6 | 交付を受ける事業者の氏名又は名称 | `customerName` |

### F 群（脚注）

| ID | 規則 |
|---|---|
| F01 | `footnotes` は `{ x, w, bottom, fontSize, lineHeight, pages, notes }` のオブジェクトで、各属性の型が正しく、未知キーがない。`notes` は `{ id, text }`（string・未知キー拒否）の配列 |
| F02 | `notes[].id` が識別子パターンに一致し、`footnotes` 内で一意である |
| F03 | トップレベル text 内の `{#id}` マークが `notes[].id` のいずれかを参照している |
| F04 | `{#id}` マークはトップレベル text 要素の `text` にのみ書ける。flex 子孫の text・table の `columns[].label` / `cellOverrides[].value`・pageNumber の `format`・`notes[].text` 内のマークはエラー |
| F05 | すべての note が少なくとも1つのマークから参照されている |
| F06 | `footnotes` の `x`/`w`/`bottom` が0以上、`fontSize`・`lineHeight` が M04 と同じ許容範囲内、注記ブロックが用紙内に収まる（`x + w ≤ page.width` かつ自動計算 `y ≥ 0`） |

## 7. 公開 TypeScript インターフェース

```ts
// types.ts
export const IR_VERSION: "1.1";
export type IrAlign = "left" | "center" | "right" | "justify";
export type IrOrientation = "horizontal" | "vertical";
export type IrPages = "first" | "rest" | "last" | "all";
export type IrFlexDirection = "row" | "column";
export type IrFlexAlign = "start" | "center" | "end";
export type IrDocType = "qualifiedInvoice";
export interface IrPage { readonly width: number; readonly height: number }
export interface IrFont { readonly name: string }
export interface IrColumn {
  readonly key: string; readonly label: string;
  readonly width: number; readonly align: IrAlign;   // 正規化後はデフォルト適用済み
}
export interface IrStyleAttrs {
  readonly fontSize?: number; readonly align?: IrAlign; readonly lineHeight?: number;
  readonly borderWidth?: number; readonly thickness?: number;
}
export type StyleAttrKey = keyof IrStyleAttrs;
export interface IrNamedStyle { readonly name: string; readonly attrs: IrStyleAttrs }
export type IrElement =
  | IrTextElement | IrLineElement | IrRectElement | IrEllipseElement | IrTableElement
  | IrImageElement | IrFlexElement | IrPageNumberElement | IrBarcodeElement;
// 各 Ir*Element は3節の属性表どおり（正規化後は pages 等のデフォルト適用済み。
// table は maxY / continuationY / minRows が具体値）。text.text は必須（string）
export type IrBarcodeSymbology = "qrcode" | "code39" | "code128" | "ean13";
export interface IrBarcodeElement {
  readonly type: "barcode";
  readonly id: string;
  readonly x: number; readonly y: number;
  readonly pages: IrPages;
  readonly w: number; readonly h: number;
  readonly symbology: IrBarcodeSymbology;
  readonly value: string;                  // {key} トークン可（text.text と同一文法）
}
export interface IrFlexElement {
  readonly type: "flex";
  readonly id: string;
  readonly x: number; readonly y: number;
  readonly pages: IrPages;
  readonly direction: IrFlexDirection;
  readonly w?: number;                     // row の主軸寸法（明示時のみ。column では S09 が拒否）
  readonly h?: number;                     // column の主軸寸法（明示時のみ。row では S09 が拒否）
  readonly gap: number;
  readonly justifyContent: IrFlexAlign;    // 主軸配置。正規化後はデフォルト "start" 適用済み
  readonly alignItems: IrFlexAlign;
  readonly children: readonly IrFlexChild[];
}
// flex の子 = x / y / pages を持たない要素（位置はコンテナが計算し、pages は継承）
export type IrFlexChild =
  | Omit<IrTextElement, "x" | "y" | "pages">
  | Omit<IrLineElement, "x" | "y" | "pages">
  | Omit<IrRectElement, "x" | "y" | "pages">
  | Omit<IrEllipseElement, "x" | "y" | "pages">
  | Omit<IrImageElement, "x" | "y" | "pages">
  | Omit<IrPageNumberElement, "x" | "y" | "pages">
  | Omit<IrFlexElement, "x" | "y" | "pages">
  | Omit<IrBarcodeElement, "x" | "y" | "pages">;
export interface IrPageNumberElement {
  readonly type: "pageNumber";
  readonly id: string;
  readonly x: number; readonly y: number;
  readonly pages: IrPages;                 // デフォルトのみ "all"（3.1節）
  readonly w: number; readonly h: number;
  readonly format: string;
  readonly fontSize: number; readonly align: IrAlign; readonly lineHeight: number;
}
export interface IrFootnoteNote { readonly id: string; readonly text: string }
export interface IrFootnotes {
  readonly x: number; readonly w: number; readonly bottom: number;
  readonly fontSize: number; readonly lineHeight: number; readonly pages: IrPages;
  readonly notes: readonly IrFootnoteNote[];
}
export interface IrDocument {
  readonly version: string;
  readonly page: IrPage;
  readonly font: IrFont;
  readonly styles?: readonly IrNamedStyle[];
  readonly elements: readonly IrElement[];
  readonly docType?: IrDocType;            // 任意。"qualifiedInvoice" のみ（6節 Q群）
  readonly footnotes?: IrFootnotes;         // 任意（3.10節）。全属性必須・デフォルト補完なし
}

// errors.ts
export type IrRuleId = "S01" | /* ... */ | "S14" | "M01" | /* ... */ | "M17" | "C01" | "C02" | "C03" | "C04" | "Q01"
  | "F01" | "F02" | "F03" | "F04" | "F05" | "F06";
export interface IrError { readonly rule: IrRuleId; readonly path: string; readonly message: string }

// parse.ts
export type ParseIrResult =
  | { readonly ok: true; readonly document: IrDocument }
  | { readonly ok: false; readonly errors: readonly IrError[] };
export function parseIr(json: string): ParseIrResult;

// flex.ts — 3.7節の幾何解決。純関数・データ非依存。
// 返り値は flex を含まない要素列（x/y 確定済み・pages 継承済み・元の描画順）。
// validateIr（M02）が内部で使い、デザイナーと書き出し器も同じ結果を共用する
export type IrPlacedElement = Exclude<IrElement, IrFlexElement>;
export function resolveFlex(document: IrDocument): readonly IrPlacedElement[];

// styles.ts — style 対象属性の唯一の語彙定義（3.9節）
export const STYLEABLE_ATTRS: Readonly<Record<IrElementType, readonly StyleAttrKey[]>>;
export function applicableStyleAttrs(type: IrElementType): readonly StyleAttrKey[];

// footnotes.ts — 3.10節の脚注解決。純関数・データ非依存。前提: parseIr の出力で validateIr 合格。
// footnotes キーを除去した文書を返す（マーク置換済み・注記ブロックの text 要素を追加済み）
export function resolveFootnotes(document: IrDocument): IrDocument;

// validate.ts — 空配列 = 合格。呼び出し順は parseIr → validateIr
export function validateIr(document: IrDocument): readonly IrError[];

// invoice.ts — validateIr とは別関数。docType が無い文書には走らず常に空配列
export function checkQualifiedInvoice(document: IrDocument): readonly IrError[];

// text-layout.ts — 2.1節・2.2節の折り返し・行頭禁則・均等割付字間の唯一の実装。純関数。
// 字幅の実測（フォントファイル読み取り）は呼び出し側（書き出し器）の責務
export type CharWidthEm = (codePoint: number) => number;
export interface TextLayoutInput {
  readonly content: string; readonly widthMm: number;
  readonly fontSize: number; readonly align: IrAlign;
}
export interface LaidOutLine {
  readonly text: string; readonly charSpacePt: number; // align !== "justify" では常に 0
}
export function layoutTextLines(
  input: TextLayoutInput, charWidthEm: CharWidthEm,
): readonly LaidOutLine[];
export const LINE_HEAD_PROHIBITED: string; // 2.1節の禁則文字集合
```

## 8. 請求書 IR の例（抜粋）

v1 の語彙で書いた A4 請求書の骨子。発行者情報は flex（縦積み、主軸 20mm に中央配置）、
明細は最低10行の枠を持ち `maxY = 240` で改ページ、合計欄は最終ページのみ、ページ番号は全ページフッタ。

```json
{
  "version": "1.0",
  "page": { "width": 210, "height": 297 },
  "font": { "name": "NotoSansJP" },
  "elements": [
    { "type": "text", "id": "title", "text": "{title}", "x": 0, "y": 18, "w": 210, "h": 12, "fontSize": 22, "align": "center" },
    { "type": "flex", "id": "issuerBlock", "x": 130, "y": 40, "direction": "column", "h": 20, "justifyContent": "center", "gap": 1.5,
      "children": [
        { "type": "text", "id": "issuerName", "text": "株式会社サンプル", "w": 60, "h": 6, "fontSize": 11 },
        { "type": "text", "id": "issuerAddr", "text": "{issuerAddr}", "w": 60, "h": 10, "fontSize": 9 }
      ]
    },
    { "type": "line", "id": "customerUnderline", "orientation": "horizontal", "x": 15, "y": 49, "length": 90, "thickness": 0.4 },
    { "type": "table", "id": "items", "bind": "items", "x": 15, "y": 90, "rowHeight": 9, "headerHeight": 9, "fontSize": 10,
      "maxY": 240, "continuationY": 30, "minRows": 10,
      "columns": [
        { "key": "name", "label": "品目", "width": 90 },
        { "key": "amount", "label": "金額(税抜)", "width": 35, "align": "right" }
      ]
    },
    { "type": "text", "id": "totalLabel", "text": "合計(税込)", "x": 110, "y": 250, "w": 40, "h": 8, "fontSize": 12, "pages": "last" },
    { "type": "rect", "id": "totalBox", "x": 108, "y": 247, "w": 89, "h": 12, "borderWidth": 0.5, "pages": "last" },
    { "type": "pageNumber", "id": "pageNo", "x": 0, "y": 285, "w": 210, "h": 6, "fontSize": 9, "align": "center" }
  ]
}
```

合計欄（`pages: "last"`）を表領域の下端 `maxY` より下（y ≥ 240）に置くことで、最終ページの
明細行と重ならないことが幾何的に保証される（行は maxY を超えないため）。

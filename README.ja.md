# denReport

English README: [README.md](README.md)

denreport（デンレポート）は、帳票（請求書・納品書・領収書など）をブラウザ上で
デザインするためのツールです。特定のPDFライブラリの独自テンプレート形式には
縛られず、オープンなJSON形式の中間表現（IR）を軸に据えています。レイアウトは
一度作れば、[pdfme](https://pdfme.com/) と Python の
[ReportLab](https://www.reportlab.com/) という2つの書き出し先に対応できます。

denreport はブラウザ内で完結して動作します。サーバー側の仕組みやアカウントは
なく、デザイナー・IR・書き出し器のすべてがクライアントサイドで動くため、
作成した帳票のレイアウトやデータが手元の環境から出ることはありません。

## 現時点でできること

denreport はまだ 1.0 未満で、開発中です。現時点で実装済みの機能は次のとおりです。

- **ビジュアルデザイナー**: テキスト・線・矩形・楕円・画像・バーコード/QRコード、
  複数ページに分割される表の配置に加え、行/列レイアウト用の flex コンテナを、
  絶対座標のキャンバス上で編集できます。
- **日本語組版の基礎**: 実際に書き出しへ使うフォントそのものを編集画面に埋め込み
  （文字の計量が書き出し結果と一致する）、日本語テキストの折り返しに対応した
  行頭禁則処理、均等割付での揃えに対応しています。
- **適格請求書の記載チェック**: 文書を適格請求書（インボイス）として指定した場合に、
  法律で求められる記載事項が揃っているかをデザイナーの検証パネルで確認できます。
  必須記載事項をすべて満たすテンプレートを
  [`examples/qualified-invoice.json`](examples/qualified-invoice.json) に同梱して
  おり、デザイナーの「開く」ボタンから読み込めます。
- **オープンな IR**: バージョン管理されたJSON文書形式
  （[仕様](packages/core/docs/ir-v1.ja.md)）に、パーサと検証機能が付属します。
  レイアウトが denreport 自体にロックインされません。
- **2つの書き出し先**: pdfme 用のテンプレート＋入力データ（JSON）と、
  フォント同梱・単体で動く ReportLab の Python コードの両方を、同じ IR 文書から
  生成できます。
- **互換性警告**: 書き出す前に、選択した書き出し先で近似される（または非対応の）
  部分を教えます。出力した PDF を開いてから気づくのではなく、デザインの時点で
  わかります。

ここに挙げた機能はすべて無料のオープンソースです。

## パッケージ構成

pnpm によるモノレポで、パッケージ3つとアプリ1つで構成されます。

| パッケージ | 内容 |
|---|---|
| [`@denreport/core`](packages/core) | IR の仕様・パーサ・検証機能。UI や描画は持ちません |
| [`@denreport/targets`](packages/targets) | IR から pdfme / ReportLab への書き出し器と互換性マトリクス |
| [`@denreport/designer`](packages/designer) | ブラウザ上の編集 UI。小さな `Designer` クラスで組み込めます |
| [`apps/web`](apps/web) | 本リポジトリを実行すると得られるリファレンスアプリ |

すべてのパッケージが MIT ライセンスです。

いずれも npm にはまだ公開していません。配布物のビルド基盤は整備済みです
（`pnpm run build:packages`）が、公開自体はまだ行っていません。現時点では
レジストリからのインストールではなく、本リポジトリをクローンしてソースから
ビルドして使ってください（後述のクイックスタート）。

## ライセンス FAQ

**自分のプロジェクトに denreport を無料で使えますか？**
はい。IR の仕様・パーサ・両方の書き出し器・デザイナー UI・リファレンスアプリの
すべてのパッケージが MIT ライセンスです。商用・非商用を問わず、MIT の表示義務
以外の制約なく使えます。

**書き出した PDF・テンプレート・生成コードに義務はありますか？**
出力そのものは利用者のものです。書き出した PDF ファイル（埋め込みフォントを
含みます。SIL Open Font License は「フォントで作成した文書には適用されない」と
明記しています）、pdfme テンプレート JSON、ReportLab 生成 Python コードに
表示義務・開示義務はなく、denreport も権利を主張しません。

1点だけ注意があります。ReportLab 書き出しはスクリプトが読み込むフォント
**ファイル**（TTF）も zip に同梱します。同梱の Noto Sans JP を使っている場合、
zip のルートに [`OFL.txt`](packages/targets/assets/fonts/OFL.txt) のコピーが
自動で入ります。これは OFL 第2条件（各コピーへのライセンス本文の同梱を
義務づける条件）を満たすためのもので、zip はそのまま第三者に渡せます。
フォントファイル単体を販売することはできません（OFL 第1条件）。自分で
登録したフォントの場合は OFL.txt は入らないため、そのフォントのライセンス
条件に従ってください。

**同梱フォントと書き出しターゲットのライセンスは？**
同梱フォントは Noto Sans JP の Regular と Bold（SIL Open Font License 1.1）で、
ライセンス文は
[`packages/targets/assets/fonts/OFL.txt`](packages/targets/assets/fonts/OFL.txt)
に同梱しています。書き出し先のライブラリも寛容ライセンスです:
[pdfme](https://github.com/pdfme/pdfme) は MIT、
[reportlab](https://www.reportlab.com/opensource/) は BSD 3-Clause、
Pillow（画像を描く生成コードが必要とします）は MIT-CMU です。いずれも
生成した文書に義務を課しません。

## クイックスタート

Node.js 24 以上と、[Corepack](https://nodejs.org/api/corepack.html) 経由の
[pnpm](https://pnpm.io/) が必要です。

```sh
git clone https://github.com/denreport/denreport.git
cd denreport
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
pnpm --filter @denreport/web dev
```

Vite の開発サーバーが起動するので、表示された URL を開いてください。

ビルドする場合:

```sh
pnpm --filter @denreport/web run build
```

ワークスペース全体の lint・型検査・テストを回す場合:

```sh
pnpm check
```

## デザイナーの組み込み

`@denreport/designer` はまだ npm に公開していないため、現時点ではレジストリ
経由のインストールではなく、pnpm ワークスペース内（またはソースからビルドした
パッケージ）から次のように使います。

```ts
import { Designer } from "@denreport/designer";
import "@denreport/designer/styles/tokens.css";
import "@denreport/designer/styles/app.css";

const designer = new Designer(document.getElementById("app")!);
```

IR 文書の読み込み・自動保存を含む完全な例は
[`apps/web/src/main.ts`](apps/web/src/main.ts) を参照してください。

## セルフホスト

denreport は、ビルド済みのデザイナーと小さな静的配信サーバーだけを含む単一の
Docker イメージとして配布されます。データベースも API も外部サービスも
持ちません。

```sh
docker run --rm -p 8080:8080 ghcr.io/denreport/denreport:latest
```

ブラウザで http://localhost:8080 を開いてください。デザイン・localStorage
への保存・pdfme や ReportLab への書き出しはすべてブラウザ内で完結し、
コンテナは静的ファイルを配信するだけで帳票データを受け取ることはありません。
イメージ自体には HTTPS 終端や認証の仕組みはないため、必要な場合は nginx や
Caddy などのリバースプロキシを前段に置いてください。

## ロードマップ

上記に加えて、より深い日本語組版機能（縦書き、外字など）、セルフホスト向けの
出力ランタイム、[`examples/`](examples) の適格請求書サンプルを超えた
より充実したテンプレート集を計画しています。いずれも現時点ではまだ存在せず、
実装され次第この README を更新します。

## コントリビュート

開発環境のセットアップ、チェックの回し方、コントリビューションに適用される
ライセンス条件は [CONTRIBUTING.md](CONTRIBUTING.md)（英語）を参照してください。

## 行動規範

本プロジェクトは [Contributor Covenant](CODE_OF_CONDUCT.md)（英語）に従います。

## セキュリティ

脆弱性の報告方法は [SECURITY.md](SECURITY.md)（英語）を参照してください。

## ライセンス

すべてのパッケージが MIT です。全文は [LICENSE](LICENSE) にあり、各パッケージの
`LICENSE` ファイルにも同じものが置かれています。実務上の意味は上記のライセンス
FAQ を参照してください。

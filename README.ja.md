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
- **オープンな IR**: バージョン管理されたJSON文書形式
  （[仕様](packages/core/docs/ir-v1.md)）に、パーサと検証機能が付属します。
  レイアウトが denreport 自体にロックインされません。
- **2つの書き出し先**: pdfme 用のテンプレート＋入力データ（JSON）と、
  フォント同梱・単体で動く ReportLab の Python コードの両方を、同じ IR 文書から
  生成できます。
- **互換性警告**: 書き出す前に、選択した書き出し先で近似される（または非対応の）
  部分を教えます。出力した PDF を開いてから気づくのではなく、デザインの時点で
  わかります。

ここに挙げた機能はすべて無料で使えます（有料プランは不要です）。

## パッケージ構成

pnpm によるモノレポで、パッケージ3つとアプリ1つで構成されます。

| パッケージ | ライセンス | 内容 |
|---|---|---|
| [`@denreport/core`](packages/core) | MIT | IR の仕様・パーサ・検証機能。UI や描画は持ちません |
| [`@denreport/targets`](packages/targets) | MIT | IR から pdfme / ReportLab への書き出し器と互換性マトリクス |
| [`@denreport/designer`](packages/designer) | AGPL-3.0-only または商用 | ブラウザ上の編集 UI。小さな `Designer` クラスで組み込めます |
| [`apps/web`](apps/web) | AGPL-3.0-only | 本リポジトリを実行すると得られるリファレンスアプリ |

いずれも npm にはまだ公開していません（公開は計画中で未着手です）。現時点では
レジストリからのインストールではなく、本リポジトリをクローンしてソースから
ビルドして使ってください（後述のクイックスタート）。

## ライセンス FAQ

**自分のプロジェクトに denreport を無料で使えますか？**
はい。IR の仕様・パーサ・両方の書き出し器にあたる `@denreport/core` と
`@denreport/targets` は MIT ライセンスです。商用・非商用を問わず、MIT の表示義務
以外の制約なく使えます。

**デザイナー UI はどうですか？**
`@denreport/designer` は AGPL-3.0-only です。セルフホストして、商用利用を含め
組織内で自由に使えます。AGPL-3.0 でソース開示が必要になるのは、それを組み込んだ
製品を配布したり、ネットワーク越しのサービスとして第三者に提供したりする場合
だけです。その場合は AGPL-3.0 に従って製品側のソースを互換ライセンスで開示する
か、その義務を外す商用ライセンスを選ぶかのどちらかになります。

**書き出した PDF・テンプレート・生成コードに義務はありますか？**
ありません。denreport が生成した PDF ファイル・pdfme テンプレート・ReportLab
生成コードはすべて利用者のものであり、表示義務も開示義務もありません。

**なぜデザイナーだけ AGPL で、core / targets は MIT なのですか？**
プログラムから依存したくなる部分（形式そのもの、パーサ、書き出し器）は制約なく
使えるようにし、他社製品への組み込み先になりうる編集 UI の部分で、継続開発の
原資を得る構成にしています。

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
出力ランタイム、既製テンプレート集を計画しています。これらの一部は、無料の
デザイナーとは別に有料プランでの提供を予定していますが、現時点ではまだ存在せず、
実装され次第この README を更新します。

## コントリビュート

開発環境のセットアップ、チェックの回し方、コントリビューションに適用される
ライセンス条件は [CONTRIBUTING.md](CONTRIBUTING.md)（英語）を参照してください。

## 行動規範

本プロジェクトは [Contributor Covenant](CODE_OF_CONDUCT.md)（英語）に従います。

## セキュリティ

脆弱性の報告方法は [SECURITY.md](SECURITY.md)（英語）を参照してください。

## ライセンス

`packages/core` と `packages/targets` は MIT、`packages/designer` と
`apps/web` は AGPL-3.0-only（または商用）です。全文は
[LICENSE-MIT](LICENSE-MIT) と [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0) にあり、
各パッケージの `LICENSE` ファイルにどちらが適用されるかが書かれています。
実務上の意味は上記のライセンス FAQ を参照してください。

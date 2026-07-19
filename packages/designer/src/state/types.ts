import type { IrDocument, IrError } from "@denreport/core";
import type { EnvelopePresetId } from "./envelope-presets";
import type { RegisteredFont } from "./fonts";
import type { ElementGroup } from "./groups";
import type { CustomGuide } from "./guides";
import type { SampleScenarioSet } from "./sample-scenarios";

/** 編集ビューの文脈。IrPages の "all" は全文脈で表示される属性値であり、文脈ではない */
export type PageContext = "first" | "rest" | "last";

/** select: ドラッグは選択・移動・リサイズ。pan: ドラッグはビューポートのスクロール */
export type CanvasMode = "select" | "pan";

export interface EditorViewState {
  /** 1.0 = 100% */
  readonly zoom: number;
  readonly pageContext: PageContext;
  readonly snapEnabled: boolean;
  readonly gridVisible: boolean;
  readonly canvasMode: CanvasMode;
}

export interface EditorState {
  /** 正規化済み IR。文書の唯一の正 */
  readonly document: IrDocument;
  readonly selection: readonly string[];
  readonly view: EditorViewState;
  readonly validationErrors: readonly IrError[];
  /** docType が qualifiedInvoice の文書のみ非空。書き出し・プレビューはブロックしない */
  readonly validationWarnings: readonly IrError[];
  /** 最後の saveIr 以降に文書変更があるか */
  readonly dirty: boolean;
  /** サンプルデータのシナリオ一式。プレビュー専用。不正 JSON も編集の常態として保持し、
      文書・履歴・dirty とは独立に扱う */
  readonly sampleScenarios: SampleScenarioSet;
  /** セッション内に実データを取得済みのフォント（IR 識別子名 → 登録フォント）。
      文書・履歴・dirty とは独立（sampleData と同格）。永続化しない */
  readonly fontRegistry: ReadonlyMap<string, RegisteredFont>;
  /** 定規から作成した恒久ガイド。文書・履歴・dirty とは独立（sampleData と同格）。永続化しない */
  readonly customGuides: readonly CustomGuide[];
  /** 選択中の封筒窓プリセット。文書・履歴・dirty とは独立。永続化しない */
  readonly envelopePresetId: EnvelopePresetId | null;
  /** クリック1回で全メンバーを選択できる要素の束ね。文書・履歴・dirty とは独立
      （fontRegistry と同格。group/ungroup は commit しない）。saveIr は生存分を
      document.groups へ書き込んで直列化し、replaceDocument はそこから復元する */
  readonly groups: readonly ElementGroup[];
}

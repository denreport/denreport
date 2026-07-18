import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { RegisteredFont } from "../../state/fonts";
import { sanitizeFontName } from "../../state/fonts";
import { Dialog } from "../dialog/Dialog";
import type { FontIssue } from "./font-registration";
import { buildRegisteredFont, EMBEDDED_FONT_NAME } from "./font-registration";
import type { LocalFontCandidate } from "./local-fonts";
import { listLocalFonts } from "./local-fonts";

type ListState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly fonts: readonly LocalFontCandidate[] }
  | {
      readonly kind: "failed";
      readonly reason: "unsupported" | "denied" | "error";
    };

type ConfirmState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly issues: readonly FontIssue[] };

const REASON_MESSAGES: Readonly<
  Record<"unsupported" | "denied" | "error", string>
> = {
  unsupported:
    "お使いのブラウザは PC 内フォントの一覧取得に対応していません（Chromium 系ブラウザで利用できます）",
  denied:
    "フォントへのアクセスが許可されませんでした。ブラウザのサイト設定から許可できます",
  error: "フォント一覧を取得できませんでした。",
};

/** Dialog 部品（ui/dialog/Dialog.tsx）に載せる選択ダイアログ。
    一覧取得はマウント時に listLocalFonts（開くボタンのクリックがユーザー操作起点）。
    確定時に loadData → buildRegisteredFont を実行し、非 TTF は issues をダイアログ内に表示して閉じない */
export function FontSelectorDialog(props: {
  /** 現在の font.name（一覧内の該当行の選択状態表示に使う） */
  readonly currentName: string;
  /** 検証済みフォントで確定（呼び出し側が registerFont + setFontName の commit を行う） */
  readonly onSelect: (font: RegisteredFont) => void;
  /** 「同梱フォントに戻す」（呼び出し側が setFontName(EMBEDDED_FONT_NAME) を commit する） */
  readonly onSelectEmbedded: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { currentName, onSelect, onSelectEmbedded, onClose } = props;
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LocalFontCandidate | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "idle" });

  const load = (): void => {
    setList({ kind: "loading" });
    listLocalFonts(window).then((result) => {
      setList(
        result.ok
          ? { kind: "ready", fonts: result.fonts }
          : { kind: "failed", reason: result.reason },
      );
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時の1回だけ実行する。再試行はボタン操作で行う
  useEffect(() => {
    load();
  }, []);

  const filtered =
    list.kind === "ready"
      ? list.fonts.filter((font) => {
          const q = query.trim().toLowerCase();
          if (q === "") return true;
          return (
            font.fullName.toLowerCase().includes(q) ||
            font.family.toLowerCase().includes(q)
          );
        })
      : [];

  const confirmSelection = (): void => {
    if (selected === null) return;
    const candidate = selected;
    setConfirm({ kind: "loading" });
    candidate.loadData().then(
      (data) => {
        const built = buildRegisteredFont(data, {
          fullName: candidate.fullName,
        });
        if (!built.ok) {
          setConfirm({ kind: "failed", issues: built.issues });
          return;
        }
        onSelect(built.font);
      },
      () => {
        setConfirm({
          kind: "failed",
          issues: [
            {
              format: "unknown",
              message: "フォントデータを取得できませんでした。",
            },
          ],
        });
      },
    );
  };

  return (
    <Dialog
      title="PC のフォントから選択"
      onClose={onClose}
      footer={
        <>
          <span className="apx-dialog-note">
            選択したフォントは書き出し物に埋め込まれます。フォントのライセンスをご確認ください。
          </span>
          <button
            type="button"
            className="apx-btn apx-btn-secondary"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="apx-btn apx-btn-primary"
            disabled={selected === null || confirm.kind === "loading"}
            onClick={confirmSelection}
          >
            このフォントを使う
          </button>
        </>
      }
    >
      {list.kind === "loading" && <p>フォント一覧を取得しています…</p>}
      {list.kind === "failed" && (
        <div className="apx-font-notice" role="alert">
          <p>{REASON_MESSAGES[list.reason]}</p>
          {list.reason === "error" && (
            <button
              type="button"
              className="apx-btn apx-btn-secondary"
              onClick={load}
            >
              再試行
            </button>
          )}
        </div>
      )}
      {list.kind === "ready" && (
        <>
          <input
            type="search"
            className="apx-font-search"
            placeholder="フォント名で検索"
            aria-label="フォント名で検索"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <ul className="apx-font-list">
            <li>
              <button
                type="button"
                aria-pressed={
                  selected === null && currentName === EMBEDDED_FONT_NAME
                }
                className="apx-font-row"
                onClick={() => {
                  setSelected(null);
                  onSelectEmbedded();
                }}
              >
                同梱フォント（{EMBEDDED_FONT_NAME}）に戻す
              </button>
            </li>
            {filtered.map((font) => {
              const isCurrent =
                selected !== null
                  ? selected.postscriptName === font.postscriptName
                  : sanitizeFontName(font.fullName) === currentName;
              return (
                <li key={font.postscriptName}>
                  <button
                    type="button"
                    aria-pressed={isCurrent}
                    className="apx-font-row"
                    onClick={() => {
                      setSelected(font);
                      setConfirm({ kind: "idle" });
                    }}
                  >
                    <span className="apx-font-name">{font.fullName}</span>
                    <span className="apx-font-sub">
                      {font.family} / {font.style}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {confirm.kind === "failed" && (
        <div className="apx-font-notice" role="alert">
          {confirm.issues.map((issue, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 同一 format のエラーが並び得るため index で識別する
            <p key={i}>{issue.message}</p>
          ))}
        </div>
      )}
    </Dialog>
  );
}

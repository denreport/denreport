import type { IrFontSlot } from "@denreport/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMessages } from "../../i18n/context";
import type { RegisteredFont } from "../../state/fonts";
import { sanitizeFontName } from "../../state/fonts";
import { Dialog } from "../dialog/Dialog";
import type { FontIssue } from "./font-registration";
import {
  buildRegisteredFont,
  EMBEDDED_BOLD_FONT_NAME,
  EMBEDDED_FONT_NAME,
} from "./font-registration";
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

/** スロットに同梱フォントがある場合のみ、その論理名（「同梱フォントに戻す」行の表示対象） */
const EMBEDDED_NAME_BY_SLOT: Readonly<Partial<Record<IrFontSlot, string>>> = {
  regular: EMBEDDED_FONT_NAME,
  bold: EMBEDDED_BOLD_FONT_NAME,
};

/** Dialog 部品（ui/dialog/Dialog.tsx）に載せる、対象スロットのフォント選択ダイアログ。
    一覧取得はマウント時に listLocalFonts（開くボタンのクリックがユーザー操作起点）。
    確定時に loadData → buildRegisteredFont を実行し、非 TTF は issues をダイアログ内に表示して閉じない */
export function FontSelectorDialog(props: {
  /** 選択対象のスロット（同梱行の有無・「未設定に戻す」行の有無を決める） */
  readonly slot: IrFontSlot;
  /** スロットの現在の論理名（一覧内の該当行の選択状態表示に使う）。未設定スロットは undefined */
  readonly currentName: string | undefined;
  /** 検証済みフォントで確定（呼び出し側が registerFont + スロット setter の commit を行う） */
  readonly onSelect: (font: RegisteredFont) => void;
  /** 同梱フォントで確定。スロットに同梱フォントがある場合のみ行を表示する */
  readonly onSelectEmbedded: (name: string) => void;
  /** スロットを未設定に戻す。regular 以外のみ行を表示する */
  readonly onClear: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { slot, currentName, onSelect, onSelectEmbedded, onClear, onClose } =
    props;
  const m = useMessages();
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LocalFontCandidate | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({ kind: "idle" });
  const embeddedName = EMBEDDED_NAME_BY_SLOT[slot];

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
        const built = buildRegisteredFont(
          data,
          { fullName: candidate.fullName },
          m.fonts,
        );
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
              message: m.fonts.loadDataFailed,
            },
          ],
        });
      },
    );
  };

  return (
    <Dialog
      title={m.fonts.selectTitle(m.fonts.slotLabels[slot])}
      onClose={onClose}
      footer={
        <>
          <span className="apx-dialog-note">{m.fonts.licenseNote}</span>
          <button
            type="button"
            className="apx-btn apx-btn-secondary"
            onClick={onClose}
          >
            {m.fonts.cancel}
          </button>
          <button
            type="button"
            className="apx-btn apx-btn-primary"
            disabled={selected === null || confirm.kind === "loading"}
            onClick={confirmSelection}
          >
            {m.fonts.useThisFont}
          </button>
        </>
      }
    >
      <ul className="apx-font-list">
        {embeddedName !== undefined && (
          <li>
            <button
              type="button"
              aria-pressed={selected === null && currentName === embeddedName}
              className="apx-font-row"
              onClick={() => {
                setSelected(null);
                onSelectEmbedded(embeddedName);
              }}
            >
              {m.fonts.revertToEmbedded(embeddedName)}
            </button>
          </li>
        )}
        {slot !== "regular" && (
          <li>
            <button
              type="button"
              aria-pressed={selected === null && currentName === undefined}
              className="apx-font-row"
              onClick={() => {
                setSelected(null);
                onClear();
              }}
            >
              {m.fonts.clearToDefault}
            </button>
          </li>
        )}
      </ul>
      {list.kind === "loading" && <p>{m.fonts.loadingList}</p>}
      {list.kind === "failed" && (
        <div className="apx-font-notice" role="alert">
          <p>{m.fonts.reasons[list.reason]}</p>
          {list.reason === "error" && (
            <button
              type="button"
              className="apx-btn apx-btn-secondary"
              onClick={load}
            >
              {m.fonts.retry}
            </button>
          )}
        </div>
      )}
      {list.kind === "ready" && (
        <>
          <input
            type="search"
            className="apx-font-search"
            placeholder={m.fonts.searchPlaceholder}
            aria-label={m.fonts.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <ul className="apx-font-list">
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

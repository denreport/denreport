import type { IrFontSlot } from "@denreport/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLocale, useMessages } from "../../i18n/context";
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

/** The logical name of the bundled font, only when one exists for the slot (target of the
    "revert to bundled font" row) */
const EMBEDDED_NAME_BY_SLOT: Readonly<Partial<Record<IrFontSlot, string>>> = {
  regular: EMBEDDED_FONT_NAME,
  bold: EMBEDDED_BOLD_FONT_NAME,
};

/** Font selection dialog for the target slot, mounted on the Dialog component
    (ui/dialog/Dialog.tsx). The list is fetched via listLocalFonts on mount (the click of the
    opening button is the user-initiated action). On confirm, runs loadData -> buildRegisteredFont;
    non-TTF shows issues inside the dialog and does not close it */
export function FontSelectorDialog(props: {
  /** The target slot for selection (determines whether the bundled row and the "revert to
      unset" row are shown) */
  readonly slot: IrFontSlot;
  /** The slot's current logical name (used to show the selected state of the matching row in
      the list). undefined for an unset slot */
  readonly currentName: string | undefined;
  /** Confirm with a validated font (the caller performs registerFont + commits the slot setter) */
  readonly onSelect: (font: RegisteredFont) => void;
  /** Confirm with the bundled font. The row is shown only when the slot has a bundled font */
  readonly onSelectEmbedded: (name: string) => void;
  /** Revert the slot to unset. The row is shown only for slots other than regular */
  readonly onClear: () => void;
  readonly onClose: () => void;
}): ReactNode {
  const { slot, currentName, onSelect, onSelectEmbedded, onClear, onClose } =
    props;
  const m = useMessages();
  const locale = useLocale();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs exactly once on mount; retry is done via a button action
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
          locale,
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
            // biome-ignore lint/suspicious/noArrayIndexKey: errors with the same format can appear side by side, so identify by index
            <p key={i}>{issue.message}</p>
          ))}
        </div>
      )}
    </Dialog>
  );
}

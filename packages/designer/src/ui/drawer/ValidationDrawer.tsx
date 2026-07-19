import type { IrError } from "@denreport/core";
import { COMPAT_MATRICES, checkCompat } from "@denreport/core";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { errorElementIds } from "../../state/error-index";
import { groupCompatFindings } from "../../state/export-warnings";
import { layoutDocument, visibleInContext } from "../../state/geometry";
import type { EditorStore } from "../../state/store";
import { WarningGroupCard } from "../export/WarningGroupCard";
import { useEditorState } from "../useEditorState";

export function ValidationDrawer(props: {
  readonly store: EditorStore;
  /** 行クリック時、選択・文脈切替の後に呼ぶ */
  readonly onReveal: (id: string) => void;
}): ReactNode {
  const { store, onReveal } = props;
  const state = useEditorState(store);
  const [open, setOpen] = useState(false);
  const errors = state.validationErrors;
  const warnings = state.validationWarnings;
  const selection = new Set(state.selection);
  const compatGroups = useMemo(
    () =>
      groupCompatFindings(
        checkCompat(
          state.document,
          COMPAT_MATRICES[state.selectedExportTarget],
        ),
      ),
    [state.document, state.selectedExportTarget],
  );
  const compatFindingTotal = compatGroups.reduce(
    (total, group) => total + group.findingCount,
    0,
  );

  const rowId = (error: IrError): string | undefined => {
    const [id] = errorElementIds(state.document, [error]);
    return id;
  };

  const jumpTo = (id: string): void => {
    const current = store.getState();
    const view = layoutDocument(
      current.document,
      current.view.pageContext,
    ).find((v) => v.id === id);
    if (view === undefined) {
      return;
    }
    if (!visibleInContext(view.pages, current.view.pageContext)) {
      const pages = view.pages;
      if (pages !== null && pages !== "all") {
        store.setView({ pageContext: pages });
      }
    }
    store.setSelection([id]);
    onReveal(id);
  };

  const onRowClick = (error: IrError): void => {
    const [id] = errorElementIds(store.getState().document, [error]);
    // ルート・page の違反は要素に対応しない。文書設定はパネルの非選択状態で常に到達できる
    if (id === undefined) {
      return;
    }
    jumpTo(id);
  };

  const renderRow = (error: IrError, i: number, warn: boolean): ReactNode => {
    const id = rowId(error);
    const isSelected = id !== undefined && selection.has(id);
    return (
      <li key={i}>
        <button
          type="button"
          className={`apx-verr${warn ? " apx-verr-warn" : ""}${isSelected ? " is-selected" : ""}`}
          onClick={() => onRowClick(error)}
        >
          <span className="apx-verr-rule">{error.rule}</span>
          <span className="apx-verr-path">{error.path}</span>
          <span>{error.message}</span>
        </button>
      </li>
    );
  };

  return (
    <div className={`apx-drawer${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="apx-drawer-bar"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="apx-caret">{open ? "▾" : "▸"}</span>
        <span>検証</span>
        {errors.length > 0 ? (
          <span className="apx-badge apx-badge-err">{errors.length}</span>
        ) : warnings.length > 0 ? (
          <span className="apx-badge apx-badge-warn">{warnings.length}</span>
        ) : (
          <span className="apx-badge apx-badge-ok">✓ 問題なし</span>
        )}
      </button>
      {open && (
        <div className="apx-drawer-body">
          {errors.length === 0 && warnings.length === 0 ? (
            <div className="apx-drawer-empty">検証エラーはありません。</div>
          ) : (
            <>
              {errors.length > 0 && (
                <ul className="apx-verr-list">
                  {errors.map((error, i) => renderRow(error, i, false))}
                </ul>
              )}
              {warnings.length > 0 && (
                <ul className="apx-verr-list">
                  {warnings.map((warning, i) => renderRow(warning, i, true))}
                </ul>
              )}
            </>
          )}
          <div className="apx-export-warns apx-drawer-compat">
            <p className="apx-export-warns-h">
              <span>{`書き出し互換性（${COMPAT_MATRICES[state.selectedExportTarget].displayName}）`}</span>
              {compatFindingTotal > 0 && (
                <span className="apx-badge apx-badge-warn">
                  {compatFindingTotal}
                </span>
              )}
            </p>
            {compatGroups.length === 0 ? (
              <p className="apx-export-ok">
                ✓ 選択中のターゲットですべての要素を書き出せます。
              </p>
            ) : (
              compatGroups.map((group) => (
                <WarningGroupCard
                  key={`${group.level}:${group.userMessage}`}
                  group={group}
                  onJump={jumpTo}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

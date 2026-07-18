import type { IrError } from "@denreport/core";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { LoadIrResult } from "../../api/designer";
import { Dialog } from "../dialog/Dialog";

type FlowState =
  | { readonly kind: "idle" }
  | { readonly kind: "confirm" }
  | { readonly kind: "rejected"; readonly errors: readonly IrError[] }
  | { readonly kind: "read-failed" };

const IDLE: FlowState = { kind: "idle" };

export function OpenIrButton(props: {
  readonly dirty: boolean;
  readonly importIr: (json: string) => LoadIrResult;
}): ReactNode {
  const { dirty, importIr } = props;
  const [flow, setFlow] = useState<FlowState>(IDLE);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = (): void => {
    setFlow(IDLE);
    fileInput.current?.click();
  };

  const readFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importIr(reader.result as string);
      if (!result.ok) {
        setFlow({ kind: "rejected", errors: result.errors });
      }
    };
    reader.onerror = () => {
      setFlow({ kind: "read-failed" });
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button
        type="button"
        className="apx-btn apx-btn-secondary"
        onClick={() => {
          if (dirty) {
            setFlow({ kind: "confirm" });
          } else {
            pickFile();
          }
        }}
      >
        開く
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // 同じファイルを選び直しても change が発火するよう毎回リセットする
          event.currentTarget.value = "";
          if (file !== undefined) {
            readFile(file);
          }
        }}
      />
      {flow.kind === "confirm" && (
        <Dialog
          title="未保存の変更"
          onClose={() => setFlow(IDLE)}
          footer={
            <>
              <button
                type="button"
                className="apx-btn apx-btn-secondary"
                onClick={() => setFlow(IDLE)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="apx-btn apx-btn-primary"
                onClick={pickFile}
              >
                続行
              </button>
            </>
          }
        >
          <p>読み込むと未保存の変更は失われます。続行しますか？</p>
        </Dialog>
      )}
      {(flow.kind === "rejected" || flow.kind === "read-failed") && (
        <Dialog
          title="読み込めませんでした"
          onClose={() => setFlow(IDLE)}
          footer={
            <button
              type="button"
              className="apx-btn apx-btn-secondary"
              onClick={() => setFlow(IDLE)}
            >
              閉じる
            </button>
          }
        >
          {flow.kind === "read-failed" ? (
            <p>ファイルを読み取れませんでした。</p>
          ) : (
            <ul className="apx-dialog-errors">
              {flow.errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同一 rule / path のエラーが並び得るため index で識別する
                <li key={i}>
                  <span className="apx-verr-rule">{error.rule}</span>
                  <span className="apx-verr-path">{error.path}</span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="apx-dialog-note">文書は変更されていません。</p>
        </Dialog>
      )}
    </>
  );
}

import type { IrError } from "@denreport/core";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { LoadIrResult } from "../../api/designer.js";
import { useMessages } from "../../i18n/context.js";
import { Dialog } from "../dialog/Dialog.js";

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
  const m = useMessages();

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
        className="dr-btn dr-btn-secondary"
        onClick={() => {
          if (dirty) {
            setFlow({ kind: "confirm" });
          } else {
            pickFile();
          }
        }}
      >
        {m.toolbar.open}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Reset every time so that change fires even when the same file is picked again
          event.currentTarget.value = "";
          if (file !== undefined) {
            readFile(file);
          }
        }}
      />
      {flow.kind === "confirm" && (
        <Dialog
          title={m.toolbar.openIr.unsavedTitle}
          onClose={() => setFlow(IDLE)}
          footer={
            <>
              <button
                type="button"
                className="dr-btn dr-btn-secondary"
                onClick={() => setFlow(IDLE)}
              >
                {m.toolbar.openIr.cancel}
              </button>
              <button
                type="button"
                className="dr-btn dr-btn-primary"
                onClick={pickFile}
              >
                {m.toolbar.openIr.continue}
              </button>
            </>
          }
        >
          <p>{m.toolbar.openIr.unsavedBody}</p>
        </Dialog>
      )}
      {(flow.kind === "rejected" || flow.kind === "read-failed") && (
        <Dialog
          title={m.toolbar.openIr.failedTitle}
          onClose={() => setFlow(IDLE)}
          footer={
            <button
              type="button"
              className="dr-btn dr-btn-secondary"
              onClick={() => setFlow(IDLE)}
            >
              {m.toolbar.openIr.close}
            </button>
          }
        >
          {flow.kind === "read-failed" ? (
            <p>{m.toolbar.openIr.readFailed}</p>
          ) : (
            <ul className="dr-dialog-errors">
              {flow.errors.map((error, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: errors with the same rule / path can appear side by side, so identify by index
                <li key={i}>
                  <span className="dr-verr-rule">{error.rule}</span>
                  <span className="dr-verr-path">{error.path}</span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="dr-dialog-note">{m.toolbar.openIr.unchangedNote}</p>
        </Dialog>
      )}
    </>
  );
}

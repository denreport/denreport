import type { IrBarcodeSymbology } from "@denreport/core";
import type { ReactNode } from "react";
import { useMessages } from "../../i18n/context";
import { errorMessageFor } from "../../state/error-index";
import type { ElementFormProps } from "./ElementProperties";
import { commitReplace } from "./ElementProperties";
import { NumberField, SegmentField, TextField } from "./fields";

// QR/CODE39/CODE128/EAN13 are the standard names themselves, shared between ja/en
const SYMBOLOGY_OPTIONS: readonly {
  readonly value: IrBarcodeSymbology;
  readonly label: string;
}[] = [
  { value: "qrcode", label: "QR" },
  { value: "code39", label: "CODE39" },
  { value: "code128", label: "CODE128" },
  { value: "ean13", label: "EAN13" },
];

export function BarcodeProperties(props: ElementFormProps): ReactNode {
  const { store, view, errors, liveBox } = props;
  const el = view.element;
  const m = useMessages();
  if (el.type !== "barcode") {
    return null;
  }
  const w = liveBox === null ? el.w : liveBox.w;
  const h = liveBox === null ? el.h : liveBox.h;
  return (
    <>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.barcode.section}</div>
        <SegmentField
          label={m.properties.barcode.symbology}
          value={el.symbology}
          options={SYMBOLOGY_OPTIONS}
          onCommit={(symbology) =>
            commitReplace(store, el.id, { ...el, symbology })
          }
        />
        <TextField
          label={m.properties.barcode.value}
          value={el.value}
          mono
          error={errorMessageFor(errors, "value")}
          onCommit={(value) => commitReplace(store, el.id, { ...el, value })}
        />
      </section>
      <section className="apx-sect">
        <div className="apx-sect-h">{m.properties.placement}</div>
        {"x" in el && (
          <>
            <NumberField
              label="x"
              value={liveBox === null ? el.x : liveBox.x}
              unit="mm"
              precision={0.1}
              error={errorMessageFor(errors, "x")}
              onCommit={(x) => commitReplace(store, el.id, { ...el, x })}
            />
            <NumberField
              label="y"
              value={liveBox === null ? el.y : liveBox.y}
              unit="mm"
              precision={0.1}
              error={errorMessageFor(errors, "y")}
              onCommit={(y) => commitReplace(store, el.id, { ...el, y })}
            />
          </>
        )}
        <NumberField
          label="w"
          value={w}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "w")}
          onCommit={(w) => commitReplace(store, el.id, { ...el, w })}
        />
        <NumberField
          label="h"
          value={h}
          unit="mm"
          precision={0.1}
          error={errorMessageFor(errors, "h")}
          onCommit={(h) => commitReplace(store, el.id, { ...el, h })}
        />
      </section>
    </>
  );
}

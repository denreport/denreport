import type { IrBarcodeSymbology } from "@denreport/core";
import type { ReactNode } from "react";

// A schematic pattern that does not actually encode the barcode (scannability of the value is not guaranteed)
const BAR_SEGMENT_WEIGHTS: readonly number[] = [
  3, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 2,
];

export function BarcodeSketch(props: {
  readonly symbology: IrBarcodeSymbology;
  readonly value: string;
}): ReactNode {
  const { symbology, value } = props;
  return (
    <span className="dr-bc">
      {symbology === "qrcode" ? (
        <span className="dr-bc-qr" aria-hidden="true">
          <span className="dr-bc-qr-finder dr-bc-qr-finder--tl" />
          <span className="dr-bc-qr-finder dr-bc-qr-finder--tr" />
          <span className="dr-bc-qr-finder dr-bc-qr-finder--bl" />
        </span>
      ) : (
        <span className="dr-bc-bars" aria-hidden="true">
          {BAR_SEGMENT_WEIGHTS.map((weight, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed pattern, no reordering occurs
              key={i}
              className={i % 2 === 0 ? "dr-bc-bar" : undefined}
              style={{ flexGrow: weight }}
            />
          ))}
        </span>
      )}
      <span className="dr-bc-value">{value}</span>
    </span>
  );
}

import type { IrBarcodeSymbology } from "@denreport/core";
import type { ReactNode } from "react";

// 実バーコードは符号化しない模式パターン（値の走査可能性は保証しない）
const BAR_SEGMENT_WEIGHTS: readonly number[] = [
  3, 2, 1, 2, 2, 1, 3, 1, 2, 3, 1, 2,
];

export function BarcodeSketch(props: {
  readonly symbology: IrBarcodeSymbology;
  readonly value: string;
}): ReactNode {
  const { symbology, value } = props;
  return (
    <span className="apx-bc">
      {symbology === "qrcode" ? (
        <span className="apx-bc-qr" aria-hidden="true">
          <span className="apx-bc-qr-finder apx-bc-qr-finder--tl" />
          <span className="apx-bc-qr-finder apx-bc-qr-finder--tr" />
          <span className="apx-bc-qr-finder apx-bc-qr-finder--bl" />
        </span>
      ) : (
        <span className="apx-bc-bars" aria-hidden="true">
          {BAR_SEGMENT_WEIGHTS.map((weight, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 固定パターンで並び替えが起きない
              key={i}
              className={i % 2 === 0 ? "apx-bc-bar" : undefined}
              style={{ flexGrow: weight }}
            />
          ))}
        </span>
      )}
      <span className="apx-bc-value">{value}</span>
    </span>
  );
}

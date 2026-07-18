import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";

export function Ruler(props: {
  readonly axis: "h" | "v";
  readonly lengthMm: number;
  readonly onGuidePointerDown?: (e: ReactPointerEvent) => void;
}): ReactNode {
  const marks: number[] = [];
  for (let n = 0; n <= props.lengthMm; n += 50) {
    marks.push(n);
  }
  return (
    <div
      className={props.axis === "h" ? "apx-ruler-h" : "apx-ruler-v"}
      aria-hidden="true"
      onPointerDown={props.onGuidePointerDown}
    >
      {marks.map((n) => (
        <span key={n} className="apx-rl" style={{ "--n": n } as CSSProperties}>
          {n}
        </span>
      ))}
    </div>
  );
}

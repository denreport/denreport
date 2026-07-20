import type { CSSProperties, ReactNode } from "react";
import type { EnvelopePreset } from "../../state/envelope-presets";
import type { MmBox } from "../../state/geometry";
import type { CustomGuide } from "../../state/guides";
import type { GuideDragApi } from "./useGuideDrag";

function boxVars(box: MmBox): CSSProperties {
  return {
    "--x": box.x,
    "--y": box.y,
    "--w": box.w,
    "--h": box.h,
  } as CSSProperties;
}

export function GuidesLayer(props: {
  /** Already has guidesInPage applied */
  readonly guides: readonly CustomGuide[];
  /** Pass null when pageContext !== "first" */
  readonly envelopePreset: EnvelopePreset | null;
  readonly drag: GuideDragApi;
}): ReactNode {
  const { guides, envelopePreset, drag } = props;
  return (
    <>
      {guides.map((guide) =>
        guide.axis === "x" ? (
          <span
            key={guide.id}
            className="apx-cguide-v"
            style={{ "--gx": guide.positionMm } as CSSProperties}
          >
            <span
              className="apx-cguide-hit"
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.startFromGuide(guide.id, "x", e);
              }}
            />
          </span>
        ) : (
          <span
            key={guide.id}
            className="apx-cguide-h"
            style={{ "--gy": guide.positionMm } as CSSProperties}
          >
            <span
              className="apx-cguide-hit"
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.startFromGuide(guide.id, "y", e);
              }}
            />
          </span>
        ),
      )}
      {envelopePreset !== null && (
        <>
          <div
            className="apx-env-window"
            style={boxVars(envelopePreset.windowBox)}
          />
          <div
            className="apx-env-safe"
            style={boxVars(envelopePreset.safeBox)}
          />
        </>
      )}
    </>
  );
}

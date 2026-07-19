import type {
  IrDocument,
  IrElement,
  IrElementType,
  IrFlexChild,
} from "../ir/types";
import type { CompatEntry, CompatTargetId, TargetCompatMatrix } from "./types";

/**
 * A single compatibility issue between an IR document and an export target's
 * rendering capabilities. Only elements or attributes at level "approximated"
 * or "unsupported" produce a finding; fully supported usage never does.
 */
export interface CompatFinding {
  readonly target: CompatTargetId;
  readonly level: "approximated" | "unsupported";
  readonly elementId: string;
  readonly elementType: IrElementType;
  readonly path: string;
  readonly attribute?: string;
  readonly note: string;
  readonly userMessage: string;
}

type CompatInstance = IrElement | IrFlexChild;

// マトリクスは要素型 K ごとに CompatAttributeOf<K> で属性キーを制限するが、
// ここは走査対象の要素型を静的に知らないため汎用形にゆるめて読む。
interface LooseElementCompat {
  readonly element: CompatEntry;
  readonly attributes?: {
    readonly [attribute: string]: CompatEntry | undefined;
  };
}

/**
 * Walks every element in `document` (including flex descendants) against
 * `matrix` and collects a finding for each element or attribute that is
 * approximated or unsupported by the target. Returns an empty array when the
 * document is fully supported.
 */
export function checkCompat(
  document: IrDocument,
  matrix: TargetCompatMatrix,
): readonly CompatFinding[] {
  const findings: CompatFinding[] = [];
  document.elements.forEach((element, i) => {
    walk(element, `elements[${i}]`, matrix, findings);
  });
  return findings;
}

function walk(
  instance: CompatInstance,
  path: string,
  matrix: TargetCompatMatrix,
  findings: CompatFinding[],
): void {
  const compat = matrix.elements[instance.type] as LooseElementCompat;
  report(findings, matrix.target, instance, path, undefined, compat.element);
  if (compat.element.level === "unsupported") return;

  const attributes = compat.attributes;
  if (attributes) {
    for (const [attribute, entry] of Object.entries(attributes)) {
      if (entry !== undefined && attribute in instance) {
        report(
          findings,
          matrix.target,
          instance,
          `${path}.${attribute}`,
          attribute,
          entry,
        );
      }
    }
  }

  if (instance.type === "flex") {
    instance.children.forEach((child, i) => {
      walk(child, `${path}.children[${i}]`, matrix, findings);
    });
  }
}

function report(
  findings: CompatFinding[],
  target: CompatTargetId,
  instance: CompatInstance,
  path: string,
  attribute: string | undefined,
  entry: CompatEntry,
): void {
  if (entry.level === "supported") return;
  findings.push({
    target,
    level: entry.level,
    elementId: instance.id,
    elementType: instance.type,
    path,
    ...(attribute !== undefined ? { attribute } : {}),
    note: entry.note,
    userMessage: entry.userMessage,
  });
}

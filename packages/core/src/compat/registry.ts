import { pdfmeCompatMatrix } from "./matrix-pdfme";
import { reportlabCompatMatrix } from "./matrix-reportlab";
import type { CompatTargetId, TargetCompatMatrix } from "./types";

/** Compatibility matrix for every supported export target, keyed by target id. */
export const COMPAT_MATRICES: Readonly<
  Record<CompatTargetId, TargetCompatMatrix>
> = {
  pdfme: pdfmeCompatMatrix,
  reportlab: reportlabCompatMatrix,
};

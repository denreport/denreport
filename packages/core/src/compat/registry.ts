import { pdfmeCompatMatrix } from "./matrix-pdfme.js";
import { reportlabCompatMatrix } from "./matrix-reportlab.js";
import type { CompatTargetId, TargetCompatMatrix } from "./types.js";

/** Compatibility matrix for every supported export target, keyed by target id. */
export const COMPAT_MATRICES: Readonly<
  Record<CompatTargetId, TargetCompatMatrix>
> = {
  pdfme: pdfmeCompatMatrix,
  reportlab: reportlabCompatMatrix,
};

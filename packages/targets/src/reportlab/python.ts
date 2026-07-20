export function pyString(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (code <= 0x1f) out += `\\x${code.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `"${out}"`;
}

export function pyNumber(value: number): string {
  return String(value);
}

export function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

/** Converts #rrggbb into a 0..1 three-value tuple string for ReportLab's setStrokeColorRGB/setFillColorRGB. */
export function pyRgb(color: string): string {
  const r = Number.parseInt(color.slice(1, 3), 16) / 255;
  const g = Number.parseInt(color.slice(3, 5), 16) / 255;
  const b = Number.parseInt(color.slice(5, 7), 16) / 255;
  return `(${pyNumber(r)}, ${pyNumber(g)}, ${pyNumber(b)})`;
}

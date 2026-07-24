# @denreport/targets

Export targets for [denreport](https://www.den.report/)'s IR
([`@denreport/core`](https://www.npmjs.com/package/@denreport/core)):
turn an `IrDocument` into a [pdfme](https://pdfme.com/) template + input
JSON, or a self-contained [ReportLab](https://www.reportlab.com/) Python
script. Also provides the font loading/validation used by both exporters
(`resolveFontSetData`, `validateFont`, `detectFontFormat`, ...). Bundles
the Regular and Bold weights of Noto Sans JP (SIL OFL 1.1) so Japanese
text renders correctly out of the box. (Per-target compatibility matrices —
`COMPAT_MATRICES` / `checkCompat` — live in
[`@denreport/core`](https://www.npmjs.com/package/@denreport/core), not
here.)

## Install

```sh
npm install @denreport/targets
```

## Usage

```ts
import { readFile } from "node:fs/promises";
import { emptyDataFor, parseIr } from "@denreport/core";
import { EMBEDDED_FONT_URL, exportPdfme } from "@denreport/targets";

const parsed = parseIr(irJsonString);
if (!parsed.ok) throw new Error("invalid IR");

const regular = await readFile(EMBEDDED_FONT_URL);
const result = exportPdfme(parsed.document, emptyDataFor(parsed.document), {
  regular,
});

if (result.ok) {
  // result.template and result.inputs are ready for @pdfme/generator
} else {
  console.error(result.errors, result.fontIssues);
}
```

`exportReportlab` has the same signature and instead returns a ReportLab
Python script (`ExportReportlabResult`). Both require a `FontSetData` (raw
TTF bytes per font slot) — `EMBEDDED_FONT_URL` points at the bundled Noto
Sans JP font that ships in this package's `assets/` directory.

See the [monorepo README](https://github.com/denreport/denreport#readme)
for the full picture, including the license terms that apply to exported
output and the bundled font.

## License

MIT. The bundled Noto Sans JP fonts are licensed separately under the SIL
Open Font License 1.1 (see `assets/fonts/OFL.txt` in this package).

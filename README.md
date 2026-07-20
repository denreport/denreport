# denReport

日本語版 README: [README.ja.md](README.ja.md)

denreport is a web-based designer for business documents (invoices, delivery
notes, receipts, and similar reports), built around an open, JSON-based
intermediate representation (IR) instead of a proprietary template format.
You lay out a document once and export it to two different rendering
targets — [pdfme](https://pdfme.com/) and Python's
[ReportLab](https://www.reportlab.com/) — instead of being locked into one
PDF library.

denreport runs entirely in your browser. There is no server component and
no account: the designer, the IR, and the exporters all run client-side, and
your report layouts and data never leave your machine.

## What's implemented

denreport is pre-1.0 and under active development. What exists today:

- **A visual designer** for laying out text, lines, rectangles, ellipses,
  images, barcodes/QR codes, and paginated tables, plus a flex container for
  row/column layout, all on an absolute-coordinate canvas.
- **Japanese typesetting basics**: embedding of the actual font used for
  layout (so text metrics match what gets exported), line-head prohibition
  rules (禁則処理) for wrapping Japanese text, and justified
  (均等割付) alignment.
- **Qualified invoice field checks**: validation that a document declared as
  a Japanese qualified invoice (適格請求書) has the fields required by law,
  integrated into the designer's validation panel.
- **An open IR**: a versioned JSON document format ([spec](packages/core/docs/ir-v1.md))
  with a parser and a validator, so a design isn't tied to denreport itself.
- **Two export targets**: a pdfme template + input JSON, and a
  self-contained ReportLab Python script with its font packaged alongside
  it — both driven by the same IR document.
- **Compatibility warnings**: before exporting, denreport tells you which
  parts of your design are only approximated (or unsupported) by the
  selected target, so surprises show up at design time, not after opening
  the output PDF.

All of the above is free and open source.

## Packages

This is a pnpm monorepo with three packages and one app:

| Package | What it is |
|---|---|
| [`@denreport/core`](packages/core) | The IR spec, parser, and validator. No UI, no rendering. |
| [`@denreport/targets`](packages/targets) | Exporters from IR to pdfme and ReportLab, plus the compatibility matrices. |
| [`@denreport/designer`](packages/designer) | The browser-based editor UI, embeddable via a small `Designer` class. |
| [`apps/web`](apps/web) | The reference app you get when you run this repo. |

All packages are MIT licensed.

None of these are published to npm yet — publishing is planned but not set up.
For now, use them by cloning this repository and building from source (see
Quickstart below), not by installing from a registry.

## License FAQ

**Can I use denreport in my own project for free?**
Yes. Every package — the IR spec, parser, both exporters, the designer UI,
and the reference app — is MIT licensed. Use them in any project,
commercial or not, with no obligations beyond the MIT notice.

**Do the PDFs, templates, or generated code I produce have any license
obligations?**
The output itself is yours. Exported PDF files (including the fonts
embedded in them — the SIL Open Font License states that it does not apply
to documents created with a font), pdfme template JSON, and generated
ReportLab Python code carry no attribution or disclosure requirement, and
denreport claims no rights over them.

One caveat: the ReportLab export is a zip that also contains the font
*files* (TTF) the script loads. When those are the bundled Noto Sans JP
fonts, the files themselves stay under the
[SIL Open Font License 1.1](packages/targets/assets/fonts/OFL.txt). The
zip itself does not include the license file, so if you pass the zip on to
someone else, add a copy of
[`OFL.txt`](packages/targets/assets/fonts/OFL.txt) alongside it — that one
file carries both the copyright notice and the license text that OFL
condition 2 requires each copy to keep. Don't sell the font files on
their own (OFL condition 1). If you registered your own fonts, their
license terms apply instead.

**What licenses do the bundled fonts and the export targets use?**
The bundled fonts are the Regular and Bold weights of Noto Sans JP, under
the SIL Open Font License 1.1; the license text ships in
[`packages/targets/assets/fonts/OFL.txt`](packages/targets/assets/fonts/OFL.txt).
The libraries the exported artifacts run on are permissive as well:
[pdfme](https://github.com/pdfme/pdfme) is MIT,
[reportlab](https://www.reportlab.com/opensource/) is BSD 3-Clause, and
Pillow (required by generated code that draws images) is MIT-CMU. None of
them impose obligations on the documents you generate with them.

## Quickstart

Requires Node.js >= 24 and [pnpm](https://pnpm.io/) (via
[Corepack](https://nodejs.org/api/corepack.html)).

```sh
git clone https://github.com/denreport/denreport.git
cd denreport
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
pnpm --filter @denreport/web dev
```

This starts a Vite dev server; open the URL it prints to use the designer.

To build the app instead:

```sh
pnpm --filter @denreport/web run build
```

To run lint, type-checking, and tests for the whole workspace:

```sh
pnpm check
```

## Embedding the designer

Since `@denreport/designer` isn't on npm yet, this works today from within
the pnpm workspace (or after building the package from source), not via a
registry install:

```ts
import { Designer } from "@denreport/designer";
import "@denreport/designer/styles/tokens.css";
import "@denreport/designer/styles/app.css";

const designer = new Designer(document.getElementById("app")!);
```

See [`apps/web/src/main.ts`](apps/web/src/main.ts) for a complete example,
including loading and autosaving an IR document.

## Self-hosting

denreport ships as a single Docker image containing the built designer and a
small static file server — no database, no API, no external services.

```sh
docker run --rm -p 8080:8080 ghcr.io/denreport/denreport:latest
```

Open http://localhost:8080 in a browser. Designing, saving to localStorage,
and exporting to pdfme or ReportLab all run client-side in the browser; the
container only serves static files and never receives your report data. The
image has no built-in HTTPS or authentication — put it behind your own
reverse proxy (nginx, Caddy, etc.) if you need either.

## Roadmap

Beyond the above, we're planning deeper Japanese typesetting features
(vertical writing, gaiji, and similar), a self-hosted rendering runtime, and
a curated set of ready-made templates. None of that exists yet, and this
README will be updated as it ships.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, how to
run checks, and the licensing terms that apply to contributions.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

MIT for all packages. The full license text is in [LICENSE](LICENSE), and
each package carries its own copy in its `LICENSE` file. See the License
FAQ above for what this means in practice.

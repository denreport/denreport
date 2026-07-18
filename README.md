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

Nothing above requires a paid plan.

## Packages

This is a pnpm monorepo with three packages and one app:

| Package | License | What it is |
|---|---|---|
| [`@denreport/core`](packages/core) | MIT | The IR spec, parser, and validator. No UI, no rendering. |
| [`@denreport/targets`](packages/targets) | MIT | Exporters from IR to pdfme and ReportLab, plus the compatibility matrices. |
| [`@denreport/designer`](packages/designer) | AGPL-3.0-only, or commercial | The browser-based editor UI, embeddable via a small `Designer` class. |
| [`apps/web`](apps/web) | AGPL-3.0-only | The reference app you get when you run this repo. |

None of these are published to npm yet — publishing is planned but not set up.
For now, use them by cloning this repository and building from source (see
Quickstart below), not by installing from a registry.

## License FAQ

**Can I use denreport in my own project for free?**
Yes. `@denreport/core` and `@denreport/targets` — the IR spec, parser, and
both exporters — are MIT licensed. Use them in any project, commercial or
not, with no obligations beyond the MIT notice.

**What about the designer UI?**
`@denreport/designer` is AGPL-3.0-only. You can self-host it and use it
inside your organization freely, including for commercial work. AGPL-3.0
only requires source disclosure if you distribute a product built on it, or
offer it as a network service to others — in that case you either comply
with AGPL-3.0 (make your product's source available under a compatible
license) or use a commercial license instead, which removes that
requirement.

**Do the PDFs, templates, or generated code I produce have any license
obligations?**
No. Output produced by denreport — exported PDF files, pdfme templates, or
generated ReportLab code — is entirely yours, with no attribution
requirement and no obligation to disclose anything.

**Why is the designer AGPL but core/targets MIT?**
So the parts you'd want to depend on programmatically (the format, the
parser, the exporters) are unencumbered, while the editor UI — the part
someone would embed into a competing product — is what funds continued
development.

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
a curated set of ready-made templates. Some of these are expected to be
offered under a paid plan alongside the free designer; none of that exists
yet, and this README will be updated as it ships.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, how to
run checks, and the licensing terms that apply to contributions.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

MIT for `packages/core` and `packages/targets`; AGPL-3.0-only (or
commercial) for `packages/designer` and `apps/web`. Full license texts are
in [LICENSE-MIT](LICENSE-MIT) and [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0), and
each package's `LICENSE` file states which applies to it. See the License
FAQ above for what this means in practice.

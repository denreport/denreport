# @denreport/designer

The embeddable, browser-based visual designer UI for
[denreport](https://www.den.report/). Lays out text, lines, rectangles,
ellipses, images, barcodes/QR codes, and paginated tables on an
absolute-coordinate canvas, and reads/writes the IR defined by
[`@denreport/core`](https://www.npmjs.com/package/@denreport/core). Exposed
as a small `Designer` class you mount into a container element — no build
of the whole denreport app required.

## Install

```sh
npm install @denreport/designer react react-dom
```

`react` and `react-dom` (`^19.2.7`) are peer dependencies.

## Usage

```ts
import { Designer } from "@denreport/designer";
import "@denreport/designer/styles/tokens.css";
import "@denreport/designer/styles/app.css";

const designer = new Designer(document.getElementById("app")!);
```

`Designer` takes over the container's contents and renders the full editor
(canvas, panels, export dialog). Pass `initialIr` in the second argument to
open an existing document; see the
[`DesignerOptions`](https://github.com/denreport/denreport/blob/main/packages/designer/src/api/designer.ts)
type for the rest (theme, locale, sample data, export target).

For a complete integration, including loading and autosaving an IR
document, see
[`apps/web/src/main.ts`](https://github.com/denreport/denreport/blob/main/apps/web/src/main.ts)
in the [monorepo](https://github.com/denreport/denreport#readme).

## License

MIT

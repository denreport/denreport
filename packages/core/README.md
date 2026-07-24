# @denreport/core

The intermediate representation (IR) at the heart of
[denreport](https://www.den.report/): a versioned, JSON-based document
format for business documents (invoices, delivery notes, receipts, and
similar reports), with a parser, a validator, and per-export-target
compatibility matrices (`COMPAT_MATRICES` / `checkCompat`, which flag IR
usage a target only approximates or doesn't support). No UI, no rendering —
this package only defines and checks the document shape that
[`@denreport/targets`](https://www.npmjs.com/package/@denreport/targets)
exports and [`@denreport/designer`](https://www.npmjs.com/package/@denreport/designer)
edits.

## Install

```sh
npm install @denreport/core
```

## Usage

```ts
import { parseIr, validateIr } from "@denreport/core";

const result = parseIr(irJsonString);
if (!result.ok) {
  console.error(result.errors);
} else {
  const document = result.document;
  const validationErrors = validateIr(document); // business-rule violations, e.g. []
}
```

`parseIr` checks the JSON against the IR schema (version, page, font,
elements) and returns a typed `IrDocument` on success. `validateIr` runs
additional rules (e.g. required-field checks for a qualified invoice
docType) that a structurally valid document can still violate; a non-empty
result means the document is invalid, the same as a `parseIr` failure.

See the [IR v1 spec](https://github.com/denreport/denreport/blob/main/packages/core/docs/ir-v1.md)
for the full document format, and the
[monorepo README](https://github.com/denreport/denreport#readme) for how
this package fits with the designer and export targets.

## License

MIT

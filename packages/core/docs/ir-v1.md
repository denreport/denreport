# IR v1 Specification

IR (Intermediate Representation) is a single JSON document that represents a form/report layout.
The designer writes it out as the save format, and exporters take it as input. IR itself
contains no data (values to merge in) — data is combined as a separate JSON document at export
time / preview time.

## 1. Top-level structure

```json
{
  "version": "1.0",
  "page": { "width": 210, "height": 297 },
  "font": { "regular": "NotoSansJP", "bold": "NotoSansJPBold" },
  "styles": [ ... ],
  "elements": [ ... ]
}
```

- `version` — Version of the IR specification (Section 3).
- `page` — The paper size (Section 2). Dimensions common to all pages. The document's page
  count is not fixed by the IR alone — it's determined by table expansion at data-binding time
  (Section 4.3).
- `footnotes` — Footnotes (optional. Section 3.10).
- `groups` — Grouping of elements (optional. Section 3.13).
- `font` — The document's font. A set of logical names for four slots — `regular` / `bold` /
  `italic` / `boldItalic` — of which only `regular` is required. Each logical name follows the
  same identifier pattern as `id`. The font family is singular per document (no per-element
  family switching); a text element's `fontWeight` / `fontStyle` (Section 3.2) determine which
  slot is referenced. A request for an undefined slot is not a validation error — it falls back
  to a defined slot per `resolveFontSlot`'s degradation rule (italic-preferring: boldItalic →
  italic → bold → regular, bold → regular, italic → regular). File paths and binaries are not
  included in the IR. Resolving logical names to actual fonts, embedding them, and format
  validation are the exporter's responsibility and are not part of this spec's validation.
- `styles` — Optional. Named style definitions (Section 3.9). When omitted, the document uses
  no named styles.
- `elements` — Array of elements. An empty array is valid (a blank form). Array order is draw
  order (later elements are drawn on top — this rule applies within a single page; flex
  children are placed at the container's position, in the children's own order). Overlap is
  permitted. Each element's page assignment is expressed via the `pages` attribute (Section
  2.1).
- `docType` — Optional attribute. The only value is `"qualifiedInvoice"`. Declares the document
  as a qualified invoice and enables the required-items check Q01 (Section 6). When omitted,
  the key itself is absent. This is validation-only metadata with no effect whatsoever on
  export (pdfme, ReportLab) or compatibility validation.

## 2. Coordinate system

- The origin is the top-left corner of each page. x increases to the right, y increases
  downward.
- All length units are mm (JSON number, decimals allowed). Attribute names don't carry a unit
  suffix (e.g. `widthMm`) — units are defined centrally by this spec. The sole exceptions are
  `fontSize` and `lineHeight`: `fontSize` is in pt (DTP points, 1pt = 0.352778mm), and
  `lineHeight` is a dimensionless multiplier.
- Paper size is `page: { width, height }` (mm). There is no preset name (e.g. `"A4"`) — only
  the dimensions are authoritative. Portrait/landscape is likewise expressed purely through the
  width/height values.
- Conversion to target-specific coordinate systems (e.g. PDF's bottom-left origin, pt units) is
  the exporter's responsibility.
- **Text baseline (normative)**: for text / pageNumber (and the text-equivalent expanded from a
  table; Section 5.3), the baseline of line i (0-indexed) is placed, below the element's top
  edge `y`, at

  ```
  (ascender / unitsPerEm + (lineHeight − 1) / 2 + i × lineHeight) × fontSize
  ```

  (in pt; convert to mm at 1pt = 0.352778mm). The actual font is the one in the slot obtained by
  resolving the element's `fontWeight` / `fontStyle` via `resolveFontSlot` (Section 1).
  `ascender` is that font's ascender value from the hhea table (horizontal header), and
  `unitsPerEm` is the unitsPerEm value from the head table (font header) — see the OpenType
  spec for the definitions of these font-internal tables:
  https://learn.microsoft.com/en-us/typography/opentype/spec/hhea and
  https://learn.microsoft.com/en-us/typography/opentype/spec/head. The first term is the ascent
  in em units (the distance from the baseline to the top of the line); the second is
  half-leading, which distributes the leading — the amount by which line height exceeds the
  font size — evenly above and below the line; the third term is the line height
  (`lineHeight × fontSize`). This formula is normative, not left to the exporter's
  approximation — given the same font set, the first-line position and line spacing match
  across all targets, slot by slot. Line i refers to a line after the wrapping in Section 2.1,
  not a naive split on `\n`.

### 2.1 Text wrapping and line-head prohibition (normative)

For text / pageNumber (and table header/body cells; Section 5.3), content is split into lines
based on the effective width `widthPt = effective width in mm × 72 / 25.4`, following the
procedure below. The effective width is `w` for text / pageNumber, and
`column.width − 2 × TABLE_CELL_PADDING_X` for table header/body cells.

1. Split `content` into paragraphs on `\n` (an empty paragraph is kept as a blank line).
2. Greedily pack each paragraph code point by code point. When the line is non-empty and adding
   the next character would make the line's measured width (the sum of the actual font's glyph
   advances × `fontSize`) exceed the effective width, break before that character. As in Section
   2, the actual font is the font of the slot resolved for the element via `resolveFontSlot`
   (always `regular` for table header/body cells). This is character-by-character wrapping —
   word boundaries in Latin text are not considered.
3. Line-head prohibition (行頭禁則, gyōtō kinsoku), via push-out (追い出し, oidashi): when the
   first character of a new line is a prohibited character (listed below), move the last
   character of the previous line to the head of the new line. If the head is still a
   prohibited character after the move, repeat. However, the previous line always retains at
   least one character (once it's down to a single character, stop and allow the prohibition to
   be violated).

Characters subject to line-head prohibition (fixed, not customizable): `、 。 ， ． ） ｝ ］ 」 』 】 〕 〉 》 ｡ ､ ｣ , . ) ] }`.
Line-end prohibition, hanging punctuation (ぶら下げ組版, burasage kumihan), and squeeze-in
(追い込み, oikomi) via letter-spacing compression are out of scope for this spec. Vertical
overflow of a line (when line count × line height exceeds `h`) remains unspecified, as before.

### 2.2 Full justification (`align: "justify"`)

For text / pageNumber / table columns with `align` set to `"justify"`, each line obtained from
the Section 2.1 procedure (including the last/only line) has equal letter-spacing inserted
between every code point in the line, so that the line's measured width matches the effective
width. The letter-spacing is `charSpacePt = (widthPt − lineWidthPt) / (n − 1)` (n = the number
of code points in the line). When `n < 2`, or the line's measured width is already at or beyond
the effective width, letter-spacing is `0` (no compression).

## 3. Element types

There are 9 element types: `text` / `line` / `rect` / `ellipse` / `table` / `image` / `flex` /
`pageNumber` / `barcode`.

### 3.1 Common attributes

| Attribute | Type | Required | Description |
|---|---|---|---|
| `type` | `"text" \| "line" \| "rect" \| "ellipse" \| "table" \| "image" \| "flex" \| "pageNumber"` | Required | Element type |
| `id` | string | Required | Unique within the document (including flex descendants). Pattern `^[A-Za-z_][A-Za-z0-9_]*$`, 64 characters or fewer |
| `name` | string | Optional | Display name. No identifier constraint (Japanese allowed); uniqueness within the document is not enforced. 64 characters or fewer |
| `x`, `y` | number | Required* | The element's top-left corner (for line, the reference point). mm (Section 2). *flex children don't have these (position is determined by the container; Section 3.7) |
| `pages` | `"first" \| "rest" \| "last" \| "all"` | Optional | Which page(s) to place on. first = first page only / rest = second page onward / last = last page only / all = every page (for shared areas like footers). Default is `"first"` (**only pageNumber defaults to `"all"`**). **table doesn't have this** (always flows starting from page 1). flex children don't have this either (inherited from the container) |
| `rotate` | number | Optional | Clockwise rotation angle (degrees) around the center of the bounding box (for line, the midpoint of the zero-thickness box, i.e. the segment's midpoint). Defaults to `0` (no rotation) when omitted. Allowed range is in Section 6, M19. **table / flex don't have this** (rejected as an unknown attribute by S09). flex children can have this (layout uses the unrotated dimensions; rotation is applied at draw time around the child's own center) |

### 3.2 text — Text (supports `{key}` merge fields)

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Occupied area (mm). The top edge of the first line is `y` |
| `text` | string | Required | — | The string. `\n` breaks lines. May contain `{key}` tokens (below) |
| `fontSize` | number | Optional | `10` | pt. Note: not mm (Section 2) |
| `align` | `"left" \| "center" \| "right" \| "justify"` | Optional | `"left"` | Horizontal alignment. `"justify"` is full justification (Section 2.2) |
| `lineHeight` | number | Optional | `1.25` | Line-height multiplier |
| `fontWeight` | `"normal" \| "bold"` | Optional | `"normal"` | Weight. Rendered using the corresponding slot of `font` (Section 1) |
| `fontStyle` | `"normal" \| "italic"` | Optional | `"normal"` | Italic. Rendered using the corresponding slot of `font` (Section 1) |
| `underline` | boolean | Optional | `false` | Underline. Position and thickness are not specified by this spec — follows the target's rendering |
| `color` | string | Optional | `"#000000"` | Text color (`#rrggbb`) |
| `style` | string | Optional | — | Reference to a named style (Section 3.9) |

Wrapping and line-head prohibition follow the normative rules in Section 2.1; full
justification follows Section 2.2. Behavior on vertical overflow of the area is not specified
by this spec. A line's baseline position is uniquely determined by the normative formula in
Section 2 (based on the metrics of the resolved slot's actual font). `fontWeight` / `fontStyle`
are specified per element — there's no character-level (rich text) style specification.
Synthetic (faux) bold/italic is never performed; when the corresponding slot is undefined,
`resolveFontSlot`'s degradation rule (Section 1) applies.

`text` may contain one or more `{key}` tokens (`key` follows the same identifier pattern as
`id`, 64 characters or fewer), replaced with that key's value at data-binding time (Section 5)
(partial merge). A `{` that doesn't match a token (not an identifier, 65+ characters, etc.)
remains as a literal character. There is no escape syntax — `{{key}}` becomes `{value}` because
the inner `{key}` is expanded as a token. Substitution happens in a single pass only —
`{key}`-shaped strings inside data values are not re-expanded.

### 3.3 line — Straight line

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | Required | — | Direction |
| `length` | number | Required | — | Line length (mm). horizontal extends in +x, vertical extends in +y |
| `thickness` | number | Optional | `0.3` | Thickness (mm) |
| `style` | string | Optional | — | Reference to a named style (Section 3.9) |

The base geometry only supports two directions, horizontal and vertical (`orientation` +
`length`). Diagonal lines are expressed via the common `rotate` attribute (Section 3.1): the
rotation center is the segment's midpoint (the center of the zero-thickness box). Which side of
the base line the thickness's fill lands on is left to target approximation and unspecified.

### 3.4 rect — Rectangle (border only, no fill)

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Width, height (mm) |
| `borderWidth` | number | Optional | `0.3` | Border thickness (mm) |
| `style` | string | Optional | — | Reference to a named style (Section 3.9) |

### 3.5 table — Table with variable line-item rows (can split across multiple pages)

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `bind` | string | Required | — | Key for the row data (array of objects) (Section 5.2) |
| `columns` | Column[] | Required (1 or more) | — | Column definitions. Placed left to right in order |
| `rowHeight` | number | Required | — | Height of one line-item row (mm). Row height is fixed (doesn't grow with content) |
| `headerHeight` | number | Required | — | Height of the header row (mm) |
| `fontSize` | number | Optional | `10` | pt. Shared by header and body |
| `maxY` | number | Optional | `page.height` | Bottom of the area where rows can be placed on each page (mm). Rows beyond this are pushed to the next page (Section 5.3) |
| `continuationY` | number | Optional | `table.y` | Top of the table (top of the header) on the 2nd page onward (continuation pages). The header is re-shown on continuation pages |
| `minRows` | number | Optional | `0` | Minimum number of rows to display (integer ≥ 0). When there's less data, empty rows pad out to draw a frame of N rows (Section 5.3) |
| `frameWidth` | number | Optional | `0.4` | Thickness of the outer frame line (mm). Must be greater than 0 |
| `gridWidth` | number | Optional | `0.25` | Thickness of the interior grid lines (row/column dividers) (mm). Must be greater than 0 |
| `frameStyle` | `"solid" \| "dotted" \| "dashed" \| "dashdot" \| "dashdotdot"` | Optional | `"solid"` | Line style of the outer frame |
| `gridStyle` | `"solid" \| "dotted" \| "dashed" \| "dashdot" \| "dashdotdot"` | Optional | `"solid"` | Line style of the interior grid lines (row/column dividers) |
| `cellOverrides` | CellOverride[] | Optional | — | Fixed cell-value overrides. An array of `{ row, key, value }` (row is a 0-indexed running row number, key is `columns[].key`, value is the string to display). (row, key) is unique within the table (M13). An override pointing at a row beyond the output row count `max(n, minRows)` is inactive |
| `cellSpans` | CellSpan[] | Optional | — | Declaration of static cell merges (table below and Section 5.3; validated by M20) |
| `style` | string | Optional | — | Reference to a named style (Section 3.9) |

Column:

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `key` | string | Required | — | Key into the row object. Same pattern as `id`. Unique within the table |
| `label` | string | Required | — | Header display string (any string; Japanese allowed) |
| `width` | number | Required | — | Column width (mm) |
| `align` | `"left" \| "center" \| "right" \| "justify"` | Optional | `"left"` | Alignment of body cells (header is always center; Section 5.3) |
| `mergeSameValue` | boolean | Optional | `false` | Data-driven vertical merge. Merges consecutive body rows with the same value into one cell (Section 5.3) |

CellSpan (elements of `cellSpans`):

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `row` | number \| `"header"` | Required | — | The starting body row number (0-indexed running row number), or `"header"` (horizontal merge in the header row; in this case rowSpan is 1) |
| `key` | string | Required | — | The starting column's `columns[].key` |
| `rowSpan` | number | Optional | `1` | Number of rows to merge vertically (integer ≥ 1) |
| `colSpan` | number | Optional | `1` | Number of columns to merge to the right (integer ≥ 1) |

The table's width is derived from Σ column widths and isn't held as an attribute. The table's
height and page count depend on the row count, so they aren't fixed by the IR alone — they're
determined at data-binding time (Section 5.3). When the body overflows `maxY`, it's not an
error — a page break occurs. Rows are never split mid-row, and the header is re-shown on every
page. The thickness and style of the outer frame and interior grid lines can be individually
specified via the `frameWidth`/`gridWidth`/`frameStyle`/`gridStyle` attributes above (defaults
match the constants in Section 5.3). Color is fixed to black for both the frame and interior,
and cell padding stays at the spec constants (Section 5.3) rather than becoming an attribute.

### 3.6 image — Image

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Draw area (mm) |
| `src` | string | Required | — | Only a data URI (`data:image/png;base64,...` or `data:image/jpeg;base64,...`) |

External URLs and relative paths are unsupported (validation error). Rendered by stretching to
fit the `w × h` area (aspect ratio is not preserved).

### 3.7 flex — A container that lays out child elements sequentially

Another placement mode alongside absolute coordinates. The container itself is placed with
absolute coordinates (`x`, `y`), and the container computes its children's positions (children
don't have `x`, `y`, or `pages`).

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `direction` | `"row" \| "column"` | Required | — | Main-axis direction. row = side by side horizontally, column = stacked vertically |
| `w` | number | Optional* | — (derived) | *`direction: "row"` only. Explicit main-axis (horizontal) size (mm). Defines the free space that `justifyContent` distributes. Can't be present with column |
| `h` | number | Optional* | — (derived) | *`direction: "column"` only. Explicit main-axis (vertical) size (mm). Can't be present with row |
| `gap` | number | Optional | `0` | Spacing between children (mm, ≥ 0) |
| `justifyContent` | `"start" \| "center" \| "end"` | Optional | `"start"` | Main-axis alignment. Free space only arises from an explicit main-axis size (when omitted, free space is zero and all values produce the same result) |
| `alignItems` | `"start" \| "center" \| "end"` | Optional | `"start"` | Cross-axis alignment |
| `children` | Element[] | Required (1 or more) | — | Child elements. Any element other than table (text / line / rect / ellipse / image / pageNumber / flex). Nesting is allowed |

**Geometry resolution (normative)**: flex is resolved to absolute coordinates as pure,
data-independent geometry before compilation. There is no dimension that depends on a child's
content (text measurement) — a child's occupied dimensions are always determined purely from
its explicit attributes.

- Child i's occupied dimensions `(w_i, h_i)`: for text / rect / image / pageNumber, it's
  `(w, h)`; for line, horizontal is `(length, 0)` and vertical is `(0, length)` (thickness
  doesn't count toward the dimensions); for a nested flex, the derived dimensions below
  (resolved depth-first).
- Main-axis content size `C = Σ(child main-axis sizes) + gap×(k−1)` (for k children). Main-axis
  size `L` = the explicit value (row's `w` / column's `h`; when omitted, `L = C`). The main-axis
  offset `o`, via justifyContent: start → `0` / center → `(L − C)/2` / end → `L − C` (when the
  main-axis size is explicit, there's a validation rule requiring `L ≥ C`, i.e. `o ≥ 0`).
- `direction: "column"`: the container's box is width `W = max(w_i)` (the cross axis is always
  derived) × height `L`. Child i's top edge is `y_i = flex.y + o + Σ_{j<i}(h_j + gap)`. The left
  edge, via alignItems: start → `flex.x` / center → `flex.x + (W − w_i)/2` / end →
  `flex.x + W − w_i`.
- `direction: "row"` is symmetric: the box is width `L` × height `H = max(h_i)`. Child i's left
  edge is `x_i = flex.x + o + Σ_{j<i}(w_j + gap)`, and the top edge is determined the same way
  via alignItems.
- After resolution, children inherit `pages` from the container, and draw order expands the
  container's array position with the children's own order.
- The in-paper-bounds check is performed on the container's box (main axis `L` × derived cross
  axis). Since a child's box is always contained within the container's box, no per-child check
  is needed.

grow / stretch / wrap / padding / space-between and similar distributed-layout features are
unsupported. Only the main-axis size of the container can be made explicit — the cross-axis
size is always derived from the children and is never an attribute.

### 3.8 pageNumber — Page number (n / N)

An element that displays the current page number and total page count. Its content is replaced
with a fixed string at compile-time expansion.

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Occupied area (mm) |
| `format` | string | Optional | `"{n} / {N}"` | Display format. `{n}` = current page number (1-indexed), `{N}` = total page count, both substituted. Other characters are literal |
| `fontSize` | number | Optional | `10` | pt |
| `align` | `"left" \| "center" \| "right" \| "justify"` | Optional | `"left"` | Horizontal alignment. `"justify"` is full justification (Section 2.2) |
| `lineHeight` | number | Optional | `1.25` | Line-height multiplier |
| `color` | string | Optional | `"#000000"` | Text color (`#rrggbb`) |
| `style` | string | Optional | — | Reference to a named style (Section 3.9) |

The only way this element differs from others is that `pages` defaults to `"all"`. An
all-pages footer is expressed as a combination of "`pages: "all"` pageNumber / text / line"
elements — there's no dedicated header/footer area object.

### 3.9 Named styles (styles)

The document root's `styles` is an array that defines named sets of formatting attributes. An
element's `style` attribute (Sections 3.2–3.5, 3.8) references this `name`.

```json
{
  "styles": [
    { "name": "見出し", "attrs": { "fontSize": 14, "align": "center" } }
  ]
}
```

| Attribute | Type | Required | Description |
|---|---|---|---|
| `name` | string | Required | Display name. Non-empty, 64 characters or fewer, unique within the document (no identifier pattern is enforced) |
| `attrs` | object | Required (1 or more fields) | A subset of `fontSize` / `align` / `lineHeight` / `fontWeight` / `fontStyle` / `underline` / `borderWidth` / `thickness`. Each value's type and allowed range match the corresponding element attribute in Section 3 (`fontWeight` / `fontStyle` / `underline` apply to text only) |

`attrs` attributes that don't apply to the referencing element's type (e.g. a style with
`borderWidth` referenced by a `text` element) are permitted by this spec; interpreting their
meaning (which attributes actually take effect) is the exporter's/editor's responsibility. IR
validation (Section 6) only guarantees that `style` points to an existing `name` in `styles` —
it doesn't specify how the referenced attributes map onto the element's own concrete values
(the element's own concrete-value attributes are always the sole source of truth for rendering
and export; `styles` itself plays no role in export).

### 3.10 footnotes — Footnotes (root-level optional key, not an element)

Reference marks `{#id}` written inside top-level (directly under the flat array, excluding flex
descendants) text elements are automatically numbered in order of appearance, replaced with a
static `*n`-style text, and the corresponding notes are automatically placed as a single text
block at the bottom of the page. This is not an element — it's an optional root-level key of
`IrDocument`, and is not included in the `elements` array.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `x` | number | Required | Left edge of the note block (mm) |
| `w` | number | Required | Width of the note block (mm) |
| `bottom` | number | Required | Distance from the bottom of the page to the bottom of the note block (mm) |
| `fontSize` | number | Required | pt |
| `lineHeight` | number | Required | Line-height multiplier relative to `fontSize` |
| `pages` | `"first" \| "rest" \| "last" \| "all"` | Required | Which page(s) to draw the note block on |
| `notes` | `{ id: string, text: string }[]` | Required | The note bodies. `\n` in `text` is an explicit line break. An empty array is allowed (no block is generated) |

All attributes are required, with no default values (filling in defaults is the designer
layer's responsibility — parse doesn't backfill them).

**Mark notation**: `{#id}` (`#` + identifier). This doesn't collide syntactically with the
existing merge token `{key}` (which requires the first character to be `[A-Za-z_]`; Section
3.2). Marks may only be written in the `text` of a top-level text element — a mark inside text
in a flex descendant, a table's `columns[].label` / `cellOverrides[].value`, pageNumber's
`format`, or `notes[].text` is a validation error (Section 6, F04). Mark-like strings that
appear in a table's body rows (runtime data / cellOverrides) are values outside the IR and
aren't subject to validation.

**Resolution (compile-time expansion; normative)**: scanning each top-level text's `text` from
the start, in the order of `document.elements`, `{#id}` marks are numbered `1, 2, 3…` in order
of first appearance (a repeated occurrence of the same id reuses its first-appearance number).
Each mark is replaced with `*n`. The referenced notes are concatenated in ascending numeric
order as lines of `*n body` (a `\n` inside a note's body becomes a line break as-is, with no
prefix added to lines after the first), and appended to the end of `elements` as a single text
element: `{ type: "text", id: "drFootnotes", x, y, pages, w, h, text: <concatenated result>,
fontSize, align: "left", lineHeight }` (`x`/`w`/`pages`/`fontSize`/`lineHeight` are taken
directly from `footnotes`'s values). The block's `y` is computed automatically as
`page.height − bottom − blockHeight`, where `blockHeight = total line count × fontSize ×
lineHeight × PT_TO_MM` (`PT_TO_MM = 25.4 / 72`). This resolution does nothing (adds no block)
when there's no `footnotes`, `notes` is empty, or no mark references anything. The resolved
document has no `footnotes` key and consists only of ordinary text elements, so neither
`lowerIr` (on the pdfme side) nor the ReportLab side needs any footnote-specific branching to
keep up. `{key}` tokens inside a note's body are naturally expanded because the resolved text
element flows through the normal data-binding path (Section 5).

### 3.11 barcode — Barcode / QR code

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Draw area (mm) |
| `symbology` | `"qrcode" \| "code39" \| "code128" \| "ean13"` | Required | — | The symbology |
| `value` | string | Required | — | The value to encode. May contain `{key}` tokens (same syntax as Section 3.2) |

Rendered by stretching to fit the `w × h` area (aspect ratio not preserved, same as image). Bar
thickness, quiet zone, and human-readable text (shown only for `ean13`) are not specified by
this spec — they follow the target's rendering. Whether `value` conforms to `symbology`'s
format (check digit, character set, digit count) is outside this spec's validation scope and is
the caller's responsibility.

### 3.12 ellipse — Ellipse

| Attribute | Type | Required | Default | Description |
|---|---|---|---|---|
| `w`, `h` | number | Required | — | Width, height of the bounding area (mm) |
| `borderWidth` | number | Required | — | Border thickness (mm) |

Draws an ellipse inscribed in the area (`x`, `y` origin, `w` × `h`). `style` (Section 3.9)
cannot be referenced.

### 3.13 groups — Grouping of elements (root-level optional key, not an element)

Metadata that lets the editing UI bundle top-level elements so all members can be selected with
a single click. This is not an element — it's an optional root-level key of `IrDocument`, and
is not included in the `elements` array.

| Attribute | Type | Required | Description |
|---|---|---|---|
| `id` | string | Required | The group's identifier. In a separate namespace from `elements[].id`; no document-wide uniqueness constraint |
| `memberIds` | string[] | Required | The `id`s of the top-level elements to bundle. May include ids that don't actually exist in the document — liveness checking is the reader's responsibility (not validated by this spec) |

None of `resolveFlex`, `lowerIr`, the ReportLab-side export, or the validation rules in Section
6 reference `groups`. It's display/selection support exclusive to the editing UI and has no
effect whatsoever on rendering or export output.

## 4. Version numbers and the backward-compatibility policy

### 4.1 Representation

- The top-level required attribute `version` holds the string `"<major>.<minor>"`. v1's initial
  release is `"1.0"`.
- A minor increment = a backward-compatible addition only (a new optional attribute, a new
  element type, a new enum value). It never changes the meaning of an existing document.
- A major increment = a breaking change (a new required attribute, a change in meaning, a
  removal). v1 implementations don't read documents at major 2 or above.

### 4.2 Rules for readers

- An implementation accepts any v1 document at or below the minor version it supports
  (`IR_VERSION`).
- A minor version newer than its own (e.g. the implementation is 1.0 and the document is 1.1)
  is rejected with an explicit error. Forward compatibility (silently ignoring unknown
  attributes) is not guaranteed.

### 4.3 What v1 guarantees and doesn't guarantee

Guarantees:

- A document that's valid as v1.0 is valid under every future v1.x implementation, with
  unchanged meaning.
- Validation rule (Section 6) IDs are stable within the v1 series (rules may be added, but an
  existing ID's meaning is never changed).
- Multi-page expansion results (page count, each page's element placement) are uniquely
  determined, target-independent, by the reference semantics in Section 5.3.
- Text's first-line position and line spacing: a line's baseline is uniquely determined by the
  normative formula in Section 2 (based on the resolved slot's actual font's hhea ascender and
  head unitsPerEm), and matches, slot by slot, across all targets given the same font set.
- Text wrapping, line-head prohibition, and full-justification letter-spacing: uniquely
  determined by the normative formulas in Sections 2.1 and 2.2 (based on the resolved slot's
  actual font's character widths), matching, slot by slot, across all targets given the same
  font set for line breaking and letter-spacing.

Not guaranteed:

- Forward compatibility (an older implementation reading a document with a newer minor
  version).
- Pixel-identical output across targets. What's guaranteed is equivalence at the level of the
  reference semantics in Section 5.3 and the baseline norm in Section 2 (differences in glyph
  rasterization and shaping remain).
- Vertical overflow of text, the side the line-thickness fill lands on, and other behaviors
  this spec explicitly states it "does not specify."
- Reproducing multi-page semantics on a target with no concept of pages.

Future element additions go through the "adding an element type = minor increment" path. An
element type unknown to a v1 implementation is rejected under the rules in Section 4.2 (because
`version` will have been bumped).

## 5. Data binding (bind), variable line items, and multi-page

### 5.1 Data shape

Data is a JSON object separate from the IR (the top level must be an object).

- The value of a `{key}` token's key, inside `text`'s `text` or `barcode`'s `value`, must be a
  string. Formatting numbers and dates is the data producer's responsibility — IR has no
  formatting feature.
- The value of `table.bind`'s key is an array of objects. Each row object must have a string
  value for every one of that table's `columns[].key`. It's valid even if the row count n is
  less than `minRows` (the shortfall is displayed as empty rows; Section 5.3).
- Nested path references (`"a.b"`, array subscripts) aren't supported — top-level keys only.
- When a key isn't present in the data, it's a warning: text/barcode is filled with an empty
  string, and table with an empty array (i.e. `minRows` worth of empty rows), and export
  continues. When the value's type/shape is invalid (not a string, not an array, a row that
  isn't a dict, a column value that isn't a string), it's an error and export stops (Section 6,
  group C).

### 5.2 Compile-time expansion (lowering)

A table element is held declaratively in the IR, and at data-binding time is expanded
(lowered) into a set of text / line / rect elements before being handed to the target. This
extends to multiple pages as well: splitting the table (page breaks), assigning elements to
pages, and finalizing pageNumber are all lowering's responsibility — the target's native table
feature, automatic pagination, and page-numbering mechanism are never used. The only capability
required of a target is "absolute-coordinate drawing of basic shapes (text / line / rect /
image) across multiple pages."

Export requires data (at least sample data that determines the row count) — the page count is
also determined by the data. Whether the output is generated as static expansion, or as a
"function that takes data and loops," is left to the exporter's design. What the IR spec
requires is only that, for any given row data, the output geometrically matches the reference
semantics in Section 5.3.

### 5.3 Reference expansion semantics (normative)

Given a document and data, the expansion result must geometrically match the output of the
following procedure.

**(1) flex resolution** — replace flex containers with a list of absolute-coordinate child
elements per the rules in Section 3.7 (data-independent).

**(2) Determining row count and page count** — for each table:

- The displayed row count is `m = max(n, minRows)` (n = the number of bound data rows). Rows
  with row number `t ≥ n` are empty rows (all cells are the empty string).
- First-page row capacity `k_first = floor((maxY − y − headerHeight) / rowHeight)`,
  continuation-page row capacity `k_cont = floor((maxY − continuationY − headerHeight) /
  rowHeight)`. Validation rules guarantee `k_first ≥ 1` and `k_cont ≥ 1`.
- That table's required page count `P = 1` (when `m ≤ k_first`; if m = 0, header only, so P =
  1); otherwise `P = 1 + ceil((m − k_first) / k_cont)`.

The document's total page count is `N = max(1, the maximum P across all tables)`. It's an error
if two or more tables have `P ≥ 2`, and an error if `N` exceeds its limit (Section 6, group C).

**(3) Page assignment** — assign each non-table element (after flex resolution) according to
`pages`: first → page 1 / rest → pages 2 through N (no output if N=1) / last → page N (page 1
if N=1) / all → every page (an element's coordinates are identical on every page, since all
pages share the same paper size). Table chunk p (1..P) is placed on page p (a table always
starts on page 1).

**(4) Table split geometry** — chunk p's row count `c_p`: `c_1 = min(m, k_first)`, and
thereafter the lesser of the remaining row count and `k_cont`. Chunk p's in-page top is
`Y0 = table.y` (p=1) / `continuationY` (p≥2). Each chunk is treated as "header + c_p rows," to
which the single-chunk geometry below applies. Constants (spec constants, not made into
attributes):

| Constant | Value | Meaning |
|---|---|---|
| `TABLE_CELL_PADDING_X` | 1.5 mm | Left/right padding for cell text |
| `TABLE_HEADER_TEXT_OFFSET_Y` | 1.8 mm | Top offset of header text |
| `TABLE_CELL_TEXT_OFFSET_Y` | 2.0 mm | Top offset of body text |

The thickness and style of the outer frame and interior grid lines are determined by the
table's `frameWidth`/`gridWidth`/`frameStyle`/`gridStyle` attributes (Section 3.5; when
omitted, the defaults are `TABLE_FRAME_WIDTH` = 0.4 mm, `TABLE_GRID_WIDTH` = 0.25 mm, and
`"solid"`, respectively).

With column i's (0-indexed) left edge `X_i = table.x + Σ_{j<i} columns[j].width`, the table's
width `W = Σ columns[].width`, and the chunk's height `H_p = headerHeight + c_p × rowHeight`:

- Header cell text: for each column i, a text-equivalent element
  (x=`X_i + PADDING_X`, y=`Y0 + HEADER_TEXT_OFFSET_Y`, w=`width_i − 2×PADDING_X`,
  h=`headerHeight − HEADER_TEXT_OFFSET_Y`, fontSize=`table.fontSize`, align=`center`,
  lineHeight=`1.25` (same as the text element's default), content=`columns[i].label`). Re-shown
  on every chunk.
- Body cell text: for row q within the chunk (0-indexed; running row number t) and column i, a
  text-equivalent element
  (y=`Y0 + headerHeight + q×rowHeight + CELL_TEXT_OFFSET_Y`,
  h=`rowHeight − CELL_TEXT_OFFSET_Y`, align=`columns[i].align`,
  content=the value of `columns[i].key` in row t's data. x, w, fontSize, and lineHeight are the
  same as the header). No text element is generated for cells in an empty row (t ≥ n) (grid
  lines and frame are still generated).
- Outer frame: a rect-equivalent element (x=`table.x`, y=`Y0`, w=`W`, h=`H_p`,
  borderWidth=`table.frameWidth`, borderStyle=`table.frameStyle`).
- Horizontal grid lines: for q = 0 .. c_p−1, a line-equivalent element
  (orientation=horizontal, x=`table.x`, y=`Y0 + headerHeight + q×rowHeight`,
  length=`W`, thickness=`table.gridWidth`, strokeStyle=`table.gridStyle`).
  q=0 is the header underline. The frame covers the chunk's bottom edge.
- Vertical grid lines: for i = 1 .. column count−1, a line-equivalent element
  (orientation=vertical, x=`X_i`, y=`Y0`, length=`H_p`, thickness=`table.gridWidth`,
  strokeStyle=`table.gridStyle`).

Rows are never split mid-row (a whole row is pushed to the next chunk).

**Cell merging** — static merges (`cellSpans`; Section 3.5) and data-driven merges (Column's
`mergeSameValue`) apply as exceptions to the single-chunk geometry above.

- Determining the merge extent:
  - Static: each declaration `{ row, key, rowSpan, colSpan }` treats the `rowSpan` rows ×
    `colSpan` columns starting at column `key` of running row number `row` as a single merge.
    `row: "header"` is a horizontal merge within the header row (`colSpan` only; applies
    identically to the re-shown header on each chunk). A declaration whose start is at or past
    the output row count `m` is inactive; a `rowSpan` that overflows past `m` is truncated
    (the same rule as for `cellOverrides` beyond the output row count).
  - Data-driven: for each column with `mergeSameValue: true`, a maximal run of length 2 or more
    of consecutive matching cell values (after `cellOverrides` is applied) is treated as one
    merge. Only applies to body rows. Empty strings are never merged (so that `minRows`'s
    padding rows don't accidentally merge). At a run boundary of a `mergeSameValue` column to
    its left, this column's own run is also cut (when the group changes in the column to the
    left, the merge in this column is cut too). A `cellSpans` coverage area must never overlap a
    `mergeSameValue: true` column (M20).
- Crossing pages (content duplication): a merge is cut off at chunk boundaries and drawn as an
  independent merge within each chunk. On the continuation chunk, its first row becomes a new
  starting point, and that row's data value is redrawn. Merging has no effect whatsoever on
  page splitting (chunk sizing, page count) or row-capacity calculation.
- Drawing: text is drawn only in the merge's starting cell (width = sum of the covered
  columns' widths − 2×`PADDING_X`, height = `rowSpan × rowHeight − CELL_TEXT_OFFSET_Y`, vertical
  position uses the usual top-offset baseline, alignment follows the starting column's `align`
  — header is center). Covered cells (other than the start) draw no value (the data itself is
  unchanged). Horizontal/vertical grid lines that fall inside the merge's extent are drawn
  segmented, excluding that span. Grid lines that don't intersect a merge are still drawn as a
  single full-width/full-height line, as before. Stripes (`stripeColor`) are still drawn per
  row, as before, independent of merging.
- A `cellOverrides` entry pointing at a covered cell is inactive. An override on a starting cell
  is drawn as its value, as before, and data-driven merging is judged using that value after
  the override is applied.

**(5) pageNumber substitution** — for each assigned page p, a text-equivalent element (same
x/y/w/h/fontSize/align/lineHeight, content = `format` with `{n}` substituted by p and `{N}`
substituted by N; other characters are literal).

Within each page, draw order preserves the original order of the `elements` array (a table's
chunks go at the table's array position, and flex children go at the container's array
position). Inside a chunk, the draw order is: outer frame → horizontal grid lines (ascending
q) → vertical grid lines (ascending i) → header cell text (column order) → body cell text (row
order, column order within a row) (cell text is drawn above the grid lines). The id naming
convention for expanded elements is left to the exporter and isn't specified by this spec.

## 6. Validation rules

Validation is split into three layers.

- **Group S (syntax validation)**: whether the JSON's shape matches the spec.
- **Group M (semantic validation)**: rejects documents whose shape is correct but whose meaning
  is broken.
- **Group C (data-binding-time validation)**: rules that depend on data and can't be judged
  from the IR alone — implemented by the exporter.
- **Group F (footnotes)**: validation specific to `footnotes` (Section 3.10). F01 is at the
  syntax layer (equivalent to group S); F02–F06 are at the semantic layer (equivalent to group
  M). Kept as an independent prefix, not consuming group S/M's numbering.

Errors are reported as `{ rule, path, message }` (rule = the ID from the tables below, path =
the JSON path of the violation, e.g. `elements[3].fontSize`). Every violation detectable in a
single validation pass is enumerated (it doesn't stop at the first one). Rule IDs are part of
this spec and stable within the v1 series.

### Group S (syntax)

| ID | Rule |
|---|---|
| S01 | The input parses as valid JSON |
| S02 | The root is an object; the keys `version`, `page`, `font`, `elements` are required, and `styles`, `docType`, `footnotes`, `groups` are optional (any other unknown key is rejected) |
| S03 | `version` is a string matching `^1\.(0\|[1-9][0-9]*)$`, with a minor version at or below what the implementation supports. major ≠ 1, or a minor version that's too new, is rejected with a dedicated message |
| S04 | `page` is `{ width, height }` (both numbers; unknown keys rejected) |
| S05 | `font` is `{ regular, bold?, italic?, boldItalic? }` (each value a string; `regular` required; unknown keys rejected) |
| S06 | `elements` is an array, and each element is an object |
| S07 | Each element's `type` is one of the 9 types |
| S08 | The required attributes for each element type are present, and each attribute's type is correct (a separate rule per type: S08t, S08l, S08r, S08e, S08b, S08i, S08f, S08p, S08c. Also covers the type validation of the common optional `name` attribute and the `style` optional attribute for text/line/rect/table/pageNumber) |
| S09 | No unknown attributes on elements or Columns (table's `pages`, flex children's `x`/`y`/`pages`, flex's cross-axis size — row's `h` / column's `w` — and image/flex's `style` are likewise rejected as unknown attributes) |
| S10 | Enum values are within their domain (`align`, `fontWeight`, `fontStyle`, `orientation`, `direction`, `justifyContent`, `alignItems`, `pages`, `symbology`) |
| S12 | image's `src` matches data-URI syntax (`data:<mediatype>;base64,<payload>`) |
| S13 | flex's `children` is an array, and each child is an element object other than table (group S is applied recursively, including to nested flex) |
| S14 | `styles` is an array, and each element consists of `name` (string) and `attrs` (an object with only defined keys, correctly typed values, including enum validation of `align`) (Section 3.9) |
| S15 | `groups` is an array, and each element is an object, rejecting unknown keys, consisting of `id` (string) and `memberIds` (array of strings) (Section 3.13) |

S11 is a retired number (it used to define the mutual exclusivity of text's `text`/`bind`, but
was deleted along with the rule when `bind` was removed; the number is not reassigned). text's
`bind` is now rejected by S09 (unknown attribute), with a message guiding users toward the
`{key}` token.

After passing group S, defaults for optional attributes (per the tables in Section 3;
document-dependent defaults such as `maxY = page.height` and `continuationY = table.y` are
also filled in with concrete values — flex's main-axis size `w`/`h` is *not* filled in even
when omitted) are applied, and the normalized document is returned.

### Group M (semantic)

| ID | Rule |
|---|---|
| M01 | `id` matches the identifier pattern (Section 3.1) and is unique within the document across all elements, including flex descendants |
| M02 | All elements fit within the paper: `x ≥ 0`, `y ≥ 0`, `x + width ≤ page.width`, `y + height ≤ page.height`. Width/height are `w`/`h` for text/rect/ellipse/image/pageNumber/barcode; `length` (judged only along the base line, per orientation — the thickness direction isn't checked) for line; the box from Section 3.7 for flex (when the main-axis size is explicit, that value; children aren't checked individually since they're always contained within the container's box); and `Σ column widths` for table's width (the vertical page area is checked by M09). Checks are always performed on the **unrotated** box — overflow caused by `rotate` is unspecified |
| M03 | Dimensions are positive: `w`, `h` (including flex's explicit main-axis size — row's `w` / column's `h` — and barcode's `w`/`h`), `length`, `thickness`, `borderWidth`, `rowHeight`, `headerHeight`, `columns[].width` are all `> 0`. Only `gap` is `≥ 0` (allowing zero-gap adjacency). M03 only checks positivity — comparing flex's main-axis size against its content size is M12's responsibility |
| M04 | `fontSize` is `0 < fontSize ≤ 200` (pt), `lineHeight` is `0 < lineHeight ≤ 5` |
| M05 | `page.width`, `page.height` are `1 ≤ value ≤ 5000` (mm) |
| M06 | table's `columns` has 1 or more entries, and `key` is unique within the table |
| M07 | All of `font`'s defined slots' logical names, table's `bind`, and `columns[].key` match the identifier pattern |
| M08 | image's `src` mediatype is `image/png` or `image/jpeg`, and the base64 payload is decodable |
| M09 | table's page area is valid: `continuationY ≥ 0`, `maxY ≤ page.height`, `table.y + headerHeight + rowHeight ≤ maxY`, `continuationY + headerHeight + rowHeight ≤ maxY` (at least one row fits on each of the first and continuation pages) |
| M10 | `minRows` is an integer ≥ 0 |
| M11 | flex's `children` has 1 or more entries |
| M12 | When flex's main-axis size is explicit (row's `w` / column's `h`), its value is at least the content size `C` (the sum of children's main-axis sizes + `gap`×(child count−1); Section 3.7) |
| M14 | Each `styles` definition: `name` is non-empty, 64 characters or fewer, unique within the document; `attrs` has 1 or more fields, and each value is within the same allowed range as the corresponding element attribute (`fontSize`/`lineHeight` use the same range as M04; `borderWidth`/`thickness` must be `> 0`) |
| M15 | An element's `style` (including flex descendants) points to a `name` that exists in `styles` |
| M18 | An element's `name` (including flex descendants), when given, is 64 characters or fewer |
| M19 | An element's `rotate` (including flex descendants), when given, is a finite number with `−360 ≤ rotate ≤ 360` |
| M20 | `cellSpans`'s `row` is an integer ≥ 0 or `"header"`; `key` is one of `columns[].key`; `rowSpan`/`colSpan` are integers ≥ 1 with at least one of them ≥ 2; the merge extent fits within the column range; `rowSpan` is 1 for `"header"` rows; merge extents don't overlap each other within the table; and none fall on a column with `mergeSameValue` true |

### Group C (data-binding time; implemented by the exporter)

| ID | Rule |
|---|---|
| C01 | Every `{key}` token's key, inside text's `text` or barcode's `value`, exists in the data with a string value. A missing key is a warning (filled with an empty string); a non-string value is an error |
| C02 | table's `bind` key exists in the data, its value is an array of objects, and every row has a string value for every `columns[].key`. A missing `bind` key is a warning (filled with an empty array); an invalid value or shape is an error |
| C03 | At most one table expanding to 2 or more pages (P ≥ 2; Section 5.3) is allowed per document at a time. It's an error if multiple tables span pages simultaneously |
| C04 | The expanded total page count N is at most `PAGE_COUNT_MAX` (`1000`) |

Font-format (TTF/CFF) validation isn't included in IR validation, since the IR only holds
logical font names, and format is a target-dependent constraint.

### Group Q (document-type check; implemented by `checkQualifiedInvoice`, a function separate from `validateIr`)

| ID | Rule |
|---|---|
| Q01 | A document with `docType` set to `qualifiedInvoice` has merge fields (a text `{key}` or a table column key) covering the items required on a qualified invoice |

Separate from `validateIr`'s "empty array = pass" contract, `checkQualifiedInvoice(document)`
returns warnings (non-blocking). It doesn't run for a document without `docType` (always
returns an empty array).

Whether an item is "placed" is judged by whether the key appears in a `{key}` token of a text
element in the document (including flex descendants), or in a table's `columns[].key`.
`table.bind` (the array name) and `cellOverrides` (fixed display values) don't count as merge
fields, and are excluded.

For each of the 6 items the National Tax Agency requires to be stated, a set of "satisfying
keys (any one suffices)" is defined. Item 4 (applicable tax rate) is customarily written on the
form as a static string like "10%," so it's represented by the field for the amount subject to
tax, broken out by rate.

| # | Required item | Satisfying keys (any of) |
|---|---|---|
| 1 | Issuer's registration number | `registrationNumber` |
| 2 | Transaction date | `issueDate`, `transactionDate` |
| 3 | Transaction details | `description`, `itemName` |
| 4 | Amount subject to tax, broken out by rate, and the applicable rate | `taxableAmount`, `taxableAmount8`, `taxableAmount10` |
| 5 | Consumption tax amount, broken out by rate | `taxAmount`, `taxAmount8`, `taxAmount10` |
| 6 | Name of the recipient business | `customerName` |

### Group F (footnotes)

| ID | Rule |
|---|---|
| F01 | `footnotes` is an object `{ x, w, bottom, fontSize, lineHeight, pages, notes }` with correctly typed attributes and no unknown keys. `notes` is an array of `{ id, text }` (strings; unknown keys rejected) |
| F02 | `notes[].id` matches the identifier pattern and is unique within `footnotes` |
| F03 | Every `{#id}` mark in a top-level text references one of `notes[].id` |
| F04 | `{#id}` marks may only be written in a top-level text element's `text`. A mark inside a flex descendant's text, a table's `columns[].label` / `cellOverrides[].value`, pageNumber's `format`, or `notes[].text` is an error |
| F05 | Every note is referenced by at least one mark |
| F06 | `footnotes`'s `x`/`w`/`bottom` are ≥ 0, `fontSize`/`lineHeight` are within the same allowed range as M04, and the note block fits within the paper (`x + w ≤ page.width` and the auto-computed `y ≥ 0`) |

## 7. Public TypeScript interface

```ts
// types.ts
export const IR_VERSION: "1.0";
export type IrAlign = "left" | "center" | "right" | "justify";
export type IrOrientation = "horizontal" | "vertical";
export type IrPages = "first" | "rest" | "last" | "all";
export type IrFlexDirection = "row" | "column";
export type IrFlexAlign = "start" | "center" | "end";
export type IrDocType = "qualifiedInvoice";
export interface IrPage { readonly width: number; readonly height: number }
export type IrFontSlot = "regular" | "bold" | "italic" | "boldItalic";
export type IrFontWeight = "normal" | "bold";
export type IrFontStyle = "normal" | "italic";
export interface IrFont {
  readonly regular: string;
  readonly bold?: string;
  readonly italic?: string;
  readonly boldItalic?: string;
}
export interface IrColumn {
  readonly key: string; readonly label: string;
  readonly width: number; readonly align: IrAlign;   // Defaults applied after normalization
  readonly mergeSameValue?: boolean;                 // Defaults to false when omitted (not backfilled by normalization either)
}
export interface IrTableCellSpan {
  readonly row: number | "header";
  readonly key: string;
  readonly rowSpan?: number;                         // Defaults to 1 when omitted (not backfilled by normalization either)
  readonly colSpan?: number;                         // Defaults to 1 when omitted (not backfilled by normalization either)
}
export interface IrStyleAttrs {
  readonly fontSize?: number; readonly align?: IrAlign; readonly lineHeight?: number;
  readonly fontWeight?: IrFontWeight; readonly fontStyle?: IrFontStyle;
  readonly underline?: boolean;
  readonly borderWidth?: number; readonly thickness?: number;
}
export type StyleAttrKey = keyof IrStyleAttrs;
export interface IrNamedStyle { readonly name: string; readonly attrs: IrStyleAttrs }
export type IrElement =
  | IrTextElement | IrLineElement | IrRectElement | IrEllipseElement | IrTableElement
  | IrImageElement | IrFlexElement | IrPageNumberElement | IrBarcodeElement;
// Each Ir*Element follows the attribute table in Section 3 (after normalization, defaults such as
// pages are applied; table has concrete values for maxY / continuationY / minRows). text.text is required (string).
// The 7 element types other than table/flex have the common optional attribute rotate?: number
// (Section 3.1; not backfilled to 0 by normalization either)
export type IrBarcodeSymbology = "qrcode" | "code39" | "code128" | "ean13";
export interface IrBarcodeElement {
  readonly type: "barcode";
  readonly id: string;
  readonly name?: string;                  // Display name (Section 3.1). No identifier constraint or uniqueness constraint
  readonly x: number; readonly y: number;
  readonly pages: IrPages;
  readonly w: number; readonly h: number;
  readonly symbology: IrBarcodeSymbology;
  readonly value: string;                  // May contain {key} tokens (same syntax as text.text)
  readonly rotate?: number;                // Clockwise rotation angle (degrees) around the bounding box's center. Defaults to 0 when omitted (Section 3.1)
}
export interface IrFlexElement {
  readonly type: "flex";
  readonly id: string;
  readonly name?: string;                  // Display name (Section 3.1). No identifier constraint or uniqueness constraint
  readonly x: number; readonly y: number;
  readonly pages: IrPages;
  readonly direction: IrFlexDirection;
  readonly w?: number;                     // row's main-axis size (only when explicit; rejected by S09 for column)
  readonly h?: number;                     // column's main-axis size (only when explicit; rejected by S09 for row)
  readonly gap: number;
  readonly justifyContent: IrFlexAlign;    // Main-axis alignment. Default "start" applied after normalization
  readonly alignItems: IrFlexAlign;
  readonly children: readonly IrFlexChild[];
}
// flex children = elements without x / y / pages (position computed by the container; pages inherited)
export type IrFlexChild =
  | Omit<IrTextElement, "x" | "y" | "pages">
  | Omit<IrLineElement, "x" | "y" | "pages">
  | Omit<IrRectElement, "x" | "y" | "pages">
  | Omit<IrEllipseElement, "x" | "y" | "pages">
  | Omit<IrImageElement, "x" | "y" | "pages">
  | Omit<IrPageNumberElement, "x" | "y" | "pages">
  | Omit<IrFlexElement, "x" | "y" | "pages">
  | Omit<IrBarcodeElement, "x" | "y" | "pages">;
export interface IrPageNumberElement {
  readonly type: "pageNumber";
  readonly id: string;
  readonly name?: string;                  // Display name (Section 3.1). No identifier constraint or uniqueness constraint
  readonly x: number; readonly y: number;
  readonly pages: IrPages;                 // The only element whose default is "all" (Section 3.1)
  readonly w: number; readonly h: number;
  readonly format: string;
  readonly fontSize: number; readonly align: IrAlign; readonly lineHeight: number;
  readonly color?: string;
  readonly rotate?: number;                // Clockwise rotation angle (degrees) around the bounding box's center. Defaults to 0 when omitted (Section 3.1)
}
export interface IrFootnoteNote { readonly id: string; readonly text: string }
export interface IrFootnotes {
  readonly x: number; readonly w: number; readonly bottom: number;
  readonly fontSize: number; readonly lineHeight: number; readonly pages: IrPages;
  readonly notes: readonly IrFootnoteNote[];
}
export interface IrGroup { readonly id: string; readonly memberIds: readonly string[] }
export interface IrDocument {
  readonly version: string;
  readonly page: IrPage;
  readonly font: IrFont;
  readonly styles?: readonly IrNamedStyle[];
  readonly elements: readonly IrElement[];
  readonly docType?: IrDocType;            // Optional. "qualifiedInvoice" only (Section 6, group Q)
  readonly footnotes?: IrFootnotes;         // Optional (Section 3.10). All attributes required, no defaults backfilled
  readonly groups?: readonly IrGroup[];     // Optional (Section 3.13). Editing-UI-only, no effect on rendering or export
}

// errors.ts
export type IrRuleId = "S01" | /* ... */ | "S15" | "M01" | /* ... */ | "M20" | "C01" | "C02" | "C03" | "C04" | "Q01"
  | "F01" | "F02" | "F03" | "F04" | "F05" | "F06";
export interface IrError { readonly rule: IrRuleId; readonly path: string; readonly message: string }

// font.ts — The single point where Section 1's undefined-slot degradation rule is defined. Pure function.
// Shared by both targets and the designer preview
export function resolveFontSlot(
  font: IrFont, weight: IrFontWeight, style: IrFontStyle,
): IrFontSlot;

// parse.ts
export type ParseIrResult =
  | { readonly ok: true; readonly document: IrDocument }
  | { readonly ok: false; readonly errors: readonly IrError[] };
export function parseIr(json: string): ParseIrResult;

// flex.ts — Geometry resolution from Section 3.7. Pure function, data-independent.
// Returns the element list without flex (x/y finalized, pages inherited, original draw order preserved).
// Used internally by validateIr (M02); the designer and exporters share the same result
export type IrPlacedElement = Exclude<IrElement, IrFlexElement>;
export function resolveFlex(document: IrDocument): readonly IrPlacedElement[];

// styles.ts — The single vocabulary definition for style-applicable attributes (Section 3.9)
export const STYLEABLE_ATTRS: Readonly<Record<IrElementType, readonly StyleAttrKey[]>>;
export function applicableStyleAttrs(type: IrElementType): readonly StyleAttrKey[];

// footnotes.ts — Footnote resolution from Section 3.10. Pure function, data-independent. Precondition: the input is the output of parseIr and has passed validateIr.
// Returns the document with the footnotes key removed (marks replaced, the note block's text element appended)
export function resolveFootnotes(document: IrDocument): IrDocument;

// validate.ts — Empty array = pass. Call order is parseIr → validateIr
export function validateIr(document: IrDocument): readonly IrError[];

// invoice.ts — A function separate from validateIr. Doesn't run on a document without docType, always returns an empty array
export function checkQualifiedInvoice(document: IrDocument): readonly IrError[];

// table-merge.ts — The single implementation of the cell-merge geometry from Section 5.3. Pure function.
// Shared by lowerIr and the designer's canvas rendering
export interface SkipRange { readonly start: number; readonly end: number }
export interface TableMergeRect {
  readonly q: number | "header";                    // Row number within the chunk ("header" = the header row)
  readonly col: number;
  readonly rowSpan: number;                         // Value after truncation at the chunk boundary
  readonly colSpan: number;
}
export interface TableChunkMerges {
  readonly rects: readonly TableMergeRect[];
  readonly covered: ReadonlySet<string>;            // Covered cells other than the starting cell (key is "q:col")
  readonly horizontalSkips: ReadonlyMap<number, readonly SkipRange[]>;
  readonly verticalSkips: ReadonlyMap<number, readonly SkipRange[]>;
}
export function computeChunkMerges(
  table: IrTableElement, rows: readonly IrTableRow[],  // rows have cellOverrides already applied
  rowOffset: number, chunkSize: number,
): TableChunkMerges;
export function subtractSkips(                        // Grid-line segmentation (remaining spans with skips removed)
  start: number, end: number, skips: readonly SkipRange[] | undefined,
): readonly SkipRange[];

// text-layout.ts — The single implementation of the wrapping, line-head prohibition, and full-justification
// letter-spacing from Sections 2.1 and 2.2. Pure function.
// Measuring character widths (reading the font file) is the caller's (exporter's) responsibility
export type CharWidthEm = (codePoint: number) => number;
export interface TextLayoutInput {
  readonly content: string; readonly widthMm: number;
  readonly fontSize: number; readonly align: IrAlign;
}
export interface LaidOutLine {
  readonly text: string; readonly charSpacePt: number; // Always 0 when align !== "justify"
}
export function layoutTextLines(
  input: TextLayoutInput, charWidthEm: CharWidthEm,
): readonly LaidOutLine[];
export const LINE_HEAD_PROHIBITED: string; // The set of prohibited characters from Section 2.1
```

## 8. Example invoice IR (excerpt)

The skeleton of an A4 invoice written in the v1 vocabulary. Issuer information uses flex
(stacked vertically, centered within a 20mm main axis); the line-item table has a frame of at
least 10 rows and paginates at `maxY = 240`; the total field appears only on the last page; the
page number is a footer on every page.

```json
{
  "version": "1.0",
  "page": { "width": 210, "height": 297 },
  "font": { "regular": "NotoSansJP" },
  "elements": [
    { "type": "text", "id": "title", "text": "{title}", "x": 0, "y": 18, "w": 210, "h": 12, "fontSize": 22, "align": "center" },
    { "type": "flex", "id": "issuerBlock", "x": 130, "y": 40, "direction": "column", "h": 20, "justifyContent": "center", "gap": 1.5,
      "children": [
        { "type": "text", "id": "issuerName", "text": "株式会社サンプル", "w": 60, "h": 6, "fontSize": 11 },
        { "type": "text", "id": "issuerAddr", "text": "{issuerAddr}", "w": 60, "h": 10, "fontSize": 9 }
      ]
    },
    { "type": "line", "id": "customerUnderline", "orientation": "horizontal", "x": 15, "y": 49, "length": 90, "thickness": 0.4 },
    { "type": "table", "id": "items", "bind": "items", "x": 15, "y": 90, "rowHeight": 9, "headerHeight": 9, "fontSize": 10,
      "maxY": 240, "continuationY": 30, "minRows": 10,
      "columns": [
        { "key": "name", "label": "品目", "width": 90 },
        { "key": "amount", "label": "金額(税抜)", "width": 35, "align": "right" }
      ]
    },
    { "type": "text", "id": "totalLabel", "text": "合計(税込)", "x": 110, "y": 250, "w": 40, "h": 8, "fontSize": 12, "pages": "last" },
    { "type": "rect", "id": "totalBox", "x": 108, "y": 247, "w": 89, "h": 12, "borderWidth": 0.5, "pages": "last" },
    { "type": "pageNumber", "id": "pageNo", "x": 0, "y": 285, "w": 210, "h": 6, "fontSize": 9, "align": "center" }
  ]
}
```

Placing the total field (`pages: "last"`) below the table area's bottom edge `maxY` (y ≥ 240)
geometrically guarantees it never overlaps the last page's line-item rows (since rows never
exceed maxY).

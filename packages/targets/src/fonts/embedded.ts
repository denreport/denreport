/** Name of the font bundled with this package, for use as `name` in buildPdfmeFont or as the default IR `font.name`. */
export const EMBEDDED_FONT_NAME = "NotoSansJP";

/** File URL of the bundled NotoSansJP Regular TTF, resolved relative to this package's install location. */
export const EMBEDDED_FONT_URL = new URL(
  "../../assets/fonts/NotoSansJP-Regular.ttf",
  import.meta.url,
);

/** File URL of the bundled font's license (SIL Open Font License), resolved relative to this package's install location. */
export const EMBEDDED_FONT_LICENSE_URL = new URL(
  "../../assets/fonts/OFL.txt",
  import.meta.url,
);

/** Logical name of the bundled regular font, for use as the default IR `font.regular`. */
export const EMBEDDED_FONT_NAME = "NotoSansJP";

/** File URL of the bundled NotoSansJP Regular TTF, resolved relative to this package's install location. */
export const EMBEDDED_FONT_URL = new URL(
  "../../assets/fonts/NotoSansJP-Regular.ttf",
  import.meta.url,
);

/** Logical name of the bundled bold font, for use as the default IR `font.bold`. */
export const EMBEDDED_BOLD_FONT_NAME = "NotoSansJPBold";

/** File URL of the bundled NotoSansJP Bold TTF, resolved relative to this package's install location. */
export const EMBEDDED_BOLD_FONT_URL = new URL(
  "../../assets/fonts/NotoSansJP-Bold.ttf",
  import.meta.url,
);

/** File URL of the bundled font's license (SIL Open Font License), resolved relative to this package's install location. */
export const EMBEDDED_FONT_LICENSE_URL = new URL(
  "../../assets/fonts/OFL.txt",
  import.meta.url,
);

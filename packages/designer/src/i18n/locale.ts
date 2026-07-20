/** The value the host passes to DesignerOptions / setLocale. "auto" resolves from the browser's language */
export type DesignerLocale = "ja" | "en" | "auto";

/** The resolved locale. Used for catalog selection and rootEl.lang */
export type Locale = "ja" | "en";

/** When pref is "auto", returns "ja" if languages contains a ja-family tag (ja, ja-JP, etc.), otherwise "en" */
export function resolveLocale(
  pref: DesignerLocale,
  languages: readonly string[],
): Locale {
  if (pref !== "auto") {
    return pref;
  }
  const hasJapanese = languages.some(
    (lang) => lang.split("-")[0]?.toLowerCase() === "ja",
  );
  return hasJapanese ? "ja" : "en";
}

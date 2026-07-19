/** ホストが DesignerOptions / setLocale に渡す指定値。"auto" はブラウザ言語から解決する */
export type DesignerLocale = "ja" | "en" | "auto";

/** 解決済みのロケール。カタログ選択・rootEl.lang に使う */
export type Locale = "ja" | "en";

/** pref が "auto" のとき languages に ja 系タグ（ja, ja-JP 等）があれば "ja"、なければ "en" */
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

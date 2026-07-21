import type { Locale } from "../locale.js";
import { en } from "./en.js";
import { ja } from "./ja.js";

/** The catalog's type. ja is canonical; en's key coverage is compile-time guaranteed by this type annotation */
export type Messages = typeof ja;

export function getMessages(locale: Locale): Messages {
  return locale === "ja" ? ja : en;
}

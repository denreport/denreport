import type { Locale } from "../locale.js";
import { en } from "./en.js";
import { ja } from "./ja.js";

/** カタログの型。ja が正で、en はこの型注釈によりキー網羅がコンパイル保証される */
export type Messages = typeof ja;

export function getMessages(locale: Locale): Messages {
  return locale === "ja" ? ja : en;
}

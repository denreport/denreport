import { en } from "./en";
import { ja } from "./ja";

/** Shape of the message catalog, inferred from the Japanese source of truth. */
export type Messages = typeof ja;

/** Locale core can produce user-visible messages in. */
export type MessageLocale = "ja" | "en";

/** Returns the message catalog for `locale` (default "ja"). */
export function getMessages(locale: MessageLocale = "ja"): Messages {
  return locale === "en" ? en : ja;
}

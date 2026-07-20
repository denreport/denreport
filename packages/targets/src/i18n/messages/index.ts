import { en } from "./en.js";
import { ja } from "./ja.js";

/** The message catalog shape, keyed by ja (the source of truth). */
export type Messages = typeof ja;

/** Locale for user-visible strings targets produces: font validation errors and export output. */
export type MessageLocale = "ja" | "en";

const CATALOGS: Readonly<Record<MessageLocale, Messages>> = { ja, en };

/** Looks up the message catalog for `locale`. */
export function getMessages(locale: MessageLocale): Messages {
  return CATALOGS[locale];
}

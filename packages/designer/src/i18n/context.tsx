import { createContext, useContext } from "react";
import type { Locale } from "./locale.js";
import type { Messages } from "./messages/index.js";
import { ja } from "./messages/ja.js";

/** Defaults to ja. This value exists so existing component tests rendered without a Provider don't break */
export const MessagesContext = createContext<Messages>(ja);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}

/** The locale passed to core / targets. Used when the resolved value itself is needed, not the message strings */
export const LocaleContext = createContext<Locale>("ja");

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

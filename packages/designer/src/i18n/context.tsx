import { createContext, useContext } from "react";
import type { Locale } from "./locale";
import type { Messages } from "./messages";
import { ja } from "./messages/ja";

/** 既定値は ja。Provider なしでレンダーされる既存コンポーネントテストを壊さないための値 */
export const MessagesContext = createContext<Messages>(ja);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}

/** core / targets へ渡すロケール。文言そのものではなく解決済みの値が要るとき使う */
export const LocaleContext = createContext<Locale>("ja");

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

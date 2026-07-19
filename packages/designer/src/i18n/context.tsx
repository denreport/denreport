import { createContext, useContext } from "react";
import type { Messages } from "./messages";
import { ja } from "./messages/ja";

/** 既定値は ja。Provider なしでレンダーされる既存コンポーネントテストを壊さないための値 */
export const MessagesContext = createContext<Messages>(ja);

export function useMessages(): Messages {
  return useContext(MessagesContext);
}

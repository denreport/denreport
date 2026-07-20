import { useSyncExternalStore } from "react";
import type { EditorStore } from "../state/store.js";
import type { EditorState } from "../state/types.js";

export function useEditorState(store: EditorStore): EditorState {
  return useSyncExternalStore(
    (onStoreChange) => store.subscribe(onStoreChange),
    () => store.getState(),
  );
}

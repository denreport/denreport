import { useSyncExternalStore } from "react";
import type { EditorStore } from "../state/store";
import type { EditorState } from "../state/types";

export function useEditorState(store: EditorStore): EditorState {
  return useSyncExternalStore(
    (onStoreChange) => store.subscribe(onStoreChange),
    () => store.getState(),
  );
}

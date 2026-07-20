/**
 * ページ上部の通知領域。show は最新1件のみ表示（前の通知は置き換え）、閉じるボタンで消える。
 * 閉じるラベルは show ごとに指定する（本文と同じ locale で表示するため）。
 */
export function createNoticeArea(doc: Document): {
  readonly element: HTMLElement;
  readonly show: (message: string, closeLabel: string) => void;
} {
  const element = doc.createElement("div");
  element.className = "apx-host-notice";
  element.setAttribute("role", "status");
  element.hidden = true;

  const message = doc.createElement("span");
  const close = doc.createElement("button");
  close.type = "button";
  close.addEventListener("click", () => {
    element.hidden = true;
    message.textContent = "";
  });
  element.append(message, close);

  return {
    element,
    show: (text: string, closeLabel: string): void => {
      message.textContent = text;
      close.textContent = closeLabel;
      element.hidden = false;
    },
  };
}

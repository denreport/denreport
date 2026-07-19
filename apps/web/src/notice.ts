/** ページ上部の通知領域。show は最新1件のみ表示（前の通知は置き換え）、閉じるボタンで消える */
export function createNoticeArea(
  doc: Document,
  closeLabel: string,
): {
  readonly element: HTMLElement;
  readonly show: (message: string) => void;
} {
  const element = doc.createElement("div");
  element.className = "apx-host-notice";
  element.setAttribute("role", "status");
  element.hidden = true;

  const message = doc.createElement("span");
  const close = doc.createElement("button");
  close.type = "button";
  close.textContent = closeLabel;
  close.addEventListener("click", () => {
    element.hidden = true;
    message.textContent = "";
  });
  element.append(message, close);

  return {
    element,
    show: (text: string): void => {
      message.textContent = text;
      element.hidden = false;
    },
  };
}

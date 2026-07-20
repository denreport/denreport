/**
 * Notice area at the top of the page. show displays only the latest notice
 * (the previous one is replaced), and the close button dismisses it.
 * The close label is specified per show call (so it is shown in the same locale as the body text).
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

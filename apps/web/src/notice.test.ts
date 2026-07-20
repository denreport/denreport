import { afterEach, describe, expect, it } from "vitest";
import { createNoticeArea } from "./notice";

afterEach(() => {
  document.body.replaceChildren();
});

describe("createNoticeArea", () => {
  it("show で role=status 領域に文言が表示される", () => {
    const notice = createNoticeArea(document);
    document.body.append(notice.element);
    expect(notice.element.getAttribute("role")).toBe("status");
    expect(notice.element.hidden).toBe(true);

    notice.show("読み込めませんでした", "閉じる");
    expect(notice.element.hidden).toBe(false);
    expect(notice.element.textContent).toContain("読み込めませんでした");
  });

  it("2回目の show は前の通知を置き換える", () => {
    const notice = createNoticeArea(document);
    document.body.append(notice.element);

    notice.show("最初の通知", "閉じる");
    notice.show("次の通知", "閉じる");
    expect(notice.element.textContent).toContain("次の通知");
    expect(notice.element.textContent).not.toContain("最初の通知");
  });

  it("閉じるボタンで消える", () => {
    const notice = createNoticeArea(document);
    document.body.append(notice.element);

    notice.show("通知", "閉じる");
    const close = notice.element.querySelector("button");
    close?.click();
    expect(notice.element.hidden).toBe(true);

    notice.show("再表示", "閉じる");
    expect(notice.element.hidden).toBe(false);
    expect(notice.element.textContent).toContain("再表示");
  });

  it("閉じるラベルは show ごとの指定文言になる", () => {
    const notice = createNoticeArea(document);
    document.body.append(notice.element);

    notice.show("通知", "閉じる");
    expect(notice.element.querySelector("button")?.textContent).toBe("閉じる");

    notice.show("Notice", "Close");
    expect(notice.element.querySelector("button")?.textContent).toBe("Close");
  });
});

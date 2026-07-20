import { describe, expect, it } from "vitest";
import { getHostMessages } from "./i18n";

describe("getHostMessages", () => {
  it("ja のとき日本語文言を返す", () => {
    expect(getHostMessages("ja").title).toBe("帳票デザイナー");
  });

  it("en のとき英語文言を返す", () => {
    expect(getHostMessages("en").title).toBe("Report Designer");
  });
});

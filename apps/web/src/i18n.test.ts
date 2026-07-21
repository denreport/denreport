import { describe, expect, it } from "vitest";
import { getHostMessages } from "./i18n";

describe("getHostMessages", () => {
  it("returns Japanese text when locale is ja", () => {
    expect(getHostMessages("ja").title).toBe("帳票デザイナー");
  });

  it("returns English text when locale is en", () => {
    expect(getHostMessages("en").title).toBe("Report Designer");
  });
});

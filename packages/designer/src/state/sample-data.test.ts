import { describe, expect, it } from "vitest";
import { parseSampleJson } from "./sample-data";

describe("parseSampleJson", () => {
  it("空文字列は警告なしの空データになる", () => {
    expect(parseSampleJson("")).toEqual({ data: {}, warning: undefined });
    expect(parseSampleJson("   ")).toEqual({ data: {}, warning: undefined });
  });

  it("正常な JSON オブジェクトはそのまま data になる", () => {
    expect(parseSampleJson('{"title": "見本", "n": 1}')).toEqual({
      data: { title: "見本", n: 1 },
      warning: undefined,
    });
  });

  it("不正 JSON は空データ + invalidJson の警告になる", () => {
    const result = parseSampleJson("{not json");
    expect(result.data).toEqual({});
    expect(result.warning).toBe("invalidJson");
  });

  it("トップレベルが配列・非オブジェクトなら空データ + notObject の警告になる", () => {
    expect(parseSampleJson("[1, 2]")).toEqual({
      data: {},
      warning: "notObject",
    });
    expect(parseSampleJson("42")).toEqual({ data: {}, warning: "notObject" });
    expect(parseSampleJson("null")).toEqual({ data: {}, warning: "notObject" });
  });
});

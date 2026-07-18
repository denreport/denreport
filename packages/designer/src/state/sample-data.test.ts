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

  it("不正 JSON は空データ + source: json の警告になる", () => {
    const result = parseSampleJson("{not json");
    expect(result.data).toEqual({});
    expect(result.warning).toMatchObject({ source: "json" });
  });

  it("トップレベルが配列・非オブジェクトなら空データ + 警告になる", () => {
    expect(parseSampleJson("[1, 2]").data).toEqual({});
    expect(parseSampleJson("[1, 2]").warning).toMatchObject({ source: "json" });
    expect(parseSampleJson("42").data).toEqual({});
    expect(parseSampleJson("42").warning).toMatchObject({ source: "json" });
    expect(parseSampleJson("null").data).toEqual({});
    expect(parseSampleJson("null").warning).toMatchObject({ source: "json" });
  });
});

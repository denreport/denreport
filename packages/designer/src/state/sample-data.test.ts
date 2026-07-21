import { describe, expect, it } from "vitest";
import { parseSampleJson } from "./sample-data";

describe("parseSampleJson", () => {
  it("an empty string becomes empty data with no warning", () => {
    expect(parseSampleJson("")).toEqual({ data: {}, warning: undefined });
    expect(parseSampleJson("   ")).toEqual({ data: {}, warning: undefined });
  });

  it("a valid JSON object becomes data as-is", () => {
    expect(parseSampleJson('{"title": "見本", "n": 1}')).toEqual({
      data: { title: "見本", n: 1 },
      warning: undefined,
    });
  });

  it("invalid JSON becomes empty data plus an invalidJson warning", () => {
    const result = parseSampleJson("{not json");
    expect(result.data).toEqual({});
    expect(result.warning).toBe("invalidJson");
  });

  it("a top-level array or non-object becomes empty data plus a notObject warning", () => {
    expect(parseSampleJson("[1, 2]")).toEqual({
      data: {},
      warning: "notObject",
    });
    expect(parseSampleJson("42")).toEqual({ data: {}, warning: "notObject" });
    expect(parseSampleJson("null")).toEqual({ data: {}, warning: "notObject" });
  });
});

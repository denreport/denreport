import type { PreviewWarning } from "./preview";

/** サンプル JSON の寛容パース。空文字列 → 空データ（警告なし）、不正 JSON /
    非オブジェクト → 空データ + 警告 */
export function parseSampleJson(sampleJson: string): {
  readonly data: Record<string, unknown>;
  readonly warning: PreviewWarning | undefined;
} {
  if (sampleJson.trim() === "") {
    return { data: {}, warning: undefined };
  }
  try {
    const parsed: unknown = JSON.parse(sampleJson);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        data: {},
        warning: {
          source: "json",
          message:
            "サンプルデータのトップレベルがオブジェクトではないため、空のデータとして扱います",
        },
      };
    }
    return {
      data: { ...(parsed as Record<string, unknown>) },
      warning: undefined,
    };
  } catch {
    return {
      data: {},
      warning: {
        source: "json",
        message:
          "サンプルデータを JSON として解釈できないため、空のデータとして扱います",
      },
    };
  }
}

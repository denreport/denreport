export type SampleJsonWarning = "notObject" | "invalidJson";

/** サンプル JSON の寛容パース。空文字列 → 空データ（警告なし）、不正 JSON /
    非オブジェクト → 空データ + 警告理由。
    文言ではなく理由コードを返すのは、警告を捨てる呼び出し元にカタログを配線させないため */
export function parseSampleJson(sampleJson: string): {
  readonly data: Record<string, unknown>;
  readonly warning: SampleJsonWarning | undefined;
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
      return { data: {}, warning: "notObject" };
    }
    return {
      data: { ...(parsed as Record<string, unknown>) },
      warning: undefined,
    };
  } catch {
    return { data: {}, warning: "invalidJson" };
  }
}

export type SampleJsonWarning = "notObject" | "invalidJson";

/** A lenient parse of the sample JSON. Empty string -> empty data (no warning); invalid JSON /
    non-object -> empty data + a warning reason.
    Returns a reason code rather than wording so callers that discard the warning don't need the message catalog wired in */
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

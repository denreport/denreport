import type { CompatFinding, CompatTargetId } from "@denreport/core";

/** UI で選べる書き出しターゲットの全量。表示順もこの並び */
export const EXPORT_TARGET_IDS: readonly CompatTargetId[] = [
  "pdfme",
  "reportlab",
];

export interface CompatWarningGroup {
  readonly level: "approximated" | "unsupported";
  /** グループのキー。マトリクスの平易文そのまま */
  readonly userMessage: string;
  /** findings の出現順（= 文書順）・重複なし */
  readonly elementIds: readonly string[];
  /** グループ内の判定件数（属性判定を含む延べ数） */
  readonly findingCount: number;
}

interface MutableGroup {
  readonly level: "approximated" | "unsupported";
  readonly userMessage: string;
  readonly elementIds: string[];
  readonly seen: Set<string>;
  findingCount: number;
}

/** (level, userMessage) でグループ化する。unsupported のグループを先に、
    同レベル内はグループの初出順（= 文書順）に並べる */
export function groupCompatFindings(
  findings: readonly CompatFinding[],
): readonly CompatWarningGroup[] {
  const groups = new Map<string, MutableGroup>();
  for (const finding of findings) {
    const key = `${finding.level} ${finding.userMessage}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        level: finding.level,
        userMessage: finding.userMessage,
        elementIds: [],
        seen: new Set(),
        findingCount: 0,
      };
      groups.set(key, group);
    }
    group.findingCount += 1;
    if (!group.seen.has(finding.elementId)) {
      group.seen.add(finding.elementId);
      group.elementIds.push(finding.elementId);
    }
  }
  const all = [...groups.values()].map(
    (group): CompatWarningGroup => ({
      level: group.level,
      userMessage: group.userMessage,
      elementIds: group.elementIds,
      findingCount: group.findingCount,
    }),
  );
  return [
    ...all.filter((group) => group.level === "unsupported"),
    ...all.filter((group) => group.level === "approximated"),
  ];
}

import type { Messages } from "../i18n/messages";

/** シナリオ命名に使う文言。state 層の関数はこの部分名前空間のみを受け取る */
export type ScenarioMessages = Messages["scenarioNames"];

export interface SampleScenario {
  /** セット内一意（"s" + 正整数） */
  readonly id: string;
  /** 表示名。一意性なし（識別は id が担う） */
  readonly name: string;
  /** 生の JSON 文字列。不正 JSON も編集の常態として保持する */
  readonly json: string;
}

export interface SampleScenarioSet {
  /** 常に1件以上 */
  readonly items: readonly SampleScenario[];
  /** 必ず items 内の id */
  readonly activeId: string;
}

const ENVELOPE_FORMAT = "denreport-sample-scenarios";
const ENVELOPE_VERSION = 1;

interface SampleScenarioEnvelope {
  readonly format: typeof ENVELOPE_FORMAT;
  readonly version: typeof ENVELOPE_VERSION;
  readonly activeId: string;
  readonly scenarios: readonly SampleScenario[];
}

function isScenario(value: unknown): value is SampleScenario {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.json === "string"
  );
}

function isValidEnvelope(value: object): value is SampleScenarioEnvelope {
  const record = value as Record<string, unknown>;
  if (typeof record.activeId !== "string" || !Array.isArray(record.scenarios)) {
    return false;
  }
  const scenarios = record.scenarios;
  return (
    scenarios.length > 0 &&
    scenarios.every(isScenario) &&
    scenarios.some((s: SampleScenario) => s.id === record.activeId)
  );
}

/** id 未使用の最小の正整数から "s" + N を作る */
function nextId(items: readonly SampleScenario[]): string {
  const used = new Set(
    items
      .map((item) => /^s(\d+)$/.exec(item.id)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number),
  );
  let n = 1;
  while (used.has(n)) {
    n += 1;
  }
  return `s${n}`;
}

/** 既存名と衝突しない最小の正整数から「シナリオ N」を作る */
function nextName(
  items: readonly SampleScenario[],
  m: ScenarioMessages,
): string {
  const used = new Set(items.map((item) => item.name));
  let n = 1;
  while (used.has(m.nth(n))) {
    n += 1;
  }
  return m.nth(n);
}

/** json（旧来の生サンプル文字列）1本から既定1件のセットを作る */
export function defaultScenarioSet(
  json: string,
  m: ScenarioMessages,
): SampleScenarioSet {
  return {
    items: [{ id: "s1", name: m.nth(1), json }],
    activeId: "s1",
  };
}

/** アクティブシナリオの json。従来の state.sampleData に相当する唯一の読み出し口 */
export function activeSampleJson(set: SampleScenarioSet): string {
  return set.items.find((item) => item.id === set.activeId)?.json ?? "";
}

export function selectScenario(
  set: SampleScenarioSet,
  id: string,
): SampleScenarioSet {
  if (id === set.activeId || !set.items.some((item) => item.id === id)) {
    return set;
  }
  return { ...set, activeId: id };
}

/** 空 json の新規シナリオを作りアクティブにする */
export function addScenario(
  set: SampleScenarioSet,
  m: ScenarioMessages,
): SampleScenarioSet {
  const item: SampleScenario = {
    id: nextId(set.items),
    name: nextName(set.items, m),
    json: "",
  };
  return { items: [...set.items, item], activeId: item.id };
}

/** アクティブシナリオの json を引き継いだ新規シナリオを作りアクティブにする */
export function duplicateActiveScenario(
  set: SampleScenarioSet,
  m: ScenarioMessages,
): SampleScenarioSet {
  const active = set.items.find((item) => item.id === set.activeId);
  const item: SampleScenario = {
    id: nextId(set.items),
    name: m.copyOf(active?.name ?? ""),
    json: active?.json ?? "",
  };
  return { items: [...set.items, item], activeId: item.id };
}

/** 最後の1件は no-op。アクティブシナリオの削除は直後（末尾なら直前）をアクティブにする */
export function removeScenario(
  set: SampleScenarioSet,
  id: string,
): SampleScenarioSet {
  if (set.items.length <= 1) {
    return set;
  }
  const index = set.items.findIndex((item) => item.id === id);
  if (index === -1) {
    return set;
  }
  const items = set.items.filter((item) => item.id !== id);
  if (set.activeId !== id) {
    return { items, activeId: set.activeId };
  }
  const next = items[Math.min(index, items.length - 1)] as SampleScenario;
  return { items, activeId: next.id };
}

export function renameScenario(
  set: SampleScenarioSet,
  id: string,
  name: string,
): SampleScenarioSet {
  const target = set.items.find((item) => item.id === id);
  if (target === undefined || target.name === name) {
    return set;
  }
  return {
    ...set,
    items: set.items.map((item) => (item.id === id ? { ...item, name } : item)),
  };
}

export function updateActiveJson(
  set: SampleScenarioSet,
  json: string,
): SampleScenarioSet {
  const active = set.items.find((item) => item.id === set.activeId);
  if (active === undefined || active.json === json) {
    return set;
  }
  return {
    ...set,
    items: set.items.map((item) =>
      item.id === set.activeId ? { ...item, json } : item,
    ),
  };
}

/** 封筒形式またはレガシー生文字列を読む。常に不変条件を満たすセットを返し、throw しない */
export function parseSampleDataStorage(
  raw: string,
  m: ScenarioMessages,
): SampleScenarioSet {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultScenarioSet(raw, m);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).format !== ENVELOPE_FORMAT ||
    (parsed as Record<string, unknown>).version !== ENVELOPE_VERSION
  ) {
    return defaultScenarioSet(raw, m);
  }
  return isValidEnvelope(parsed)
    ? { items: parsed.scenarios, activeId: parsed.activeId }
    : defaultScenarioSet("", m);
}

/** 封筒形式へ直列化。parseSampleDataStorage との往復で同値 */
export function serializeSampleDataStorage(set: SampleScenarioSet): string {
  const envelope: SampleScenarioEnvelope = {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    activeId: set.activeId,
    scenarios: set.items,
  };
  return JSON.stringify(envelope);
}

import type { Messages } from "../i18n/messages/index.js";

/** Wording used for scenario naming. Functions in the state layer only receive this sub-namespace */
export type ScenarioMessages = Messages["scenarioNames"];

export interface SampleScenario {
  /** Unique within the set ("s" + a positive integer) */
  readonly id: string;
  /** Display name. Not unique (identification is the id's job) */
  readonly name: string;
  /** The raw JSON string. Invalid JSON is also kept as a normal editing state */
  readonly json: string;
}

export interface SampleScenarioSet {
  /** Always at least 1 item */
  readonly items: readonly SampleScenario[];
  /** Always an id within items */
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

/** Builds "s" + N from the smallest unused positive integer for id */
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

/** Builds "Scenario N" from the smallest positive integer that doesn't collide with an existing name */
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

/** Builds a set with one default item from a single json (a legacy raw sample string) */
export function defaultScenarioSet(
  json: string,
  m: ScenarioMessages,
): SampleScenarioSet {
  return {
    items: [{ id: "s1", name: m.nth(1), json }],
    activeId: "s1",
  };
}

/** The active scenario's json. The sole read point equivalent to the former state.sampleData */
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

/** Creates a new scenario with an empty json and makes it active */
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

/** Creates a new scenario that inherits the active scenario's json and makes it active */
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

/** No-op on the last remaining item. Deleting the active scenario activates the next one (or the previous one if it was last) */
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

/** Reads the envelope format or a legacy raw string. Always returns a set that satisfies the invariants and never throws */
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

/** Serializes to the envelope format. Round-trips to an equal value with parseSampleDataStorage */
export function serializeSampleDataStorage(set: SampleScenarioSet): string {
  const envelope: SampleScenarioEnvelope = {
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    activeId: set.activeId,
    scenarios: set.items,
  };
  return JSON.stringify(envelope);
}

import type { Action, AgentId } from "./commerce";

const ACTIONS: Record<string, Action> = {
  bid: "bid",
  offer: "bid",
  buy: "bid",
  walk: "walk",
  leave: "walk",
  exit: "walk",
  hold: "hold",
  pass: "hold",
  wait: "hold",
  pitch: "pitch",
  counter: "counter",
  speak: "hold",
};

export interface ParsedTurn {
  action: Action;
  say: string;
  unitPricePence: number | null;
  quantity: number | null;
}

export function parseTurn(text: string, agentId: AgentId): ParsedTurn {
  const json = extractJson(text);
  const actionRaw = String(json.action ?? "").toLowerCase().trim();
  let action = ACTIONS[actionRaw] ?? "hold";
  if (agentId === "merchant") {
    if (action === "bid" || action === "walk") action = "pitch";
  } else if (action === "pitch" || action === "counter") {
    action = "hold";
  }

  const say = String(json.say ?? json.message ?? "")
    .trim()
    .slice(0, 420) || "…";

  if (action === "walk" || action === "hold" || action === "pitch") {
    return { action, say, unitPricePence: null, quantity: null };
  }

  return {
    action,
    say,
    unitPricePence: asPence(json.unitPrice ?? json.price),
    quantity: asQty(json.quantity ?? json.qty),
  };
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Agent did not return JSON");
  const parsed: unknown = JSON.parse(source.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Agent JSON was not an object");
  }
  return parsed as Record<string, unknown>;
}

function asPence(value: unknown): number | null {
  const pounds = asNumber(value);
  if (pounds == null) return null;
  return Math.round(pounds * 100);
}

function asQty(value: unknown): number | null {
  const qty = asNumber(value);
  if (qty == null) return null;
  return Math.round(qty);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

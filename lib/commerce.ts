import { CAST } from "./cast";
import { formatGbpExact, formatLondon } from "./format";
import type { Lot } from "./lot";

export type AgentId = "merchant" | "denim" | "bargain" | "premium";
export type ResellerId = Exclude<AgentId, "merchant">;
export type Action = "pitch" | "bid" | "walk" | "hold" | "counter";

export interface NegotiationEvent {
  agentId: AgentId;
  action: Action;
  say: string;
  unitPricePence?: number | null;
  quantity?: number | null;
  at: string;
}

export type Stamp = "none" | "accepted" | "blocked" | "walked" | "invalid";

export interface AnnotatedEvent extends NegotiationEvent {
  stamp: Stamp;
  reason?: "below_floor" | "bad_quantity" | "bad_price" | "already_walked";
}

export interface StandingOffer {
  agentId: ResellerId;
  unitPricePence: number;
  quantity: number;
  totalPence: number;
  at: string;
  say: string;
}

export interface Book {
  events: AnnotatedEvent[];
  standing: StandingOffer[];
  blocked: AnnotatedEvent[];
  walked: ResellerId[];
  winner: StandingOffer | null;
}

export interface BlockedLine {
  agentId: AgentId;
  name: string;
  unitPricePence: number;
  quantity: number | null;
  kind: "bid" | "counter";
}

export interface Order {
  id: string;
  lotId: string;
  lotTitle: string;
  lotDetail: string;
  winnerAgentId: ResellerId;
  winnerName: string;
  winnerRole: string;
  unitPricePence: number;
  quantity: number;
  totalPence: number;
  floorPricePence: number;
  costPence: number;
  marginPence: number;
  timestamp: string;
  blocked: BlockedLine[];
  remainder: number;
}

export interface Receipt extends Order {
  text: string;
}

const AGENTS: AgentId[] = ["merchant", "denim", "bargain", "premium"];
const ACTIONS: Action[] = ["pitch", "bid", "walk", "hold", "counter"];

export function isReseller(agentId: AgentId): agentId is ResellerId {
  return agentId !== "merchant";
}

export function selectWinner(offers: StandingOffer[]): StandingOffer | null {
  if (offers.length === 0) return null;
  return [...offers].sort(compareOffers)[0] ?? null;
}

function compareOffers(a: StandingOffer, b: StandingOffer): number {
  if (b.totalPence !== a.totalPence) return b.totalPence - a.totalPence;
  if (b.unitPricePence !== a.unitPricePence) return b.unitPricePence - a.unitPricePence;
  return a.at.localeCompare(b.at);
}

export function buildBook(
  events: NegotiationEvent[],
  floorPricePence: number,
  lotQuantity: number,
): Book {
  const walked = new Set<ResellerId>();
  const best = new Map<ResellerId, StandingOffer>();
  const annotated: AnnotatedEvent[] = [];
  const blocked: AnnotatedEvent[] = [];

  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));

  for (const event of sorted) {
    if (event.action === "walk" && isReseller(event.agentId)) {
      walked.add(event.agentId);
      best.delete(event.agentId);
      annotated.push({ ...event, stamp: "walked" });
      continue;
    }

    if (event.action === "bid" && isReseller(event.agentId)) {
      const verdict = judgeBid(event, floorPricePence, lotQuantity, walked.has(event.agentId));
      annotated.push(verdict);
      if (verdict.stamp === "blocked") blocked.push(verdict);
      if (verdict.stamp === "accepted") {
        const offer: StandingOffer = {
          agentId: event.agentId,
          unitPricePence: event.unitPricePence as number,
          quantity: event.quantity as number,
          totalPence: (event.unitPricePence as number) * (event.quantity as number),
          at: event.at,
          say: event.say,
        };
        const prev = best.get(event.agentId);
        if (!prev || compareOffers(offer, prev) < 0) best.set(event.agentId, offer);
      }
      continue;
    }

    if (event.action === "counter") {
      const price = event.unitPricePence ?? null;
      if (price == null || !Number.isInteger(price) || price < floorPricePence) {
        const row: AnnotatedEvent = { ...event, stamp: "blocked", reason: "below_floor" };
        annotated.push(row);
        blocked.push(row);
      } else {
        annotated.push({ ...event, stamp: "none" });
      }
      continue;
    }

    annotated.push({ ...event, stamp: "none" });
  }

  const standing = [...best.values()].sort(compareOffers);
  return {
    events: annotated,
    standing,
    blocked,
    walked: [...walked],
    winner: selectWinner(standing),
  };
}

function judgeBid(
  event: NegotiationEvent,
  floorPricePence: number,
  lotQuantity: number,
  alreadyWalked: boolean,
): AnnotatedEvent {
  const price = event.unitPricePence ?? null;
  const qty = event.quantity ?? null;
  if (alreadyWalked) return { ...event, stamp: "invalid", reason: "already_walked" };
  if (price == null || !Number.isInteger(price) || price <= 0) {
    return { ...event, stamp: "invalid", reason: "bad_price" };
  }
  if (qty == null || !Number.isInteger(qty) || qty < 1 || qty > lotQuantity) {
    return { ...event, stamp: "invalid", reason: "bad_quantity" };
  }
  if (price < floorPricePence) {
    return { ...event, stamp: "blocked", reason: "below_floor" };
  }
  return { ...event, stamp: "accepted" };
}

export function createOrder(input: {
  lot: Lot;
  winner: StandingOffer;
  floorPricePence: number;
  blocked: AnnotatedEvent[];
  now: string;
}): Order {
  if (!Number.isInteger(input.winner.unitPricePence) || input.winner.unitPricePence < input.floorPricePence) {
    throw new Error("Refusing order below the price floor");
  }
  if (
    !Number.isInteger(input.winner.quantity) ||
    input.winner.quantity < 1 ||
    input.winner.quantity > input.lot.quantity
  ) {
    throw new Error("Refusing order with an invalid quantity");
  }

  const totalPence = input.winner.unitPricePence * input.winner.quantity;
  const person = CAST[input.winner.agentId];
  return {
    id: docketId(input.now),
    lotId: input.lot.id,
    lotTitle: input.lot.title,
    lotDetail: `${input.lot.cloth} · ${input.lot.origin}`,
    winnerAgentId: input.winner.agentId,
    winnerName: person.name,
    winnerRole: person.role,
    unitPricePence: input.winner.unitPricePence,
    quantity: input.winner.quantity,
    totalPence,
    floorPricePence: input.floorPricePence,
    costPence: input.lot.costPence,
    marginPence: input.winner.unitPricePence - input.lot.costPence,
    timestamp: input.now,
    blocked: input.blocked
      .filter((row) => row.reason === "below_floor" && row.unitPricePence != null)
      .map((row) => ({
        agentId: row.agentId,
        name: CAST[row.agentId].name,
        unitPricePence: row.unitPricePence as number,
        quantity: row.quantity ?? null,
        kind: row.action === "counter" ? "counter" : "bid",
      })),
    remainder: input.lot.quantity - input.winner.quantity,
  };
}

export function renderReceipt(order: Order): string {
  const lines = [
    "THE LAST DROP",
    "Dead-stock docket",
    order.id,
    formatLondon(order.timestamp),
    "",
    `Lot        ${order.lotTitle}`,
    `           ${order.lotDetail}`,
    `Winner     ${order.winnerName} · ${order.winnerRole}`,
    `Unit       ${formatGbpExact(order.unitPricePence)}`,
    `Quantity   ${order.quantity}`,
    `Total      ${formatGbpExact(order.totalPence)}`,
    `Margin     ${formatGbpExact(order.marginPence)} over cost`,
    "",
    `Floor      ${formatGbpExact(order.floorPricePence)} held`,
  ];

  if (order.blocked.length === 0) {
    lines.push("Rejected   none");
  } else {
    lines.push("Rejected   below floor");
    for (const row of order.blocked) {
      const qty = row.quantity == null ? "counter" : `× ${row.quantity}`;
      lines.push(`           ${row.name}  ${formatGbpExact(row.unitPricePence)} ${qty}`);
    }
  }

  lines.push("", `${order.remainder} jackets remain on the rail.`);
  return lines.join("\n");
}

export function settle(input: {
  events: NegotiationEvent[];
  floorPricePence: number;
  lot: Lot;
  now: string;
}): { ok: true; order: Order; receipt: Receipt } | { ok: false; reason: "no_legal_offer"; book: Book } {
  const book = buildBook(input.events, input.floorPricePence, input.lot.quantity);
  if (!book.winner) return { ok: false, reason: "no_legal_offer", book };
  const order = createOrder({
    lot: input.lot,
    winner: book.winner,
    floorPricePence: input.floorPricePence,
    blocked: book.blocked,
    now: input.now,
  });
  return { ok: true, order, receipt: { ...order, text: renderReceipt(order) } };
}

export function docketId(timestamp: string): string {
  const digits = timestamp.replace(/\D/g, "");
  return `LD-${digits.slice(8, 14) || "000000"}`;
}

export function stampEvents(events: Omit<NegotiationEvent, "at">[], startIso: string): NegotiationEvent[] {
  const start = Date.parse(startIso);
  return events.map((event, index) => ({
    ...event,
    at: new Date(start + index * 1000).toISOString(),
  }));
}

export function parseIncomingEvent(value: unknown): NegotiationEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.agentId !== "string" || !AGENTS.includes(row.agentId as AgentId)) return null;
  if (typeof row.action !== "string" || !ACTIONS.includes(row.action as Action)) return null;
  if (typeof row.say !== "string" || typeof row.at !== "string") return null;
  const unit = row.unitPricePence;
  const qty = row.quantity;
  if (!(unit == null || (typeof unit === "number" && Number.isInteger(unit)))) return null;
  if (!(qty == null || (typeof qty === "number" && Number.isInteger(qty)))) return null;
  return {
    agentId: row.agentId as AgentId,
    action: row.action as Action,
    say: row.say.slice(0, 500),
    unitPricePence: unit ?? null,
    quantity: qty ?? null,
    at: row.at,
  };
}

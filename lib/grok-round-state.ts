import { parseDemoConfig, type DemoConfig } from "./grok-demo";

export interface RoundMember {
  id: string;
  name: string;
  role: string;
  state: "active" | "withdrawing" | "withdrawn" | "won" | "lost";
  removal?: "pending" | "removed" | "failed";
  reason?: string;
}
export interface RoundOffer {
  id: string;
  botId: string;
  botName: string;
  quantity: number;
  unitPricePence: number;
  totalPence: number;
}
export interface RoundState {
  roundId: string;
  botId: string;
  status: "negotiating" | "awaiting-ack" | "closed";
  config: DemoConfig;
  members: RoundMember[];
  offers: RoundOffer[];
  bestOfferIds: string[];
  approval?: {
    id: string;
    offerIds: string[];
    allocations: RoundOffer[];
    totalPence: number;
    quantity: number;
    remaining: number;
    acknowledged: boolean;
  };
  error?: string;
  closedReason?: string;
  approvalDelivery?: "queued" | "sending" | "sent" | "uncertain" | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function positive(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function offer(value: unknown): value is RoundOffer {
  return record(value) && typeof value.id === "string" && typeof value.botId === "string" && typeof value.botName === "string"
    && positive(value.quantity) && positive(value.unitPricePence) && positive(value.totalPence)
    && value.quantity * value.unitPricePence === value.totalPence;
}

export function parseRoundState(value: unknown, botId: string): RoundState | null {
  if (value === null) return null;
  const invalid = () => new Error("The connector returned an invalid negotiation state. Update the connector and reconnect.");
  if (!record(value) || value.botId !== botId || typeof value.roundId !== "string"
    || !["negotiating", "awaiting-ack", "closed"].includes(String(value.status))
    || !Array.isArray(value.members) || !value.members.every(member => record(member) && typeof member.id === "string"
      && typeof member.name === "string" && typeof member.role === "string"
      && ["active", "withdrawing", "withdrawn", "won", "lost"].includes(String(member.state))
      && (member.removal === undefined || ["pending", "removed", "failed"].includes(String(member.removal))))
    || !Array.isArray(value.offers) || !value.offers.every(offer) || !strings(value.bestOfferIds)) throw invalid();
  const config = parseDemoConfig(value.config);
  if (value.approval !== undefined) {
    const approval = value.approval;
    if (!record(approval) || typeof approval.id !== "string" || !strings(approval.offerIds)
      || !Array.isArray(approval.allocations) || !approval.allocations.every(offer)
      || !positive(approval.totalPence) || !positive(approval.quantity)
      || typeof approval.remaining !== "number" || !Number.isSafeInteger(approval.remaining) || approval.remaining < 0
      || typeof approval.acknowledged !== "boolean") throw invalid();
  }
  return { ...(value as unknown as RoundState), config, error: typeof value.error === "string" ? value.error : undefined };
}

export function visibleGroupMessage(text: string): string {
  if (text.startsWith("Start a NEW fictional Last Drop negotiation.")) text = text.split("\nEvery buyer offer MUST")[0];
  if (text.startsWith("HUMAN APPROVED fictional allocation for round ")) {
    text = "Approved demo allocation.\n" + text.slice(text.indexOf("\n") + 1).split("\n@")[0];
  }
  return text.replace(/\[\[LASTDROP:\s*\{[\s\S]*?\}\]\]/g, "").trim();
}

export function memberStatus(member: RoundMember): string {
  if (member.removal === "removed") return member.state === "withdrawn" ? "Withdrew · left group" : "Left group";
  if (member.removal === "failed") return "Could not leave group";
  if (member.removal === "pending" || member.state === "withdrawing") return "Leaving group";
  if (member.state === "won") return "Deal selected";
  if (member.state === "lost") return "Not selected";
  if (member.state === "withdrawn") return "Withdrawn";
  return member.role === "merchant" ? "Merchant" : "Negotiating";
}

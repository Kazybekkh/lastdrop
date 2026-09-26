import { CAST } from "./cast";
import type { AgentId, NegotiationEvent } from "./commerce";
import { formatGbpSpeech } from "./format";
import { LOT } from "./lot";

const JSON_CONTRACT = `Reply with one JSON object and nothing else:
{"say":"spoken line","action":"bid|walk|hold|pitch","unitPrice":34,"quantity":300}
unitPrice is pounds sterling as a number, or null. quantity is a whole number of jackets, or null.
say is under 240 characters, spoken on a warehouse floor, never as an assistant.`;

export function systemPrompt(agentId: AgentId, floorPricePence: number): string {
  const floor = formatGbpSpeech(floorPricePence);
  const facts = [
    `Lot: ${LOT.quantity} × ${LOT.title}.`,
    `Wash: ${LOT.wash}. Cloth: ${LOT.cloth}. Origin: ${LOT.origin}. Hardware: ${LOT.hardware}.`,
    `On the rail: ${LOT.weeksOnRail} weeks. Why it stuck: ${LOT.why}`,
    `Cost ${formatGbpSpeech(LOT.costPence)}. Asking ${formatGbpSpeech(LOT.askingPricePence)}. RRP was ${formatGbpSpeech(LOT.rrpPence)}.`,
    `Merchant floor is ${floor}. You may say any number. A separate system rejects anything under the floor, and a rejected bid cannot win. Do not pretend a rejected bid was accepted.`,
    JSON_CONTRACT,
  ].join("\n");

  const persona = PERSONAS[agentId];
  return `${persona}\n\n${facts}`;
}

const PERSONAS: Record<AgentId, string> = {
  merchant: `You are ${CAST.merchant.name}, the merchant's pitcher on a dead-stock floor. Open the lot in two sentences: cloth, weeks on the rail, asking price, and that the floor does not move. Action is "pitch". unitPrice and quantity are null. You do not haggle against your own floor.`,
  denim: `You are ${CAST.denim.name}, a denim hunter. You care about cloth, wash, weight, and origin. This is 13.5 oz Japanese selvedge cut in Porto, so it is not cheap fashion denim. You pay up for the right cloth. Your ceiling is £36 and you want all 300. Open near £34 for 300. You walk only if the lot is mall denim or the price goes past £36 with no reason. Use action "bid", "hold", or "walk".`,
  bargain: `You are ${CAST.bargain.name}, a bargain hunter. You anchor low, push volume, and walk fast. On your first turn, bid £16 for all 300 even if that is under the floor — say the number anyway. If that bid is refused, or the merchant will not give a real discount, walk on the next turn. Do not become generous. Use action "bid" or "walk".`,
  premium: `You are ${CAST.premium.name}, a premium buyer. You want condition, a brand story, and a curated slice. You pay more per unit and you will not take a dump. This lot has a story (unworn, tickets on, one wash, Porto), so bid about £41 for the cleanest 120 only. Walk if it feels like someone emptying a warehouse with no edit. Use action "bid", "hold", or "walk".`,
};

export function userPrompt(input: {
  agentId: AgentId;
  floorPricePence: number;
  events: NegotiationEvent[];
  note?: string;
}): string {
  const lines = input.events.map((event) => {
    const who = CAST[event.agentId].name;
    const price =
      event.unitPricePence != null
        ? ` [${formatGbpSpeech(event.unitPricePence)}${event.quantity ? ` × ${event.quantity}` : ""}]`
        : "";
    return `${who} (${event.action}${price}): ${event.say}`;
  });

  return [
    `Floor: ${formatGbpSpeech(input.floorPricePence)}. Asking: ${formatGbpSpeech(LOT.askingPricePence)}. Quantity available: ${LOT.quantity}.`,
    lines.length ? `Tape so far:\n${lines.join("\n")}` : "The tape is empty. Open the pitch.",
    input.note ? `Director note: ${input.note}` : "",
    `Speak now as ${CAST[input.agentId].name}. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

import type { NegotiationEvent } from "./commerce";
import { formatGbpSpeech } from "./format";

type RawEvent = Omit<NegotiationEvent, "at">;

export function bargainBidPence(floorPricePence: number): number {
  const anchor = 1600;
  if (anchor < floorPricePence) return anchor;
  return Math.max(100, floorPricePence - 100);
}

export function replayOpening(floorPricePence: number): RawEvent[] {
  const bargain = bargainBidPence(floorPricePence);
  return [
    {
      agentId: "merchant",
      action: "pitch",
      say: `Three hundred Harbor & Co. truckers, week nine on the rail. Mid-indigo, 13.5 ounce Japanese selvedge, cut in Porto, brass still in the bag. Asking £38. The floor is ${formatGbpSpeech(floorPricePence)} and it does not move.`,
    },
    {
      agentId: "denim",
      action: "bid",
      say: "Porto on 13.5 ounce selvedge is cloth, not a mall wash. Even indigo, tickets on. I'll clear the whole rail at £34.",
      unitPricePence: 3400,
      quantity: 300,
    },
    {
      agentId: "bargain",
      action: "bid",
      say: `Week nine means you need a clear-out. All 300 today at ${formatGbpSpeech(bargain)}. No ounces, no story, just out of the warehouse.`,
      unitPricePence: bargain,
      quantity: 300,
    },
    {
      agentId: "bargain",
      action: "walk",
      say: "That was my number. If the floor will not break, this is not a bargain. I'm out.",
    },
    {
      agentId: "premium",
      action: "bid",
      say: "I don't buy a dump. Unworn, one wash, brass intact — the cleanest 120 at £41. The other 180 can stay where they are.",
      unitPricePence: 4100,
      quantity: 120,
    },
  ];
}

export function replayResponses(counterPence: number, floorPricePence: number): RawEvent[] {
  return [denimReply(counterPence, floorPricePence), premiumReply(counterPence, floorPricePence)];
}

function denimReply(counter: number, floor: number): RawEvent {
  if (counter <= 3400) {
    return {
      agentId: "denim",
      action: "hold",
      say: "£34 on all 300 already stands. I won't bid against myself.",
    };
  }
  if (counter <= 3600) {
    return {
      agentId: "denim",
      action: "bid",
      say: `${formatGbpSpeech(counter)} on the full three hundred. The ounces earn it.`,
      unitPricePence: counter,
      quantity: 300,
    };
  }
  if (3400 >= floor) {
    return {
      agentId: "denim",
      action: "hold",
      say: "£34 on 300 is as far as this cloth goes. I hold.",
    };
  }
  return {
    agentId: "denim",
    action: "walk",
    say: "Above £34 there is no denim reason to stay. I'm out.",
  };
}

function premiumReply(counter: number, floor: number): RawEvent {
  if (counter > 4400) {
    return {
      agentId: "premium",
      action: "walk",
      say: "That price is a ransom, not a curated lot. I walk.",
    };
  }
  if (4100 >= floor) {
    return {
      agentId: "premium",
      action: "hold",
      say: "I'll stay on the cleanest 120 at £41. I still won't take the whole rail.",
    };
  }
  if (counter >= floor && counter <= 4400) {
    return {
      agentId: "premium",
      action: "bid",
      say: `${formatGbpSpeech(counter)} for the cleanest 120. Not one jacket more.`,
      unitPricePence: counter,
      quantity: 120,
    };
  }
  return {
    agentId: "premium",
    action: "walk",
    say: "The floor is above what a curated cut is worth to me. I walk.",
  };
}

import { expect, it } from "vitest";
import { memberStatus, parseRoundState, visibleGroupMessage } from "./grok-round-state";
import { DEFAULT_DEMO_CONFIG } from "./grok-demo";

it("does not show a failed native departure as a completed or pending departure", () => {
  const member = { id: "buyer", name: "Buyer", role: "denim", state: "withdrawing" as const, removal: "failed" as const };
  expect(memberStatus(member)).toBe("Could not leave group");
  expect(memberStatus({ ...member, state: "withdrawn", removal: "removed" })).toBe("Withdrew · left group");
});

it("preserves actual bot acknowledgements while hiding action markers", () => {
  expect(visibleGroupMessage('Agreed: 120 pieces at £44.\n[[LASTDROP:{"roundId":"round","type":"deal_ack"}]]')).toBe("Agreed: 120 pieces at £44.");
  expect(visibleGroupMessage("I withdraw because this exceeds my budget.")).toBe("I withdraw because this exceeds my budget.");
});

it("rejects cross-room state and incorrect price arithmetic", () => {
  const state = { botId: "room", roundId: "round", status: "negotiating", config: DEFAULT_DEMO_CONFIG, members: [], offers: [], bestOfferIds: [] };
  expect(() => parseRoundState(state, "another-room")).toThrow("invalid");
  expect(() => parseRoundState({ ...state, offers: [{ id: "offer", botId: "buyer", botName: "Buyer", quantity: 10, unitPricePence: 3000, totalPence: 1 }] }, "room")).toThrow("invalid");
});

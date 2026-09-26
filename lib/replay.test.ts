import { describe, expect, it } from "vitest";
import { buildBook, settle, stampEvents } from "./commerce";
import { LOT } from "./lot";
import { bargainBidPence, replayOpening, replayResponses } from "./replay";

describe("recorded round", () => {
  it("keeps Len under a £22 floor, walks him, and leaves Mara ahead of Ida", () => {
    const events = stampEvents(replayOpening(2200), "2026-09-26T15:00:00.000Z");
    const book = buildBook(events, 2200, LOT.quantity);

    expect(bargainBidPence(2200)).toBe(1600);
    expect(book.blocked.map((row) => row.agentId)).toEqual(["bargain"]);
    expect(book.walked).toEqual(["bargain"]);
    expect(book.winner).toMatchObject({ agentId: "denim", unitPricePence: 3400, quantity: 300 });
    expect(book.standing.find((row) => row.agentId === "premium")).toMatchObject({
      unitPricePence: 4100,
      quantity: 120,
    });
  });

  it("still blocks Len when the merchant drops the floor to his anchor", () => {
    expect(bargainBidPence(1600)).toBe(1500);
    const events = stampEvents(replayOpening(1600), "2026-09-26T15:00:00.000Z");
    const book = buildBook(events, 1600, LOT.quantity);
    expect(book.blocked[0]?.unitPricePence).toBe(1500);
    expect(book.winner?.agentId).toBe("denim");
  });

  it("lets a £36 counter raise Mara without letting her previous bid disappear", () => {
    const opening = stampEvents(replayOpening(2200), "2026-09-26T15:00:00.000Z");
    const counter = {
      agentId: "merchant" as const,
      action: "counter" as const,
      say: "£36 on all 300.",
      unitPricePence: 3600,
      at: "2026-09-26T15:00:10.000Z",
    };
    const replies = stampEvents(replayResponses(3600, 2200), "2026-09-26T15:00:11.000Z");
    const result = settle({
      events: [...opening, counter, ...replies],
      floorPricePence: 2200,
      lot: LOT,
      now: "2026-09-26T15:06:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.winnerName).toBe("Mara");
    expect(result.order.unitPricePence).toBe(3600);
    expect(result.order.quantity).toBe(300);
    expect(result.order.totalPence).toBe(1_080_000);
    expect(result.receipt.text).toContain("Len  £16.00 × 300");
  });

  it("drops Mara under the rail when the floor moves above £34", () => {
    const events = stampEvents(replayOpening(3500), "2026-09-26T15:00:00.000Z");
    const book = buildBook(events, 3500, LOT.quantity);
    expect(book.winner?.agentId).toBe("premium");
    expect(book.blocked.map((row) => row.agentId).sort()).toEqual(["bargain", "denim"]);
  });
});

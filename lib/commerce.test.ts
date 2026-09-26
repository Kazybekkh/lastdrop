import { describe, expect, it } from "vitest";
import {
  buildBook,
  createOrder,
  parseIncomingEvent,
  selectWinner,
  settle,
  stampEvents,
  type NegotiationEvent,
  type StandingOffer,
} from "./commerce";
import { LOT } from "./lot";

const FLOOR = 2200;
const NOW = "2026-09-26T15:04:00.000Z";

function bid(
  agentId: NegotiationEvent["agentId"],
  unitPricePence: number,
  quantity: number,
  at: string,
): NegotiationEvent {
  return {
    agentId,
    action: "bid",
    say: "bid",
    unitPricePence,
    quantity,
    at,
  };
}

function offer(
  agentId: StandingOffer["agentId"],
  unitPricePence: number,
  quantity: number,
  at: string,
): StandingOffer {
  return {
    agentId,
    unitPricePence,
    quantity,
    totalPence: unitPricePence * quantity,
    at,
    say: "offer",
  };
}

describe("floor rejection", () => {
  it("rejects a bid below the floor and accepts a bid on the floor", () => {
    const book = buildBook(
      [
        bid("bargain", FLOOR - 1, 300, "2026-09-26T15:00:00.000Z"),
        bid("denim", FLOOR, 300, "2026-09-26T15:00:01.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );

    expect(book.blocked).toHaveLength(1);
    expect(book.blocked[0]?.reason).toBe("below_floor");
    expect(book.blocked[0]?.agentId).toBe("bargain");
    expect(book.standing).toHaveLength(1);
    expect(book.standing[0]?.unitPricePence).toBe(FLOOR);
    expect(book.winner?.agentId).toBe("denim");
  });

  it("never lets a below-floor bid win, even when its total is larger", () => {
    const book = buildBook(
      [
        bid("bargain", 1600, 300, "2026-09-26T15:00:00.000Z"),
        bid("premium", 3000, 50, "2026-09-26T15:00:01.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );

    expect(1600 * 300).toBeGreaterThan(3000 * 50);
    expect(book.winner?.agentId).toBe("premium");
    expect(book.blocked.map((row) => row.agentId)).toEqual(["bargain"]);
  });

  it("blocks a merchant counter under the floor and keeps it visible", () => {
    const book = buildBook(
      [
        {
          agentId: "merchant",
          action: "counter",
          say: "£20 and done",
          unitPricePence: 2000,
          at: "2026-09-26T15:00:00.000Z",
        },
      ],
      FLOOR,
      LOT.quantity,
    );

    expect(book.winner).toBeNull();
    expect(book.blocked[0]?.stamp).toBe("blocked");
    expect(book.events[0]?.reason).toBe("below_floor");
  });

  it("rejects a bid after that buyer has walked", () => {
    const book = buildBook(
      [
        {
          agentId: "bargain",
          action: "walk",
          say: "out",
          at: "2026-09-26T15:00:00.000Z",
        },
        bid("bargain", 4000, 300, "2026-09-26T15:00:01.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );

    expect(book.winner).toBeNull();
    expect(book.events[1]?.reason).toBe("already_walked");
  });
});

describe("winner selection", () => {
  it("picks the highest total above the floor, not the highest unit price", () => {
    const book = buildBook(
      [
        bid("denim", 3400, 300, "2026-09-26T15:00:00.000Z"),
        bid("premium", 4100, 120, "2026-09-26T15:00:01.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );

    expect(book.winner).toMatchObject({
      agentId: "denim",
      unitPricePence: 3400,
      quantity: 300,
      totalPence: 3400 * 300,
    });
  });

  it("breaks total ties on unit price, then on the earlier bid", () => {
    const byUnit = selectWinner([
      offer("denim", 2000, 10, "2026-09-26T15:00:00.000Z"),
      offer("premium", 1000, 20, "2026-09-26T15:00:01.000Z"),
    ]);
    expect(byUnit?.agentId).toBe("denim");

    const byTime = selectWinner([
      offer("premium", 2500, 10, "2026-09-26T15:00:05.000Z"),
      offer("denim", 2500, 10, "2026-09-26T15:00:01.000Z"),
    ]);
    expect(byTime?.agentId).toBe("denim");
  });

  it("withdraws a buyer's book when they walk, and ignores a later worse bid", () => {
    const walked = buildBook(
      [
        bid("denim", 3400, 300, "2026-09-26T15:00:00.000Z"),
        {
          agentId: "denim",
          action: "walk",
          say: "out",
          at: "2026-09-26T15:00:01.000Z",
        },
        bid("premium", 4100, 120, "2026-09-26T15:00:02.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );
    expect(walked.winner?.agentId).toBe("premium");
    expect(walked.walked).toEqual(["denim"]);

    const held = buildBook(
      [
        bid("denim", 3400, 300, "2026-09-26T15:00:00.000Z"),
        bid("denim", 3000, 300, "2026-09-26T15:00:01.000Z"),
      ],
      FLOOR,
      LOT.quantity,
    );
    expect(held.winner?.unitPricePence).toBe(3400);
  });

  it("rejects a quantity the lot cannot fill", () => {
    const book = buildBook([bid("denim", 3400, LOT.quantity + 1, "2026-09-26T15:00:00.000Z")], FLOOR, LOT.quantity);
    expect(book.winner).toBeNull();
    expect(book.events[0]?.reason).toBe("bad_quantity");
  });
});

describe("order and receipt", () => {
  it("creates an order and a readable receipt from the winning legal offer", () => {
    const events = stampEvents(
      [
        { agentId: "denim", action: "bid", say: "cloth", unitPricePence: 3600, quantity: 300 },
        { agentId: "bargain", action: "bid", say: "cheap", unitPricePence: 1600, quantity: 300 },
        { agentId: "premium", action: "bid", say: "edit", unitPricePence: 4100, quantity: 120 },
      ],
      "2026-09-26T15:00:00.000Z",
    );

    const result = settle({ events, floorPricePence: FLOOR, lot: LOT, now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.order).toMatchObject({
      id: "LD-150400",
      lotId: LOT.id,
      lotTitle: LOT.title,
      winnerName: "Mara",
      winnerRole: "Denim hunter",
      unitPricePence: 3600,
      quantity: 300,
      totalPence: 3600 * 300,
      floorPricePence: FLOOR,
      marginPence: 3600 - LOT.costPence,
      timestamp: NOW,
      remainder: 0,
    });
    expect(result.order.blocked).toEqual([
      expect.objectContaining({ name: "Len", unitPricePence: 1600, quantity: 300, kind: "bid" }),
    ]);

    const text = result.receipt.text;
    expect(text).toContain(LOT.title);
    expect(text).toContain("Mara · Denim hunter");
    expect(text).toContain("£36.00");
    expect(text).toContain("Quantity   300");
    expect(text).toContain("£10,800.00");
    expect(text).toContain("26 Sept 2026, 16:04");
    expect(text).toContain("£22.00 held");
    expect(text).toContain("Len  £16.00 × 300");
    expect(text).toContain("0 jackets remain");
  });

  it("refuses to settle when every bid is under the floor", () => {
    const result = settle({
      events: [bid("denim", 1600, 300, "2026-09-26T15:00:00.000Z")],
      floorPricePence: FLOOR,
      lot: LOT,
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses createOrder if a caller hands it a below-floor winner", () => {
    expect(() =>
      createOrder({
        lot: LOT,
        winner: offer("bargain", 1600, 300, NOW),
        floorPricePence: FLOOR,
        blocked: [],
        now: NOW,
      }),
    ).toThrow(/floor/i);
  });

  it("drops malformed incoming events", () => {
    expect(parseIncomingEvent({ agentId: "nope", action: "bid", say: "x", at: NOW })).toBeNull();
    expect(
      parseIncomingEvent({
        agentId: "denim",
        action: "bid",
        say: "cloth",
        unitPricePence: 3400,
        quantity: 300,
        at: NOW,
      })?.agentId,
    ).toBe("denim");
  });
});

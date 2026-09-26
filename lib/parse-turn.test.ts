import { describe, expect, it } from "vitest";
import { parseTurn } from "./parse-turn";

describe("parseTurn", () => {
  it("reads a fenced bid and converts pounds to pence", () => {
    const parsed = parseTurn(
      '```json\n{"say":"All 300 at sixteen.","action":"bid","unitPrice":"£16","quantity":300}\n```',
      "bargain",
    );
    expect(parsed).toEqual({
      action: "bid",
      say: "All 300 at sixteen.",
      unitPricePence: 1600,
      quantity: 300,
    });
  });

  it("treats a walk as speech only, even if a price came along", () => {
    const parsed = parseTurn(
      '{"say":"I am out.","action":"leave","unitPrice":16,"quantity":300}',
      "bargain",
    );
    expect(parsed.action).toBe("walk");
    expect(parsed.unitPricePence).toBeNull();
    expect(parsed.quantity).toBeNull();
  });

  it("keeps the merchant on a pitch", () => {
    const parsed = parseTurn('{"say":"Floor holds.","action":"bid","unitPrice":30,"quantity":300}', "merchant");
    expect(parsed.action).toBe("pitch");
    expect(parsed.unitPricePence).toBeNull();
  });
});

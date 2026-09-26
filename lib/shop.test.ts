import { describe, expect, it } from "vitest";
import type { Receipt } from "./commerce";
import {
  CATALOG,
  RETAIL_ORDERS,
  TRUCKER_SKU,
  applyOrder,
  deadStock,
  nextOrderName,
  stockLabel,
  readProduct,
  wholesaleFromReceipt,
} from "./shop";

function receipt(quantity: number): Receipt {
  const unit = 3600;
  return {
    id: "LD-150400",
    lotId: "harbor-trucker-300",
    lotTitle: "Harbor & Co. trucker jacket",
    lotDetail: "13.5 oz Japanese selvedge · Cut and sewn in Porto",
    winnerAgentId: "denim",
    winnerName: "Mara",
    winnerRole: "Denim hunter",
    unitPricePence: unit,
    quantity,
    totalPence: unit * quantity,
    floorPricePence: 2200,
    costPence: 1940,
    marginPence: unit - 1940,
    timestamp: "2026-09-26T15:04:00.000Z",
    blocked: [],
    remainder: 300 - quantity,
    text: "",
  };
}

describe("dead stock", () => {
  it("flags only the trucker in the Harbor catalog", () => {
    const stuck = deadStock(CATALOG);
    expect(stuck.map((product) => product.handle)).toEqual(["trucker-jacket"]);

    const trucker = readProduct(stuck[0]!);
    expect(trucker.onHand).toBe(300);
    expect(trucker.sold).toBe(12);
    expect(trucker.weeksOfCover).toBeCloseTo(225, 5);
    expect(trucker.sellThrough).toBeCloseTo(12 / 312, 5);
    expect(trucker.costTiedPence).toBe(300 * 1940);
    expect(trucker.dead).toBe(true);

    for (const handle of ["loom-jean", "oxford-shirt", "canvas-tote"]) {
      const product = CATALOG.find((item) => item.handle === handle);
      expect(readProduct(product!).dead).toBe(false);
    }
  });

  it("does not flag a deep pile that is actually selling", () => {
    const fast = {
      ...CATALOG[0]!,
      variants: [{ ...CATALOG[0]!.variants[0]!, onHand: 200, soldInWindow: 180 }],
    };
    expect(readProduct(fast).dead).toBe(false);
  });
});

describe("wholesale order", () => {
  it("numbers the next Shopify-style order after the retail book", () => {
    expect(nextOrderName(RETAIL_ORDERS)).toBe("#1042");
  });

  it("books Mara's docket against the trucker SKU and takes the units off hand", () => {
    const order = wholesaleFromReceipt(receipt(300));
    expect(order).toMatchObject({
      name: "#1042",
      channel: "The Last Drop",
      customer: "Mara · Denim hunter",
      financial: "paid",
      docketId: "LD-150400",
      totalPence: 1_080_000,
    });
    expect(order.lines).toEqual([
      {
        sku: TRUCKER_SKU,
        title: "Harbor & Co. trucker jacket",
        quantity: 300,
        unitPricePence: 3600,
      },
    ]);

    const after = applyOrder(CATALOG, order);
    const variant = after[0]!.variants[0]!;
    expect(variant.sku).toBe(TRUCKER_SKU);
    expect(variant.onHand).toBe(0);
    expect(stockLabel(readProduct(after[0]!))).toBe("Cleared");
    expect(after[1]!.variants[0]!.onHand).toBe(48);
  });

  it("leaves the rest of the run when the buyer takes a slice", () => {
    const order = wholesaleFromReceipt(receipt(120));
    const after = applyOrder(CATALOG, order);
    expect(after[0]!.variants[0]!.onHand).toBe(180);
  });
});

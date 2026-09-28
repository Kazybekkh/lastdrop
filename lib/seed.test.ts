import { describe, expect, it } from "vitest"
import { loadSeed } from "./seed"

describe("seed", () => {
  const seed = loadSeed()

  it("has three lots and four bots", () => {
    expect(seed.lots).toHaveLength(3)
    expect(seed.bots).toHaveLength(4)
  })

  it("stores money as integer pence and leaves the floor off the reseller records", () => {
    for (const lot of seed.lots) {
      expect(Number.isInteger(lot.floor_price)).toBe(true)
    }
    for (const bot of seed.bots) {
      expect(bot.max_budget === null || Number.isInteger(bot.max_budget)).toBe(true)
      expect("floor_price" in bot).toBe(false)
    }
  })

  it("names the merchant and the three resellers", () => {
    expect(seed.bots.map((bot) => bot.name)).toEqual([
      "Merchant bot",
      "Denim Dan",
      "Bargain Bea",
      "Premium Priya",
    ])
    expect(seed.bots.filter((bot) => bot.role === "merchant")).toHaveLength(1)
    expect(seed.bots.filter((bot) => bot.role === "reseller")).toHaveLength(3)
  })
})

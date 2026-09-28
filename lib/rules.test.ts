import { describe, expect, it } from "vitest"
import { canContinue, pickBest, validateOffer } from "./rules"

const lot = { floor_price: 1000 }
const reseller = { max_budget: 2000 as number | null }
const openBudget = { max_budget: null }

describe("validateOffer", () => {
  it("accepts a price on the floor and inside the budget", () => {
    expect(validateOffer({ price: 1000 }, lot, reseller)).toBe("valid")
    expect(validateOffer({ price: 2000 }, lot, reseller)).toBe("valid")
  })

  it("rejects a price under the floor before it checks the budget", () => {
    expect(validateOffer({ price: 999 }, lot, reseller)).toBe("below_floor")
    expect(validateOffer({ price: 500 }, lot, { max_budget: 400 })).toBe("below_floor")
  })

  it("rejects a price over the reseller budget", () => {
    expect(validateOffer({ price: 2001 }, lot, reseller)).toBe("over_budget")
  })

  it("does not apply a budget cap when max_budget is null", () => {
    expect(validateOffer({ price: 5000 }, lot, openBudget)).toBe("valid")
  })
})

describe("pickBest", () => {
  it("returns the highest valid offer", () => {
    const offers = [
      { id: "low", price: 1100, status: "valid" as const },
      { id: "walked", price: 9000, status: "walked_away" as const },
      { id: "under", price: 800, status: "below_floor" as const },
      { id: "over", price: 4000, status: "over_budget" as const },
      { id: "high", price: 1800, status: "valid" as const },
    ]
    expect(pickBest(offers)?.id).toBe("high")
  })

  it("keeps the earlier offer when two valid prices match", () => {
    const offers = [
      { id: "first", price: 1500, status: "valid" as const },
      { id: "second", price: 1500, status: "valid" as const },
    ]
    expect(pickBest(offers)?.id).toBe("first")
  })

  it("returns null when nothing is valid", () => {
    expect(pickBest([])).toBeNull()
    expect(pickBest([{ price: 100, status: "walked_away" as const }])).toBeNull()
  })
})

describe("canContinue", () => {
  const base = { max_rounds: 3, reseller_count: 3, resellers_walked_away: 0 }

  it("continues before the last round while a reseller is still in", () => {
    expect(canContinue({ ...base, round: 0 })).toBe(true)
    expect(canContinue({ ...base, round: 2, resellers_walked_away: 2 })).toBe(true)
  })

  it("stops once the completed round has reached max_rounds", () => {
    expect(canContinue({ ...base, round: 3 })).toBe(false)
  })

  it("stops when every reseller has walked", () => {
    expect(canContinue({ ...base, round: 1, resellers_walked_away: 3 })).toBe(false)
  })
})

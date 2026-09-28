import type { OfferStatus, OfferValidity } from "./types"

type Priced = { price: number }
type Floor = { floor_price: number }
type Budget = { max_budget: number | null }

export type ScoredOffer = Priced & { status: OfferStatus }

export type NegotiationProgress = {
  round: number
  max_rounds: number
  reseller_count: number
  resellers_walked_away: number
}

export function validateOffer(offer: Priced, lot: Floor, bot: Budget): OfferValidity {
  if (offer.price < lot.floor_price) return "below_floor"
  if (bot.max_budget !== null && offer.price > bot.max_budget) return "over_budget"
  return "valid"
}

export function pickBest<T extends ScoredOffer>(offers: T[]): T | null {
  let best: T | null = null
  for (const offer of offers) {
    if (offer.status !== "valid") continue
    if (!best || offer.price > best.price) best = offer
  }
  return best
}

export function canContinue(negotiation: NegotiationProgress): boolean {
  if (negotiation.round >= negotiation.max_rounds) return false
  if (
    negotiation.reseller_count > 0 &&
    negotiation.resellers_walked_away >= negotiation.reseller_count
  ) {
    return false
  }
  return true
}

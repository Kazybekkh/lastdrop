export type LotStatus = "open" | "negotiating" | "sold"
export type BotRole = "merchant" | "reseller"
export type NegotiationStatus = "running" | "awaiting_approval" | "closed"
export type OfferStatus = "valid" | "below_floor" | "over_budget" | "walked_away"
export type OfferValidity = Exclude<OfferStatus, "walked_away">

export type Lot = {
  id: string
  title: string
  description: string
  category: string
  quantity: number
  sizes: string[]
  condition: string
  floor_price: number
  market_price_note: string | null
  days_unsold: number
  status: LotStatus
}

export type Bot = {
  id: string
  name: string
  role: BotRole
  personality: string
  wants: string
  max_budget: number | null
}

export type Offer = {
  id: string
  negotiation_id: string
  bot_id: string
  round: number
  price: number
  message: string
  status: OfferStatus
  created_at: string
}

export type Negotiation = {
  id: string
  lot_id: string
  round: number
  max_rounds: number
  status: NegotiationStatus
}

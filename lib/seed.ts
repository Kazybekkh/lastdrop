import seedJson from "../data/seed.json"
import type { Bot, BotRole, Lot, LotStatus } from "./types"

const LOT_STATUSES = new Set<LotStatus>(["open", "negotiating", "sold"])
const ROLES = new Set<BotRole>(["merchant", "reseller"])

export type SeedFile = {
  lots: Lot[]
  bots: Bot[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireString(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`)
  }
  return value
}

function requireInt(row: Record<string, unknown>, key: string, label: string): number {
  const value = row[key]
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label}.${key} must be an integer number of pence or a count`)
  }
  return value
}

function parseLot(value: unknown, index: number): Lot {
  if (!isRecord(value)) throw new Error(`lots[${index}] must be an object`)
  const label = `lots[${index}]`
  const status = requireString(value, "status", label)
  if (!LOT_STATUSES.has(status as LotStatus)) {
    throw new Error(`${label}.status is not a lot status`)
  }
  const note = value.market_price_note
  if (note !== null && typeof note !== "string") {
    throw new Error(`${label}.market_price_note must be a string or null`)
  }
  if (!Array.isArray(value.sizes) || value.sizes.some((size) => typeof size !== "string")) {
    throw new Error(`${label}.sizes must be an array of strings`)
  }
  return {
    id: requireString(value, "id", label),
    title: requireString(value, "title", label),
    description: requireString(value, "description", label),
    category: requireString(value, "category", label),
    quantity: requireInt(value, "quantity", label),
    sizes: value.sizes,
    condition: requireString(value, "condition", label),
    floor_price: requireInt(value, "floor_price", label),
    market_price_note: note,
    days_unsold: requireInt(value, "days_unsold", label),
    status: status as LotStatus,
  }
}

function parseBot(value: unknown, index: number): Bot {
  if (!isRecord(value)) throw new Error(`bots[${index}] must be an object`)
  const label = `bots[${index}]`
  const role = requireString(value, "role", label)
  if (!ROLES.has(role as BotRole)) throw new Error(`${label}.role is not a bot role`)
  const budget = value.max_budget
  if (budget !== null && (typeof budget !== "number" || !Number.isInteger(budget))) {
    throw new Error(`${label}.max_budget must be an integer number of pence or null`)
  }
  return {
    id: requireString(value, "id", label),
    name: requireString(value, "name", label),
    role: role as BotRole,
    personality: requireString(value, "personality", label),
    wants: requireString(value, "wants", label),
    max_budget: budget,
  }
}

export function parseSeed(value: unknown): SeedFile {
  if (!isRecord(value) || !Array.isArray(value.lots) || !Array.isArray(value.bots)) {
    throw new Error("seed must be an object with lots and bots arrays")
  }
  return {
    lots: value.lots.map(parseLot),
    bots: value.bots.map(parseBot),
  }
}

export function loadSeed(): SeedFile {
  return parseSeed(seedJson)
}

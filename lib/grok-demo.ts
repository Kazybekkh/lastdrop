import { LOT } from "./lot";

export interface DemoConfig {
  product: string;
  quantity: number;
  askingPricePence: number;
  floorPricePence: number;
  denimBudgetPence: number;
  bargainBudgetPence: number;
  premiumBudgetPence: number;
  premiumMaxQuantity: number;
}
export interface DemoMember { id: string; name: string; role?: string }
export interface DemoSetup {
  group: { id: string; name: string; memberIds: string[]; isRunning: boolean; isGroup: true };
  members: DemoMember[];
  created: { bots: string[]; group: boolean };
  brief: string;
  config: DemoConfig;
}
export const DEFAULT_DEMO_CONFIG: DemoConfig = {
  product: `${LOT.title}, unworn ${LOT.cloth}, ${LOT.origin}`,
  quantity: LOT.quantity,
  askingPricePence: LOT.askingPricePence,
  floorPricePence: LOT.defaultFloorPence,
  denimBudgetPence: 1080000,
  bargainBudgetPence: 840000,
  premiumBudgetPence: 552000,
  premiumMaxQuantity: 120,
};
const fields = Object.keys(DEFAULT_DEMO_CONFIG) as (keyof DemoConfig)[];
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function parseDemoConfig(value: unknown): DemoConfig {
  if (!record(value) || typeof value.product !== "string" || !value.product.trim() || value.product.trim().length > 500 || Object.keys(value).some(key => !fields.includes(key as keyof DemoConfig))) throw new Error("Enter a product description of up to 500 characters.");
  for (const key of fields.slice(1)) {
    const number = value[key];
    const maximum = key === "quantity" || key === "premiumMaxQuantity" ? 10000 : 1000000000;
    if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error("Use positive whole quantities and valid prices or budgets.");
  }
  const config = value as unknown as DemoConfig;
  if (config.floorPricePence > config.askingPricePence) throw new Error("The merchant floor cannot exceed the asking price.");
  if (config.premiumMaxQuantity > config.quantity) throw new Error("The premium buyer cannot request more than the lot quantity.");
  return { ...config, product: config.product.trim() };
}
export function parseDemoSetup(value: unknown): DemoSetup {
  if (!record(value) || !record(value.group) || value.group.isGroup !== true || typeof value.group.id !== "string" || !value.group.id || typeof value.group.name !== "string" || !Array.isArray(value.group.memberIds) || value.group.memberIds.length !== 4 || !value.group.memberIds.every(id => typeof id === "string" && id) || new Set(value.group.memberIds).size !== 4 || !Array.isArray(value.members) || value.members.length !== 4 || typeof value.brief !== "string" || !value.brief.trim()) throw new Error("The connector did not return a valid four-bot room. Update the connector and retry.");
  const memberIds = value.group.memberIds;
  const members = value.members.map(member => {
    if (!record(member) || typeof member.id !== "string" || typeof member.name !== "string" || !member.name.trim() || !memberIds.includes(member.id)) throw new Error("The connector returned invalid room members.");
    return { id: member.id, name: member.name, ...(typeof member.role === "string" ? { role: member.role } : {}) };
  });
  if (new Set(members.map(member => member.id)).size !== 4) throw new Error("The room must contain four distinct bots.");
  return { group: { isGroup: true, id: value.group.id, name: value.group.name, memberIds: value.group.memberIds, isRunning: value.group.isRunning === true }, members, brief: value.brief, config: parseDemoConfig(value.config), created: { bots: record(value.created) && Array.isArray(value.created.bots) ? value.created.bots.filter((id): id is string => typeof id === "string") : [], group: record(value.created) && value.created.group === true } };
}
export function defaultDemoBrief(config: DemoConfig = DEFAULT_DEMO_CONFIG): string {
  const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
  return `Start a NEW fictional negotiation round. Previous offers and approvals do not apply.\n\nStock: ${config.quantity} ${config.product}.\nAsking price: ${money(config.askingPricePence)} each. Merchant floor: ${money(config.floorPricePence)} each.\n\nDenim reseller: prefers the whole lot; maximum total budget ${money(config.denimBudgetPence)}.\nBargain reseller: prioritizes low cost; maximum total budget ${money(config.bargainBudgetPence)}.\nPremium reseller: buys at most ${config.premiumMaxQuantity}; maximum total budget ${money(config.premiumBudgetPence)}.\n\nMerchant: introduce the lot and invite all three buyers. Buyers: choose your own opening offers and respond to competitors. Merchant may counter once; each buyer may respond once more. Compare total recovery, quantities and remaining stock. Recommend an allocation, then STOP for my approval. Keep messages short. This is fictional: no real orders or payments.`;
}

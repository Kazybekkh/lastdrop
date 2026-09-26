import { expect, it } from "vitest";
import { DEFAULT_DEMO_CONFIG, defaultDemoBrief, parseDemoConfig, parseDemoSetup } from "./grok-demo";

it("builds a brief from user constraints without fixing bids or a winner", () => {
  const config = { ...DEFAULT_DEMO_CONFIG, product: "Linen coats", quantity: 180, premiumMaxQuantity: 60, denimBudgetPence: 500000 };
  const brief = defaultDemoBrief(config);
  expect(brief).toContain("180 Linen coats");
  expect(brief).toContain("£5000.00");
  expect(brief).toContain("choose your own opening offers");
  expect(brief).toContain("STOP for my approval");
});
it("rejects invalid quantities and floors in saved or edited setup", () => {
  expect(() => parseDemoConfig({ ...DEFAULT_DEMO_CONFIG, floorPricePence: 10000 })).toThrow("floor");
  expect(() => parseDemoConfig({ ...DEFAULT_DEMO_CONFIG, quantity: 1.2 })).toThrow("whole");
  expect(() => parseDemoConfig({ ...DEFAULT_DEMO_CONFIG, premiumMaxQuantity: 1000 })).toThrow("quantity");
});
it("requires four distinct real members before saving a setup response", () => {
  const ids = ["m", "d", "b", "p"];
  const setup = { group: { id: "room", name: "Stock", memberIds: ids, isRunning: false, isGroup: true }, members: ids.map(id => ({ id, name: id })), config: DEFAULT_DEMO_CONFIG, brief: "Start fictional round", created: { bots: [], group: false } };
  expect(parseDemoSetup(setup).group.id).toBe("room");
  expect(() => parseDemoSetup({ ...setup, members: [...setup.members.slice(0, 3), setup.members[0]] })).toThrow("distinct");
  expect(() => parseDemoSetup({ ...setup, group: { ...setup.group, memberIds: ["m", "m", "b", "p"] } })).toThrow("four-bot");
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { grokStatus, grokTurn, GrokError } from "./grok";
import { grokBotReady, grokBotTurn } from "./grok-bot";

vi.mock("./grok-bot", () => ({ grokBotReady: vi.fn(), grokBotTurn: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GROK_PROVIDER", "");
  vi.stubEnv("XAI_API_KEY", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("uses the skill by default even without an xAI key", async () => {
  expect(await grokStatus()).toMatchObject({ mode: "grok", provider: "grok-bot", model: "Grok Bot" });
  expect(grokBotReady).toHaveBeenCalledOnce();
  const input = { agentId: "merchant" as const, floorPricePence: 2200, events: [] };
  await grokTurn(input);
  expect(grokBotTurn).toHaveBeenCalledWith(input);
});

it("shows connection failures instead of silently switching to recorded bids", async () => {
  vi.mocked(grokBotReady).mockRejectedValue(new GrokError("Sign in first"));
  expect(await grokStatus()).toMatchObject({ mode: "unavailable", message: "Sign in first" });
});

it("runs replay only when explicitly selected", async () => {
  vi.stubEnv("GROK_PROVIDER", "replay");
  expect(await grokStatus()).toMatchObject({ mode: "replay" });
  expect(grokBotReady).not.toHaveBeenCalled();
});

it("keeps xAI available as an explicit provider", async () => {
  vi.stubEnv("GROK_PROVIDER", "xai");
  expect(await grokStatus()).toMatchObject({ mode: "unavailable" });
  vi.stubEnv("XAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"action":"pitch","say":"Welcome"}' } }] })));
  expect(await grokStatus()).toMatchObject({ mode: "grok", provider: "xai" });
  expect(await grokTurn({ agentId: "merchant", floorPricePence: 2200, events: [] })).toMatchObject({ action: "pitch", say: "Welcome" });
  expect(grokBotTurn).not.toHaveBeenCalled();
});

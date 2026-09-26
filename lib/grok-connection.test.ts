import { afterEach, expect, it, vi } from "vitest";
import { connectedTurn } from "./grok-connection";

afterEach(() => vi.unstubAllGlobals());
const input = { agentId: "denim" as const, floorPricePence: 2200, events: [] };
function setup(result: unknown) {
  vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify({ token: "pairing-test", botId: "chosen-bot", botName: "My teammate" }) });
  const fetch = vi.fn().mockResolvedValue(Response.json(result));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("routes a turn to the user's selected bot through localhost only", async () => {
  const fetch = setup({ stillRunning: false, newEntries: [{ kind: "send-message", author: null, text: '{"action":"bid","say":"All 300 at 34","unitPrice":34,"quantity":300}' }] });
  expect(await connectedTurn(input)).toMatchObject({ unitPricePence: 3400, quantity: 300 });
  expect(fetch.mock.calls[0][0]).toBe("http://127.0.0.1:4318/chat");
  expect(JSON.parse(fetch.mock.calls[0][1].body).botId).toBe("chosen-bot");
});
it("rejects unfinished turns and echoed user prompts", async () => {
  setup({ stillRunning: true, newEntries: [] });
  await expect(connectedTurn(input)).rejects.toThrow("still working");
  setup({ stillRunning: false, newEntries: [{ author: "user", text: '{}' }] });
  await expect(connectedTurn(input)).rejects.toThrow("no completed reply");
});
it("reads object-authored native replies only from the selected bot", async () => {
  setup({ stillRunning: false, newEntries: [
    { kind: "send-message", author: { id: "chosen-bot", name: "My teammate" }, text: '{"action":"bid","say":"All 300 at 34","unitPrice":34,"quantity":300}' },
    { kind: "send-message", author: { id: "other-bot", name: "My teammate" }, text: '{"action":"walk","say":"Wrong bot"}' },
    { kind: "tool-result", author: { id: "chosen-bot", name: "My teammate" }, text: '{"action":"walk","say":"Tool output"}' },
  ] });
  expect(await connectedTurn(input)).toMatchObject({ action: "bid", unitPricePence: 3400, quantity: 300 });
});
it("rejects other native authors and tool traces without a completed reply", async () => {
  setup({ stillRunning: false, newEntries: [
    { kind: "send-message", author: { id: "other-bot", name: "My teammate" }, text: '{"action":"walk","say":"Wrong bot"}' },
    { kind: "tool-result", author: { id: "chosen-bot", name: "My teammate" }, text: '{"action":"walk","say":"Tool output"}' },
  ] });
  await expect(connectedTurn(input)).rejects.toThrow("no completed reply");
});

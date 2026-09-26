import { Readable } from "node:stream";
import { expect, it, vi } from "vitest";
import { DEFAULT_DEMO_CONFIG } from "./grok-demo";

// The download is also an importable handler; importing it never reads Keychain or opens a port.
const modulePath = "../public/connect-grok.mjs";
const { createHandler } = await import(modulePath);
const origin = "https://demo.example";
const token = "test-pairing-code";
const group = { id: "room-1", name: "Stock room", memberIds: ["bot-1", "bot-2", "bot-3", "bot-4"], isRunning: false, isGroup: true };
const members = group.memberIds.map((id, index) => ({ id, name: `Teammate ${index + 1}` }));
const setup = { group, members, created: { bots: [], group: false }, brief: "Start a fictional round.", config: DEFAULT_DEMO_CONFIG };
function handler(cli = vi.fn()) { return createHandler({ origin, token, cli }); }
async function request(handle: ReturnType<typeof createHandler>, path: string, body?: unknown, headers: Record<string, string> = { origin, authorization: `Bearer ${token}` }) {
  const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), { method: body === undefined ? "GET" : "POST", url: path, headers });
  let status = 200;
  let output = "";
  const responseHeaders: Record<string, string> = {};
  await handle(req, { setHeader: (name: string, value: string) => { responseHeaders[name] = value; }, writeHead: (code: number) => { status = code; }, end: (value = "") => { output = value; } });
  return { status, body: output ? JSON.parse(output) : null, headers: responseHeaders };
}
it("rejects foreign origins and invalid bearer codes before invoking the secret broker", async () => {
  const cli = vi.fn(); const handle = handler(cli);
  expect((await request(handle, "/setup-demo", {}, { origin: "https://attacker.example", authorization: `Bearer ${token}` })).status).toBe(403);
  expect((await request(handle, "/setup-demo", { token }, { origin })).status).toBe(401);
  expect((await request(handle, "/capabilities", undefined, { origin, authorization: "Bearer wrong" })).status).toBe(401);
  expect(cli).not.toHaveBeenCalled();
});
it("advertises group features only to the paired browser", async () => {
  const response = await request(handler(), "/capabilities");
  expect(response.status).toBe(200);
  expect(response.body.features).toContain("native-group-setup");
  expect(response.headers["Access-Control-Allow-Origin"]).toBe(origin);
  expect(response.headers["Cache-Control"]).toBe("no-store");
});
it("forwards validated dynamic budgets to setup without starting a negotiation", async () => {
  const cli = vi.fn().mockResolvedValue(setup);
  const config = { ...DEFAULT_DEMO_CONFIG, product: "Linen coats", quantity: 180, premiumMaxQuantity: 60, denimBudgetPence: 500000 };
  const response = await request(handler(cli), "/setup-demo", { name: "  New stock  ", config });
  expect(response.status).toBe(200);
  expect(cli).toHaveBeenCalledTimes(1);
  expect(cli.mock.calls[0][0]).toEqual(["setup-demo", "--name", "New stock", "--config-json", JSON.stringify(config)]);
  expect(response.body.config).toEqual(config);
});
it("rejects invalid economics and unknown config fields before any creation", async () => {
  const cli = vi.fn(); const handle = handler(cli);
  for (const config of [
    { ...DEFAULT_DEMO_CONFIG, floorPricePence: 9000 },
    { ...DEFAULT_DEMO_CONFIG, quantity: 3.2 },
    { ...DEFAULT_DEMO_CONFIG, quantity: 10001 },
    { ...DEFAULT_DEMO_CONFIG, denimBudgetPence: 1000000001 },
    { ...DEFAULT_DEMO_CONFIG, premiumMaxQuantity: 301 },
    { ...DEFAULT_DEMO_CONFIG, denimBudgetPence: -1 },
    { ...DEFAULT_DEMO_CONFIG, command: "unexpected" },
  ]) expect((await request(handle, "/setup-demo", { name: "Demo", config })).status).toBe(400);
  expect(cli).not.toHaveBeenCalled();
});
it("verifies the selected native group before sending and preserves its id", async () => {
  const cli = vi.fn().mockResolvedValueOnce({ group, members }).mockResolvedValueOnce({ accepted: true });
  const response = await request(handler(cli), "/group/send", { botId: group.id, prompt: "  What is your offer?  " });
  expect(response.body).toEqual({ accepted: true, groupId: group.id });
  expect(cli.mock.calls.map(call => call[0])).toEqual([["group-info", "--id", group.id], ["send", "--id", group.id, "--prompt", "What is your offer?"]]);
});
it("cannot send through a single bot, another room, duplicate membership or a running group", async () => {
  for (const invalid of [
    { ...group, isGroup: false },
    { ...group, memberIds: ["bot-1"] },
    { ...group, id: "other-room" },
    { ...group, memberIds: ["bot-1", "bot-1"] },
    { ...group, isRunning: true },
  ]) {
    const cli = vi.fn().mockResolvedValue({ group: invalid, members });
    const response = await request(handler(cli), "/group/send", { botId: group.id, prompt: "Start" });
    expect(response.status).toBe(invalid.isRunning ? 409 : 400);
    expect(cli).toHaveBeenCalledTimes(1);
  }
});
it("serializes mutations and releases the lock after a failed setup", async () => {
  let rejectSetup!: (reason: Error) => void;
  const cli = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectSetup = reject; })).mockResolvedValue(setup);
  const handle = handler(cli);
  const first = request(handle, "/setup-demo", { name: "Demo", config: DEFAULT_DEMO_CONFIG });
  await vi.waitFor(() => expect(cli).toHaveBeenCalledTimes(1));
  expect((await request(handle, "/group/send", { botId: group.id, prompt: "Start" })).status).toBe(409);
  rejectSetup(new Error("Setup interrupted"));
  expect((await first).status).toBe(502);
  expect((await request(handle, "/setup-demo", { name: "Demo", config: DEFAULT_DEMO_CONFIG })).status).toBe(200);
});
it("does not send an empty message or claim an unaccepted send succeeded", async () => {
  const cli = vi.fn().mockResolvedValueOnce({ group, members }).mockResolvedValueOnce({ accepted: false });
  const handle = handler(cli);
  expect((await request(handle, "/group/send", { botId: group.id, prompt: " " })).status).toBe(400);
  expect(cli).not.toHaveBeenCalled();
  expect((await request(handle, "/group/send", { botId: group.id, prompt: "Start" })).status).toBe(502);
});

it("rejects native group responses with missing, duplicate or extra members", async () => {
  for (const invalidMembers of [members.slice(0, 3), [...members.slice(0, 3), members[0]], [...members, { id: "extra", name: "Extra bot" }]]) {
    const cli = vi.fn().mockResolvedValue({ group, members: invalidMembers });
    expect((await request(handler(cli), "/group/send", { botId: group.id, prompt: "Start" })).status).toBe(400);
    expect(cli).toHaveBeenCalledTimes(1);
  }
});

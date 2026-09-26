import { beforeEach, describe, expect, it, vi } from "vitest";
import { grokBotReady, grokBotTurn } from "./grok-bot";

const { execFile, existsSync } = vi.hoisted(() => ({ execFile: vi.fn(), existsSync: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile }));
vi.mock("node:fs", () => ({ existsSync }));

const bots = ["Nell", "Mara", "Len", "Ida"].map((name) => ({ id: `id-${name}`, name, isRunning: false }));
const input = { agentId: "denim" as const, floorPricePence: 2200, events: [] };
const bid = JSON.stringify({ say: "Good cloth. Thirty-four for the lot.", action: "bid", unitPrice: 34, quantity: 300 });
let responses: unknown[];

beforeEach(() => {
  vi.unstubAllEnvs();
  for (const name of Object.keys(process.env).filter((key) => key.startsWith("GROK_BOT_"))) vi.stubEnv(name, "");
  vi.clearAllMocks();
  existsSync.mockReturnValue(true);
  responses = [{ health: { ok: true } }, bots];
  execFile.mockImplementation((_python, _args, _options, callback) => callback(null, JSON.stringify(responses.shift()), ""));
});

describe("Grok Bot skill adapter", () => {
  it("checks status, lists bots, and chats by resolved ID without a shell", async () => {
    responses.push({ stillRunning: false, newEntries: [
      { author: "user", text: '{"say":"echoed prompt","action":"bid","unitPrice":1}' },
      { author: "id-Mara", text: bid },
      { author: "tool", text: '{"say":"tool output","action":"walk"}' },
    ] });
    expect(await grokBotTurn(input)).toMatchObject({ action: "bid", unitPricePence: 3400, quantity: 300 });
    expect(execFile.mock.calls.map((call) => call[1][1])).toEqual(["status", "list", "chat"]);
    expect(execFile.mock.calls[2][1]).toEqual([
      expect.stringContaining("skills/grok-bot/scripts/grokbot.py"), "chat", "--id", "id-Mara", "--prompt",
      expect.stringContaining("Speak now as Mara. JSON only."), "--timeout", "90",
    ]);
    expect(execFile.mock.calls[2][2]).not.toHaveProperty("shell");
  });

  it("supports one existing bot for all roles and role-specific overrides", async () => {
    vi.stubEnv("GROK_BOT_NAME", "Reed");
    vi.stubEnv("GROK_BOT_DENIM_ID", "id-Mara");
    responses[1] = [...bots, { id: "reed", name: "Reed" }];
    const selected = await grokBotReady();
    expect(selected.merchant.id).toBe("reed");
    expect(selected.denim.id).toBe("id-Mara");
    expect(selected.premium.id).toBe("reed");
  });

  it("reads current Grok Bot send-message replies with no author field", async () => {
    responses.push({ stillRunning: false, newEntries: [
      { kind: "message", author: "user", text: '{"say":"prompt","action":"walk"}' },
      { kind: "send-message", author: null, text: bid },
    ] });
    expect(await grokBotTurn(input)).toMatchObject({ action: "bid", unitPricePence: 3400 });
  });

  it("reads native replies from the selected bot's object author", async () => {
    responses.push({ stillRunning: false, newEntries: [
      { kind: "send-message", author: { id: "id-Mara", name: "Mara" }, text: bid },
      { kind: "send-message", author: { id: "other-bot", name: "Mara" }, text: '{"say":"wrong bot","action":"walk"}' },
      { kind: "tool-result", author: { id: "id-Mara", name: "Mara" }, text: '{"say":"tool output","action":"walk"}' },
    ] });
    expect(await grokBotTurn(input)).toMatchObject({ action: "bid", unitPricePence: 3400, quantity: 300 });
  });

  it("rejects other native authors and tool traces as completed replies", async () => {
    responses.push({ stillRunning: false, newEntries: [
      { kind: "send-message", author: { id: "other-bot", name: "Mara" }, text: bid },
      { kind: "tool-result", author: { id: "id-Mara", name: "Mara" }, text: bid },
    ] });
    await expect(grokBotTurn(input)).rejects.toThrow("no completed assistant reply");
  });

  it("lets a role name override a shared ID", async () => {
    vi.stubEnv("GROK_BOT_ID", "id-Nell");
    vi.stubEnv("GROK_BOT_DENIM_NAME", "Mara");
    expect((await grokBotReady()).denim.id).toBe("id-Mara");
  });

  it("refuses missing or ambiguous bots instead of creating teammates", async () => {
    responses[1] = bots.slice(1);
    await expect(grokBotReady()).rejects.toThrow("No bot is configured for Nell");
    responses = [{ health: { ok: true } }, [...bots, { id: "other", name: "Mara" }]];
    await expect(grokBotReady()).rejects.toThrow("GROK_BOT_DENIM_ID");
    expect(execFile.mock.calls.some((call) => call[1].includes("create"))).toBe(false);
  });

  it("does not chat when the computer or bot is busy", async () => {
    responses[0] = { health: { ok: false } };
    await expect(grokBotTurn(input)).rejects.toThrow("not ready");
    responses = [{ health: { ok: true } }, bots.map((bot) => ({ ...bot, isRunning: true }))];
    await expect(grokBotTurn(input)).rejects.toThrow("already working");
    expect(execFile.mock.calls.some((call) => call[1].includes("chat"))).toBe(false);
  });

  it("never uses a partial answer or an echoed user prompt as a bid", async () => {
    responses.push({ stillRunning: true, newEntries: [{ author: "assistant", text: bid }] });
    await expect(grokBotTurn(input)).rejects.toThrow("still working");
    responses = [{ health: { ok: true } }, bots, { stillRunning: false, newEntries: [{ author: "user", text: bid }] }];
    await expect(grokBotTurn(input)).rejects.toThrow("no completed assistant reply");
  });

  it("rejects malformed bot replies", async () => {
    responses.push({ stillRunning: false, newEntries: [{ author: "assistant", text: "I cannot answer" }] });
    await expect(grokBotTurn(input)).rejects.toThrow("valid negotiation turn");
  });

  it("reports sign-in failures without exposing CLI output", async () => {
    execFile.mockImplementation((_python, _args, _options, callback) =>
      callback(new Error("private command"), "private output", '{"error":"access token missing; private session"}'));
    const error = await grokBotReady().catch((failure: Error) => failure);
    expect(error).toMatchObject({ message: "Open Grok Bot and sign in with Cursor on this Mac, then check the connection again." });
    expect(String(error)).not.toContain("private");
  });

  it("reports a missing skill and Python executable", async () => {
    existsSync.mockReturnValue(false);
    await expect(grokBotReady()).rejects.toThrow("GROK_BOT_SCRIPT");
    existsSync.mockReturnValue(true);
    execFile.mockImplementation((_python, _args, _options, callback) => callback({ code: "ENOENT" }, "", ""));
    await expect(grokBotReady()).rejects.toThrow("GROK_BOT_PYTHON");
  });

  it("bounds CLI execution and explains uncertain completion", async () => {
    execFile.mockImplementation((_python, _args, _options, callback) => callback({ killed: true }, "", ""));
    await expect(grokBotTurn(input)).rejects.toThrow("may still be working");
    expect(execFile.mock.calls[0][2]).toMatchObject({ timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });
  });

  it("rejects simultaneous turns so transcripts do not get crossed", async () => {
    responses.push({ stillRunning: false, newEntries: [{ author: "assistant", text: bid }] });
    const first = grokBotTurn(input);
    await expect(grokBotTurn(input)).rejects.toThrow("already taking a turn");
    await expect(first).resolves.toMatchObject({ unitPricePence: 3400 });
  });
});

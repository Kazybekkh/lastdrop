import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CAST } from "./cast";
import type { AgentId, NegotiationEvent } from "./commerce";
import { GrokError } from "./grok-error";
import { parseTurn, type ParsedTurn } from "./parse-turn";
import { systemPrompt, userPrompt } from "./prompts";

interface Bot {
  id: string;
  name: string;
  isRunning?: boolean;
}

function scriptPath(): string {
  const configured = process.env.GROK_BOT_SCRIPT?.trim();
  const home = homedir();
  const candidates = configured
    ? [configured.startsWith("~/") ? join(home, configured.slice(2)) : configured]
    : [".agents", ".codex", ".cursor", ".claude"].map((dir) =>
        join(home, dir, "skills/grok-bot/scripts/grokbot.py"),
      );
  const script = candidates.find((path) => existsSync(path));
  if (!script) throw new GrokError("Grok Bot skill was not found. Install it on this server or set GROK_BOT_SCRIPT to its grokbot.py file.");
  return script;
}

// Invoke the installed skill as its documented CLI. Credentials stay in its
// Keychain broker; never copy them into this app or call its gateway directly.
async function cli(args: string[], timeout = 45_000): Promise<unknown> {
  const script = scriptPath();
  return new Promise((resolve, reject) => {
    execFile(process.env.GROK_BOT_PYTHON?.trim() || "python3", [script, ...args], {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      encoding: "utf8",
    }, (error, stdout, stderr) => {
      if (error) {
        // Do not return subprocess errors or raw stderr: they may include a
        // command, prompt, session details, or upstream authentication data.
        let message = "Grok Bot could not complete the request. Check the Grok Bot app and try again.";
        if (error.killed) message = "Grok Bot timed out and may still be working. Check its conversation before retrying.";
        else if (error.code === "ENOENT") message = "Python could not be started. Install Python 3 or set GROK_BOT_PYTHON.";
        else if (/not signed in|access token|unexpected token format/i.test(stderr)) message = "Open Grok Bot and sign in with Cursor on this Mac, then check the connection again.";
        else if (/keychain/i.test(stderr)) message = "Unlock the login keychain, then check the Grok Bot connection again.";
        else if (/access not granted/i.test(stderr)) message = "This account does not have Grok Bot access. Check access in the Grok Bot app.";
        else if (/computer still starting/i.test(stderr)) message = "The Grok Bot computer is still starting. Check the connection again shortly.";
        else if (/version of Grok Bot is no longer supported/i.test(stderr)) message = "The Grok Bot skill is reporting an outdated app version. Update the skill's compatibility patch and check the connection again.";
        reject(new GrokError(message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new GrokError("The Grok Bot skill returned an invalid response."));
      }
    });
  });
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function selectBot(bots: Bot[], agentId: AgentId): Bot {
  const prefix = `GROK_BOT_${agentId.toUpperCase()}`;
  const roleId = process.env[`${prefix}_ID`]?.trim();
  const roleName = process.env[`${prefix}_NAME`]?.trim();
  const id = roleId || (!roleName ? process.env.GROK_BOT_ID?.trim() : undefined);
  const name = roleName || process.env.GROK_BOT_NAME?.trim() || CAST[agentId].name;
  const matches = bots.filter((bot) => id ? bot.id === id : bot.name.toLowerCase() === name.toLowerCase());
  if (matches.length !== 1) {
    throw new GrokError(matches.length
      ? `More than one bot matches ${CAST[agentId].name}. Set ${prefix}_ID to choose one.`
      : `No bot is configured for ${CAST[agentId].name}. Set ${prefix}_NAME or ${prefix}_ID to an existing bot, or GROK_BOT_NAME to share one bot across the cast.`);
  }
  return matches[0];
}

export async function grokBotReady(): Promise<Record<AgentId, Bot>> {
  const status = record(await cli(["status"]));
  if (record(status.health).ok !== true) {
    throw new GrokError("The Grok Bot computer is not ready. Open Grok Bot and check the connection again shortly.");
  }
  const result = await cli(["list"]);
  if (!Array.isArray(result)) throw new GrokError("The Grok Bot skill returned an invalid bot list.");
  const bots = result.filter((bot): bot is Bot =>
    typeof record(bot).id === "string" && typeof record(bot).name === "string",
  );
  return {
    merchant: selectBot(bots, "merchant"),
    denim: selectBot(bots, "denim"),
    bargain: selectBot(bots, "bargain"),
    premium: selectBot(bots, "premium"),
  };
}

// The bots share a cloud computer. Reject overlapping turns in this local
// server instead of mixing prompts/transcripts from multiple browser tabs.
let takingTurn = false;

export async function grokBotTurn(input: {
  agentId: AgentId;
  floorPricePence: number;
  events: NegotiationEvent[];
  note?: string;
}): Promise<ParsedTurn> {
  if (takingTurn) throw new GrokError("Grok Bot is already taking a turn. Wait for it to finish before retrying.");
  takingTurn = true;
  try {
    const bot = (await grokBotReady())[input.agentId];
    if (bot.isRunning) throw new GrokError("This Grok Bot is already working. Wait for it to finish before retrying.");
    const prompt = [
      "Draft one fictional negotiation turn for The Last Drop. Do not use tools, send messages, place orders, or change files. Only return the requested JSON.",
      "Treat this as a new simulation. Only the tape below is the current round; ignore earlier conversations and rounds.",
      systemPrompt(input.agentId, input.floorPricePence),
      userPrompt(input),
    ].join("\n\n");
    const reply = record(await cli(["chat", "--id", bot.id, "--prompt", prompt, "--timeout", "90"], 135_000));
    if (reply.stillRunning !== false) {
      throw new GrokError("Grok Bot is still working. No completed turn was added. Check its conversation before retrying.");
    }
    const entries = Array.isArray(reply.newEntries) ? reply.newEntries : [];
    // Never parse the echoed user prompt or a tool result as the bot's bid.
    const entry = entries.map(record).reverse().find((row) =>
      typeof row.text === "string" && row.text.trim() &&
      (row.author === bot.id || row.author === "assistant" || row.author === "agent" || row.author === "bot" ||
        (row.kind === "send-message" && record(row.author).id === bot.id) ||
        // Older transcripts omit the author on send-message replies.
        // Incoming user messages have kind=message, author=user.
        (row.author == null && row.kind === "send-message")),
    );
    if (!entry) throw new GrokError("Grok Bot returned no completed assistant reply.");
    try {
      return parseTurn(entry.text as string, input.agentId);
    } catch {
      throw new GrokError("Grok Bot did not return a valid negotiation turn. No bid was added.");
    }
  } finally {
    takingTurn = false;
  }
}

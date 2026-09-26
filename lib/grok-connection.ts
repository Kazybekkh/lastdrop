import type { DemoConfig, DemoMember } from "./grok-demo";
import { parseDemoConfig } from "./grok-demo";
import { parseTurn } from "./parse-turn";
import { systemPrompt, userPrompt } from "./prompts";
import type { AgentId, NegotiationEvent } from "./commerce";

export interface GrokConnection { token: string; botId: string; botName: string; members?: DemoMember[]; brief?: string; config?: DemoConfig }
export function getConnection(): GrokConnection | null {
  return readSavedConnection("lastdrop-grok");
}
export function getGroupConnection(): GrokConnection | null {
  return readSavedConnection("lastdrop-grok-room");
}
function readSavedConnection(key: string): GrokConnection | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || typeof value.token !== "string" || typeof value.botId !== "string" || typeof value.botName !== "string") return null;
    return { token: value.token, botId: value.botId, botName: value.botName,
      ...(typeof value.brief === "string" ? { brief: value.brief } : {}),
      ...(value.config ? { config: parseDemoConfig(value.config) } : {}),
      ...(Array.isArray(value.members) ? { members: value.members.filter((member: DemoMember) => member && typeof member.id === "string" && typeof member.name === "string") } : {}),
    };
  } catch { return null; }
}
export async function bridgeRequest(path: string, token: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:4318${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(150_000),
  }).catch(() => { throw new Error("Start the Grok connector on this Mac and allow local network access in your browser."); });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Grok connector failed.");
  return data;
}
export async function connectedTurn(input: { agentId: AgentId; floorPricePence: number; events: NegotiationEvent[]; note?: string }) {
  const connection = getConnection();
  if (!connection) throw new Error("Connect your Grok Bot first.");
  const prompt = ["Draft one fictional negotiation turn. Do not use tools, send messages to others, place orders, or modify files. Ignore earlier rounds; only the tape below is current. Reply with JSON only.", systemPrompt(input.agentId, input.floorPricePence), userPrompt(input)].join("\n\n");
  const result = await bridgeRequest("/chat", connection.token, { botId: connection.botId, prompt });
  if (result.stillRunning !== false) throw new Error("Your bot is still working. Check Grok Bot before retrying.");
  const reply = [...(result.newEntries || [])].reverse().find((entry) => typeof entry.text === "string" && (
    entry.author === connection.botId || entry.author === "assistant" ||
    (entry.kind === "send-message" && entry.author && typeof entry.author === "object" && !Array.isArray(entry.author) && entry.author.id === connection.botId) ||
    (entry.author == null && entry.kind === "send-message")
  ));
  if (!reply) throw new Error("Your bot returned no completed reply.");
  return parseTurn(reply.text, input.agentId);
}

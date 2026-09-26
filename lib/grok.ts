import type { AgentId, NegotiationEvent } from "./commerce";
import { parseTurn, type ParsedTurn } from "./parse-turn";
import { systemPrompt, userPrompt } from "./prompts";

export class GrokError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrokError";
  }
}

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());
}

export async function grokTurn(input: {
  agentId: AgentId;
  floorPricePence: number;
  events: NegotiationEvent[];
  note?: string;
}): Promise<ParsedTurn> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) throw new GrokError("XAI_API_KEY is not set");

  const model = process.env.XAI_MODEL?.trim() || "grok-4.6";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt(input.agentId, input.floorPricePence) },
          {
            role: "user",
            content: userPrompt({
              agentId: input.agentId,
              floorPricePence: input.floorPricePence,
              events: input.events,
              note: input.note,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new GrokError(`Grok returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new GrokError("Grok returned an empty turn");
    return parseTurn(content, input.agentId);
  } catch (error) {
    if (error instanceof GrokError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GrokError("Grok took too long");
    }
    throw new GrokError("Grok could not complete this turn");
  } finally {
    clearTimeout(timer);
  }
}

import { parseIncomingEvent, type AgentId } from "@/lib/commerce";
import { GrokError, grokConfigured, grokTurn } from "@/lib/grok";

export const dynamic = "force-dynamic";

const AGENTS: AgentId[] = ["merchant", "denim", "bargain", "premium"];

export async function POST(request: Request) {
  if (!grokConfigured()) {
    return Response.json(
      {
        ok: false,
        reason: "replay_only",
        message: "No XAI_API_KEY. This room plays the recorded round.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    agentId?: unknown;
    floorPricePence?: unknown;
    events?: unknown;
    note?: unknown;
  } | null;

  if (!body || typeof body.agentId !== "string" || !AGENTS.includes(body.agentId as AgentId)) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (typeof body.floorPricePence !== "number" || !Number.isInteger(body.floorPricePence)) {
    return Response.json({ ok: false, reason: "bad_floor" }, { status: 400 });
  }
  if (!Array.isArray(body.events) || body.events.length > 40) {
    return Response.json({ ok: false, reason: "bad_events" }, { status: 400 });
  }

  const events = [];
  for (const row of body.events) {
    const parsed = parseIncomingEvent(row);
    if (!parsed) return Response.json({ ok: false, reason: "bad_events" }, { status: 400 });
    events.push(parsed);
  }

  try {
    const turn = await grokTurn({
      agentId: body.agentId as AgentId,
      floorPricePence: body.floorPricePence,
      events,
      note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
    });
    return Response.json({ ok: true, mode: "grok", agentId: body.agentId, ...turn });
  } catch (error) {
    const message = error instanceof GrokError ? error.message : "Grok could not complete this turn";
    return Response.json({ ok: false, reason: "grok_failed", message }, { status: 502 });
  }
}

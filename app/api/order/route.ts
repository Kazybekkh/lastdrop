import { LOT } from "@/lib/lot";
import { parseIncomingEvent, settle } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    floorPricePence?: unknown;
    events?: unknown;
  } | null;

  if (!body || typeof body.floorPricePence !== "number" || !Number.isInteger(body.floorPricePence)) {
    return Response.json({ ok: false, reason: "bad_floor" }, { status: 400 });
  }
  if (body.floorPricePence < 100 || body.floorPricePence > LOT.askingPricePence) {
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

  const result = settle({
    events,
    floorPricePence: body.floorPricePence,
    lot: LOT,
    now: new Date().toISOString(),
  });

  if (!result.ok) return Response.json(result, { status: 422 });
  return Response.json(result);
}

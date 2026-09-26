import { grokConfigured } from "@/lib/grok";

export const dynamic = "force-dynamic";

export function GET() {
  const live = grokConfigured();
  return Response.json({
    mode: live ? "grok" : "replay",
    model: live ? process.env.XAI_MODEL?.trim() || "grok-4.6" : null,
  });
}

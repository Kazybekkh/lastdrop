import { grokStatus } from "@/lib/grok";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await grokStatus(), { headers: { "Cache-Control": "no-store" } });
}

export interface GrokAuthor { id: string; name: string }
export interface GrokMessage {
  id: string;
  kind: "message" | "send-message";
  author: "user" | GrokAuthor | null;
  text: string;
}
export interface GrokTranscript {
  agent: { id: string; name: string; isRunning: boolean };
  entries: GrokMessage[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Only public chat messages belong in the room. Tool traces are never rendered.
export function parseGrokTranscript(value: unknown, selectedId: string): GrokTranscript {
  if (!record(value) || !record(value.agent) || value.agent.id !== selectedId || typeof value.agent.name !== "string" || !Array.isArray(value.entries)) {
    throw new Error("The connector returned a different or invalid conversation. Reconnect your shared room.");
  }
  const seen = new Set<string>();
  const entries: GrokMessage[] = [];
  for (const row of value.entries) {
    if (!record(row) || typeof row.id !== "string" || !row.id || seen.has(row.id) || typeof row.text !== "string" || !row.text.trim() || (row.kind !== "message" && row.kind !== "send-message")) continue;
    let author: GrokMessage["author"] = null;
    if (row.author === "user") author = "user";
    else if (record(row.author) && typeof row.author.id === "string" && typeof row.author.name === "string") {
      author = { id: row.author.id, name: row.author.name };
    }
    seen.add(row.id);
    entries.push({ id: row.id, kind: row.kind, author, text: row.text });
  }
  return { agent: { id: value.agent.id, name: value.agent.name, isRunning: value.agent.isRunning === true }, entries };
}

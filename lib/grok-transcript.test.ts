import { expect, it } from "vitest";
import { parseGrokTranscript } from "./grok-transcript";

const agent = { id: "room-1", name: "Negotiation", isRunning: true };
it("preserves distinct bot identities and original text from a native group", () => {
  const entries = [
    { id: "u1", kind: "message", author: "user", text: "Open bidding." },
    { id: "b1", kind: "send-message", author: { id: "bot-1", name: "Merchant" }, text: "£38 for 300." },
    { id: "b2", kind: "send-message", author: { id: "bot-2", name: "Denim Dan" }, text: "£34 for all 300." },
  ];
  expect(parseGrokTranscript({ agent, entries }, "room-1")).toEqual({ agent, entries });
});
it("drops tool activity, empty entries and duplicate IDs without attributing unknown authors", () => {
  const result = parseGrokTranscript({ agent, entries: [
    { id: "tool", kind: "tool-call", text: "Private tool activity" },
    { id: "empty", kind: "message", text: " " },
    { id: "reply", kind: "send-message", author: "unknown-id", text: "An unattributed reply" },
    { id: "reply", kind: "send-message", author: { id: "other", name: "Other" }, text: "Duplicate" },
  ] }, "room-1");
  expect(result.entries).toEqual([{ id: "reply", kind: "send-message", author: null, text: "An unattributed reply" }]);
});
it("rejects a transcript from a different selected conversation", () => {
  expect(() => parseGrokTranscript({ agent, entries: [] }, "other-room")).toThrow("different or invalid conversation");
  expect(() => parseGrokTranscript({ entries: [] }, "room-1")).toThrow("different or invalid conversation");
});

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CAST } from "@/lib/cast";
import { buildBook, type AgentId, type NegotiationEvent, type Receipt } from "@/lib/commerce";
import { formatGbpExact, formatGbpSpeech } from "@/lib/format";
import { LOT } from "@/lib/lot";
import { replayOpening, replayResponses } from "@/lib/replay";
import { wholesaleFromReceipt } from "@/lib/shop";
import { savePostedOrder } from "@/lib/shop-session";
import { AppNav } from "./app-nav";
import { HangTag } from "./hang-tag";
import { RailBook } from "./rail-book";
import { ReceiptCard } from "./receipt-card";
import { Tape } from "./tape";
import Link from "next/link";
import { getConnection, bridgeRequest, connectedTurn } from "@/lib/grok-connection";

type Mode = "replay" | "grok" | "loading" | "unavailable";
type Phase = "briefing" | "opening" | "counter" | "responses" | "decision" | "error" | "receipt";
type Beat = "idle" | "think" | "read";

interface Step {
  agentId: AgentId;
  preset?: Omit<NegotiationEvent, "at">;
  note?: string;
}

const LIVE_OPENING: AgentId[] = ["merchant", "denim", "bargain", "premium"];

export function DropFloor() {
  const [mode, setMode] = useState<Mode>("loading");
  const [model, setModel] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [floorPence, setFloorPence] = useState(LOT.defaultFloorPence);
  const [events, setEvents] = useState<NegotiationEvent[]>([]);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [beat, setBeat] = useState<Beat>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [cursor, setCursor] = useState(0);
  const [thinking, setThinking] = useState<AgentId | null>(null);
  const [nudged, setNudged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counterPounds, setCounterPounds] = useState("36");
  const [counterLine, setCounterLine] = useState("£36 on all 300. You are buying the cloth, not a leftover.");
  const [counterNote, setCounterNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shopOrderName, setShopOrderName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const eventsRef = useRef(events);
  eventsRef.current = events;
  const floorRef = useRef(floorPence);
  floorRef.current = floorPence;
  const seq = useRef(0);

  useEffect(() => {
    let cancel = false;
    readConnection()
      .then((data) => {
        if (cancel) return;
        setMode(data.mode);
        setModel(data.model);
        setConnectionMessage(data.message);
      })
      .catch(() => {
        if (!cancel) {
          setMode("unavailable");
          setConnectionMessage("Could not check the Grok connection. Try again.");
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  const book = useMemo(() => buildBook(events, floorPence, LOT.quantity), [events, floorPence]);
  const locked = phase !== "briefing";
  const showCounter = phase === "counter" || phase === "decision";
  const canApprove = showCounter && book.winner != null && !saving;

  function stamp(): string {
    seq.current += 1;
    return new Date(Date.now() + seq.current).toISOString();
  }

  function reset() {
    setEvents([]);
    setPhase("briefing");
    setBeat("idle");
    setSteps([]);
    setCursor(0);
    setThinking(null);
    setNudged(false);
    setError(null);
    setCounterNote(null);
    setReceipt(null);
    setSaving(false);
  }

  function start(nextMode: "replay" | "grok") {
    const opening =
      nextMode === "replay"
        ? replayOpening(floorPence).map((preset) => ({ agentId: preset.agentId, preset }))
        : LIVE_OPENING.map((agentId) => ({ agentId }));
    setMode(nextMode);
    setEvents([]);
    setSteps(opening);
    setCursor(0);
    setBeat("think");
    setPhase("opening");
    setThinking(null);
    setNudged(false);
    setError(null);
    setCounterNote(null);
    setReceipt(null);
    if (Math.round(Number(counterPounds) * 100) < floorPence) {
      setCounterPounds(String(Math.ceil(floorPence / 100)));
    }
  }

  async function checkConnection(): Promise<Exclude<Mode, "loading">> {
    setMode("loading");
    try {
      const data = await readConnection();
      setMode(data.mode);
      setModel(data.model);
      setConnectionMessage(data.message);
      return data.mode;
    } catch {
      setMode("unavailable");
      setConnectionMessage("Could not check the Grok connection. Try again.");
      return "unavailable";
    }
  }

  async function onPitch() {
    const next = await checkConnection();
    if (next !== "unavailable") start(next);
  }

  useEffect(() => {
    if (beat !== "think") return;
    if (phase !== "opening" && phase !== "responses") return;
    const step = steps[cursor];
    if (!step) return;
    let cancel = false;
    setThinking(step.agentId);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const raw = step.preset ?? (await requestLiveTurn(step, eventsRef.current, floorRef.current));
          if (cancel) return;
          setEvents((prev) => [
            ...prev,
            {
              agentId: step.agentId,
              action: raw.action,
              say: raw.say,
              unitPricePence: raw.unitPricePence ?? null,
              quantity: raw.quantity ?? null,
              at: new Date(Date.now() + seq.current + prev.length + 1).toISOString(),
            },
          ]);
          seq.current += 1;
          setThinking(null);
          setBeat("read");
        } catch (err) {
          if (cancel) return;
          setThinking(null);
          setBeat("idle");
          setError(err instanceof Error ? err.message : "The wire to Grok failed.");
          setPhase("error");
        }
      })();
    }, step.preset ? 700 : 30);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [beat, phase, cursor, steps]);

  useEffect(() => {
    if (beat !== "read") return;
    if (phase !== "opening" && phase !== "responses") return;
    const last = events[events.length - 1];
    const wait = Math.min(2600, 880 + (last?.say.length ?? 40) * 14);
    const timer = setTimeout(() => {
      const next = cursor + 1;
      if (next < steps.length) {
        setCursor(next);
        setBeat("think");
        return;
      }
      if (phase === "opening" && mode === "grok" && !nudged && bargainShouldReturn(events, floorPence)) {
        setNudged(true);
        setSteps((current) => [
          ...current,
          {
            agentId: "bargain",
            note: "Your bid was refused because it is under the merchant floor. Walk unless a real discount has been offered. It has not.",
          },
        ]);
        setCursor(next);
        setBeat("think");
        return;
      }
      setBeat("idle");
      setThinking(null);
      setPhase(phase === "opening" ? "counter" : "decision");
    }, wait);
    return () => clearTimeout(timer);
  }, [beat, phase, cursor, steps.length, events, mode, nudged, floorPence]);

  function sendCounter() {
    const pounds = Number(counterPounds);
    if (!Number.isFinite(pounds)) {
      setCounterNote("Name a price in pounds.");
      return;
    }
    const whole = Math.round(pounds);
    const pence = whole * 100;
    const say = counterLine.trim() || `Counter at ${formatGbpSpeech(pence)}.`;
    const event: NegotiationEvent = {
      agentId: "merchant",
      action: "counter",
      say,
      unitPricePence: pence,
      at: stamp(),
    };
    if (pence < floorPence) {
      setEvents((prev) => [...prev, event]);
      setCounterNote("Below the floor. The rail held. That counter cannot clear.");
      return;
    }
    const nextEvents = [...events, event];
    setEvents(nextEvents);
    setCounterNote(null);
    const walked = new Set(buildBook(nextEvents, floorPence, LOT.quantity).walked);
    const follow: Step[] =
      mode === "replay"
        ? replayResponses(pence, floorPence).map((preset) => ({ agentId: preset.agentId, preset }))
        : (["denim", "bargain", "premium"] as const)
            .filter((id) => !walked.has(id))
            .map((agentId) => ({
              agentId,
              note: `The merchant countered at ${formatGbpSpeech(pence)}: "${say}". Respond in character. Bid, hold, or walk.`,
            }));
    if (follow.length === 0) {
      setPhase("decision");
      setBeat("idle");
      return;
    }
    setSteps(follow);
    setCursor(0);
    setBeat("think");
    setPhase("responses");
  }

  async function approve() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, floorPricePence: floorPence }),
      });
      const data = (await res.json()) as { ok?: boolean; receipt?: Receipt };
      if (!res.ok || !data.ok || !data.receipt) {
        setError("No legal offer cleared the rail.");
        setSaving(false);
        return;
      }
      const posted = wholesaleFromReceipt(data.receipt);
      savePostedOrder(posted);
      setShopOrderName(posted.name);
      setReceipt(data.receipt);
      setPhase("receipt");
      setSaving(false);
    } catch {
      setError("Could not cut the docket.");
      setSaving(false);
    }
  }

  const wire = wireCopy(mode, model, connectionMessage);
  const winner = book.winner;

  return (
    <div className="stage">
      <AppNav current="match" />
      <header className="top">
        <div>
          <p className="eyebrow">Three buyers. One lot. A floor they cannot cross.</p>
          <h1>Find a buyer for what isn&apos;t selling.</h1>
          <p className="pitch">Shops don&apos;t have a stock problem. They have a matchmaking problem.</p>
        </div>
        <p className={mode === "grok" ? "badge live" : "badge"}>{wire.title}</p>
      </header>
      <p className={mode === "replay" ? "wire recorded" : "wire"}>{wire.detail}</p>
      <div className="desks">
        {(["merchant", "denim", "bargain", "premium"] as const).map((id) => {
          const walked = id !== "merchant" && book.walked.includes(id);
          const leading = winner?.agentId === id;
          return (
            <article key={id} className={`desk ${walked ? "is-walked" : ""} ${leading ? "is-leading" : ""} ${thinking === id ? "is-talking" : ""}`}>
              <span className={`avatar avatar-${id}`} aria-hidden="true">
                {CAST[id].name.slice(0, 1)}
              </span>
              <p>
                <strong>{CAST[id].name}</strong>
                <span>{CAST[id].role}</span>
              </p>
              <em>{walked ? "Walked" : leading ? "Leading" : CAST[id].trait}</em>
            </article>
          );
        })}
      </div>
      <main className="layout">
        <HangTag floorPence={floorPence} locked={locked} onFloor={setFloorPence} />
        <Tape events={book.events} thinking={thinking} />
        <RailBook book={book} floorPence={floorPence} />
      </main>
      <footer className="dock">
        {phase === "briefing" && mode !== "unavailable" && (
          <button type="button" className="primary" onClick={() => void onPitch()} disabled={mode === "loading"}>
            {mode === "loading" ? "Checking the wire…" : "Pitch this lot"}
          </button>
        )}
        {phase === "briefing" && mode === "unavailable" && (
          <div className="dock-error">
            <Link href="/connect" className="primary">Connect your Grok Bot</Link>
            <button type="button" className="primary" onClick={() => void checkConnection()}>
              Check connection again
            </button>
            <button type="button" className="ghost" onClick={() => start("replay")}>
              Play the recorded round
            </button>
          </div>
        )}
        {(phase === "opening" || phase === "responses") && (
          <p className="dock-status">Matching. Buyers are taking turns.</p>
        )}
        {phase === "error" && (
          <div className="dock-error">
            <p>{error ?? "The wire to Grok failed."}</p>
            <button type="button" className="ghost" onClick={() => { reset(); void checkConnection(); }}>
              Check connection again
            </button>
            <button type="button" className="primary" onClick={() => start("replay")}>
              Play the recorded round
            </button>
          </div>
        )}
        {showCounter && (
          <form
            className="counter"
            onSubmit={(event) => {
              event.preventDefault();
              if (beat === "idle") sendCounter();
            }}
          >
            <label>
              <span>Counter</span>
              <input
                type="number"
                min={1}
                max={80}
                step={1}
                value={counterPounds}
                aria-label="Counter price in pounds"
                onChange={(event) => setCounterPounds(event.target.value)}
              />
            </label>
            <label className="line-field">
              <span>Line</span>
              <input
                type="text"
                maxLength={160}
                value={counterLine}
                aria-label="Counter line"
                onChange={(event) => setCounterLine(event.target.value)}
              />
            </label>
            <button type="submit" className={phase === "counter" ? "primary" : "ghost"} disabled={beat !== "idle"}>
              Send counter
            </button>
            <button type="button" className={phase === "decision" ? "primary" : "ghost"} disabled={!canApprove} onClick={() => void approve()}>
              {saving
                ? "Cutting the docket…"
                : winner
                  ? `Approve ${CAST[winner.agentId].name} · ${formatGbpExact(winner.unitPricePence)} × ${winner.quantity}`
                  : "No legal offer"}
            </button>
          </form>
        )}
        {counterNote && <p className="counter-note">{counterNote}</p>}
        {error && phase !== "error" && <p className="counter-note">{error}</p>}
      </footer>
      {phase === "receipt" && receipt && (
        <ReceiptCard receipt={receipt} recorded={mode !== "grok"} shopOrderName={shopOrderName} onClose={reset} />
      )}
    </div>
  );
}

function bargainShouldReturn(events: NegotiationEvent[], floor: number): boolean {
  const book = buildBook(events, floor, LOT.quantity);
  const blocked = book.blocked.some((row) => row.agentId === "bargain");
  return blocked && !book.walked.includes("bargain");
}

async function requestLiveTurn(step: Step, events: NegotiationEvent[], floor: number): Promise<Omit<NegotiationEvent, "at" | "agentId">> {
  if (getConnection()) return connectedTurn({ agentId: step.agentId, events, floorPricePence: floor, note: step.note });
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: step.agentId,
      floorPricePence: floor,
      events,
      note: step.note,
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    message?: string;
    action?: NegotiationEvent["action"];
    say?: string;
    unitPricePence?: number | null;
    quantity?: number | null;
  };
  if (!res.ok || !data.ok || !data.action || !data.say) {
    throw new Error(data.message || "Grok could not take this turn.");
  }
  return {
    action: data.action,
    say: data.say,
    unitPricePence: data.unitPricePence ?? null,
    quantity: data.quantity ?? null,
  };
}

async function readConnection(): Promise<{ mode: Exclude<Mode, "loading">; model: string | null; message: string | null }> {
  const connection = getConnection();
  if (connection) {
    try {
      const data = await bridgeRequest("/bots", connection.token);
      if (!data.bots.some((bot: { id: string }) => bot.id === connection.botId)) throw new Error("Choose an existing bot on the Connect Grok page.");
      return { mode: "grok", model: `Grok Bot · ${connection.botName}`, message: null };
    } catch (error) { return { mode: "unavailable", model: null, message: error instanceof Error ? error.message : "Reconnect your Grok Bot." }; }
  }
  const res = await fetch("/api/mode", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not check the Grok connection.");
  const data = await res.json();
  return {
    mode: data.mode === "grok" || data.mode === "replay" ? data.mode : "unavailable",
    model: typeof data.model === "string" ? data.model : null,
    message: typeof data.message === "string" ? data.message : null,
  };
}

function wireCopy(mode: Mode, model: string | null, message: string | null): { title: string; detail: string } {
  if (mode === "loading") {
    return {
      title: "Checking the wire",
      detail: "Checking the Grok connection. The floor rules are already in the room.",
    };
  }
  if (mode === "unavailable") {
    return {
      title: "Grok needs attention",
      detail: message ?? "Grok is not connected. Check the connection or choose the recorded round.",
    };
  }
  if (mode === "grok") {
    return {
      title: `Live · ${model ?? "Grok"}`,
      detail: "Four agents are speaking through Grok. The floor, the winner, and the docket are ordinary code. A bid under the floor cannot win.",
    };
  }
  return {
    title: "Recorded round",
    detail: "These four voices are scripted. This is not live Grok. The floor, the winner, and the docket are ordinary code — Len's cheap bid still cannot clear.",
  };
}

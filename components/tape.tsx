import { useEffect, useRef } from "react";
import { CAST } from "@/lib/cast";
import type { AgentId, AnnotatedEvent } from "@/lib/commerce";
import { formatGbpExact } from "@/lib/format";

export function Tape({
  events,
  thinking,
}: {
  events: AnnotatedEvent[];
  thinking: AgentId | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, thinking]);

  return (
    <section className="tape" aria-live="polite" ref={scroller}>
      <header className="tape-head">
        <h2>Negotiation</h2>
        <p>They can say any price. Only a bid at or above the floor can win.</p>
      </header>
      {events.length === 0 && !thinking && (
        <p className="quiet">No one is talking yet. Start the match and the buyers answer one at a time.</p>
      )}
      <ol>
        {events.map((event, index) => {
          const person = CAST[event.agentId];
          return (
            <li key={`${event.at}-${index}`} className={`line stamp-${event.stamp}`}>
              <span className={`avatar avatar-${event.agentId}`} aria-hidden="true">
                {person.name.slice(0, 1)}
              </span>
              <div>
                <p className="who">
                  <strong>{person.name}</strong>
                  <span>{person.role}</span>
                </p>
                <p className="say">{event.say}</p>
                <p className="marks">
                  {event.stamp === "accepted" && event.unitPricePence != null && event.quantity != null && (
                    <em className="chip">{formatGbpExact(event.unitPricePence)} × {event.quantity}</em>
                  )}
                  {event.stamp === "blocked" && <em className="rubber">Below floor</em>}
                  {event.stamp === "walked" && <em className="rubber walk">Walked</em>}
                  {event.stamp === "invalid" && <em className="rubber">Not a bid</em>}
                  {event.action === "counter" && event.stamp === "none" && event.unitPricePence != null && (
                    <em className="chip counter">Counter {formatGbpExact(event.unitPricePence)}</em>
                  )}
                </p>
              </div>
            </li>
          );
        })}
        {thinking && (
          <li className="line thinking">
            <span className={`avatar avatar-${thinking}`} aria-hidden="true">
              {CAST[thinking].name.slice(0, 1)}
            </span>
            <p className="say">{CAST[thinking].thinking}…</p>
          </li>
        )}
      </ol>
    </section>
  );
}

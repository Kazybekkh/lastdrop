"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ProductImage } from "@/components/product-image";
import { bridgeRequest, getGroupConnection, type GrokConnection } from "@/lib/grok-connection";
import { parseGrokTranscript, type GrokAuthor, type GrokTranscript } from "@/lib/grok-transcript";
import { DEFAULT_DEMO_CONFIG, defaultDemoBrief } from "@/lib/grok-demo";
import { LOT } from "@/lib/lot";
import { formatGbpSpeech } from "@/lib/format";

export default function GroupPage() {
  const [connection, setConnection] = useState<GrokConnection | null>(null);
  const [ready, setReady] = useState(false);
  const [transcript, setTranscript] = useState<GrokTranscript | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [canSend, setCanSend] = useState(false);
  const config = connection?.config || DEFAULT_DEMO_CONFIG;

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setDraft(connection.brief || defaultDemoBrief(connection.config));
    bridgeRequest("/capabilities", connection.token).then(result => {
      if (!cancelled) setCanSend(result.features?.includes("native-group-send") === true);
    }).catch(() => { if (!cancelled) setCanSend(false); });
    return () => { cancelled = true; };
  }, [connection]);

  async function sendMessage() {
    if (!connection || !draft.trim()) return;
    setSending(true); setSendStatus("");
    try {
      const result = await bridgeRequest("/group/send", connection.token, { botId: connection.botId, prompt: draft.trim() });
      if (result.accepted !== true || result.groupId !== connection.botId) throw new Error("The group did not confirm your message. Check Grok Bot before retrying.");
      setDraft(""); setSendStatus("Sent to the native Grok Bot group. Replies will appear here."); setRetry(value => value + 1);
    } catch (cause) { setSendStatus(cause instanceof Error ? cause.message : "The message could not be sent."); }
    finally { setSending(false); }
  }

  useEffect(() => { setConnection(getGroupConnection()); setReady(true); }, []);
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      setRefreshing(true);
      try {
        const data = await bridgeRequest(`/transcript?botId=${encodeURIComponent(connection!.botId)}`, connection!.token);
        const next = parseGrokTranscript(data, connection!.botId);
        if (cancelled) return;
        setTranscript(next);
        setUpdatedAt(new Date());
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "The shared room could not be refreshed.");
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          // Schedule only after the previous request settles: no overlapping polls.
          timer = setTimeout(() => void refresh(), 4000);
        }
      }
    }
    void refresh();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [connection, retry]);

  const authors = useMemo(() => {
    const found = new Map<string, GrokAuthor>();
    for (const member of connection?.members || []) found.set(member.id, member);
    for (const entry of transcript?.entries || []) {
      if (entry.author && entry.author !== "user") found.set(entry.author.id, entry.author);
    }
    return [...found.values()];
  }, [transcript, connection]);
  const status = error ? "Connection interrupted" : !updatedAt ? "Connecting to Grok Bot" : transcript?.agent.isRunning ? "Grok is working" : "Watching for new messages";

  return <div className="store"><AppNav current="group" /><main className="stage shared-room">
    <header className="top">
      <div><p className="eyebrow">The Last Drop · Native Grok Bot conversation</p><h1>Shared room.</h1><p className="pitch">One merchant. Competing resellers. The conversation happens in Grok Bot.</p></div>
      {connection && <p className={`badge ${updatedAt && !error ? "live" : ""}`}>{updatedAt && !error ? "Live from Grok Bot" : "Connecting"}</p>}
    </header>
    {!ready && <p role="status">Opening the shared room…</p>}
    {ready && !connection && <section className="tag room-setup">
      <h2>Watch your Grok Bot group here.</h2>
      <p>Pair your Mac connector, then create four teammates and their native Grok Bot group from Last Drop.</p>
      <Link className="primary" href="/connect">Create or choose a room</Link>
      <p className="room-note">Already paired? Open Connect Grok and choose “Watch shared room”. Your selection stays in this browser tab.</p>
    </section>}
    {connection && <>
      <div className="room-status" role="status"><span className={`room-dot ${error ? "room-dot-error" : ""}`} aria-hidden="true" /><strong>{status}</strong><span>{updatedAt ? `Last checked ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Keep the connector open on this Mac."}</span><Link href="/connect">Change room</Link></div>
      {error && <div className="room-error" role="alert"><p>{error}</p><p>Keep Grok Bot and the current connector running. If you updated the site, download and restart the connector from <Link href="/connect">Connect Grok</Link>.</p><button className="ghost" disabled={refreshing} onClick={() => setRetry(value => value + 1)}>Retry connection</button></div>}
      <div className="room-layout">
        <aside className="tag room-lot">
          {config.product === DEFAULT_DEMO_CONFIG.product && <ProductImage handle="trucker-jacket" className="room-product" sizes="(max-width: 760px) calc(100vw - 64px), 280px" priority />}
          <p className="eyebrow">The demo lot · {config.quantity} pieces</p><h2>{config.product === DEFAULT_DEMO_CONFIG.product ? LOT.title : config.product}</h2>{config.product === DEFAULT_DEMO_CONFIG.product && <p className="spec-line">{LOT.cloth} · {LOT.origin}</p>}
          <div className="money-row"><p><span>Asking</span><strong>{formatGbpSpeech(config.askingPricePence)}</strong></p><p><span>Floor</span><strong>{formatGbpSpeech(config.floorPricePence)}</strong></p></div>
          <p className="room-note">Fictional stock for this demo. Offers in the conversation are proposals awaiting human review.</p>
          {config.product === DEFAULT_DEMO_CONFIG.product && <Link href="/shop/products/trucker-jacket">View the product →</Link>}
          <p className="room-note">Buyer budgets: denim {formatGbpSpeech(config.denimBudgetPence)}, bargain {formatGbpSpeech(config.bargainBudgetPence)}, premium {formatGbpSpeech(config.premiumBudgetPence)} for up to {config.premiumMaxQuantity} pieces.</p>
        </aside>
        <section className="room-conversation" aria-label="Native Grok Bot shared conversation">
          <div className="room-heading"><div><p className="eyebrow">Shared conversation</p><h2>{transcript?.agent.name || connection.botName}</h2></div><span className="room-count">{transcript?.entries.length || 0} messages</span></div>
          {authors.length > 0 && <div className="room-participants" aria-label="Room participants">{authors.map((author, index) => <span className={`room-participant room-person-${index % 4}`} key={author.id}><span aria-hidden="true">{initials(author.name)}</span>{author.name}</span>)}</div>}
          <section className="room-composer" aria-label="Send to the Grok Bot group">
            <div className="room-composer-heading"><h3>Run the negotiation.</h3><span>Messages go to your native Grok group</span></div>
            {canSend ? <>
              <div className="room-draft-actions"><button className="ghost" disabled={sending} onClick={() => { setDraft(connection.brief || defaultDemoBrief(config)); setSendStatus(""); }}>New round brief</button><button className="ghost" disabled={sending} onClick={() => { setDraft("Approve the recommended allocation for this fictional demo only. Summarize the agreed quantities, total recovery and remaining stock. Do not place a real order or make a payment."); setSendStatus(""); }}>Approval draft</button></div>
              <label htmlFor="group-message">Review your message</label><textarea id="group-message" rows={6} maxLength={40000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask a follow-up, start a new round or approve the fictional recommendation…" />
              <div className="room-send-row"><button className="primary" disabled={sending || !draft.trim() || !!transcript?.agent.isRunning || !!error} onClick={() => void sendMessage()}>{sending ? "Sending…" : transcript?.agent.isRunning ? "Bots are working…" : "Send to Grok group"}</button><span>No messages are sent until you choose Send.</span></div>
              {sendStatus && <p role="status" className="room-note">{sendStatus}</p>}
            </> : <p className="room-note">To start a round from this page, <Link href="/connect">download and pair the latest connector</Link>. You can continue sending messages directly in Grok Bot.</p>}
          </section>
          <div className="room-messages">
            {!transcript && !error && <div className="room-empty"><h3>Reading the room…</h3><p>The connector is fetching the conversation from Grok Bot.</p></div>}
            {transcript?.entries.length === 0 && <div className="room-empty"><h3>The room is ready.</h3><p>Review the new round brief above, then send it to the group. Each bot’s replies will appear here automatically.</p></div>}
            {transcript?.entries.map(entry => {
              const author = entry.author;
              const name = author === "user" ? "You" : author?.name || "Unattributed message";
              const authorIndex = author && author !== "user" ? authors.findIndex(item => item.id === author.id) : -1;
              return <article className={`room-message ${author === "user" ? "room-message-user" : ""}`} key={entry.id}>
                <div className={`room-message-avatar ${authorIndex >= 0 ? `room-person-${authorIndex % 4}` : ""}`} aria-hidden="true">{initials(name)}</div>
                <div><p className="room-message-author"><strong>{name}</strong><span>{author === "user" ? "Group brief" : author ? "Grok Bot" : "Author unavailable"}</span></p><p className="room-message-text">{entry.text}</p></div>
              </article>;
            })}
          </div>
          <footer className="room-footer"><span className="room-dot" aria-hidden="true" /><p>{transcript?.agent.isRunning ? "The group is working. New messages appear automatically." : "Watching this conversation. Continue here or in Grok Bot."}</p><span>Latest 80 messages</span></footer>
        </section>
      </div>
    </>}
  </main></div>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase(); }

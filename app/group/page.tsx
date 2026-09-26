"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { ProductImage } from "@/components/product-image";
import { bridgeRequest, getGroupConnection, type GrokConnection } from "@/lib/grok-connection";
import { parseGrokTranscript, type GrokAuthor, type GrokTranscript } from "@/lib/grok-transcript";
import { DEFAULT_DEMO_CONFIG, defaultDemoBrief } from "@/lib/grok-demo";
import { LOT } from "@/lib/lot";
import { formatGbpSpeech } from "@/lib/format";
import { memberStatus, parseRoundState, visibleGroupMessage, type RoundState } from "@/lib/grok-round-state";

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
  const [canManageRound, setCanManageRound] = useState<boolean | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [roundLoaded, setRoundLoaded] = useState(false);
  const [roundError, setRoundError] = useState("");
  const [actionError, setActionError] = useState("");
  const [roundBusy, setRoundBusy] = useState(false);
  const [selection, setSelection] = useState<{ roundId: string; ids: string[] } | null>(null);
  const mutationVersion = useRef(0);
  const mutationPending = useRef(false);
  const config = round?.config || connection?.config || DEFAULT_DEMO_CONFIG;

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    setDraft("");
    bridgeRequest("/capabilities", connection.token).then(result => {
      if (cancelled) return;
      setCanSend(result.features?.includes("native-group-send") === true);
      const lifecycle = result.features?.includes("native-group-lifecycle") === true;
      setCanManageRound(lifecycle);
      if (!lifecycle) setDraft(connection.brief || defaultDemoBrief(connection.config));
    }).catch(() => { if (!cancelled) { setCanSend(false); setCanManageRound(false); } });
    return () => { cancelled = true; };
  }, [connection]);

  async function sendMessage() {
    if (!connection || !draft.trim() || sending || roundBusy) return;
    setSending(true); setSendStatus("");
    try {
      const result = await bridgeRequest("/group/send", connection.token, { botId: connection.botId, prompt: draft.trim() });
      if (result.accepted !== true || result.groupId !== connection.botId) throw new Error("The group did not confirm your message. Check Grok Bot before retrying.");
      setDraft(""); setSendStatus("Sent to the native Grok Bot group. Replies will appear here."); setRetry(value => value + 1);
    } catch (cause) { setSendStatus(cause instanceof Error ? cause.message : "The message could not be sent."); }
    finally { setSending(false); }
  }

  async function startRound() {
    if (!connection || mutationPending.current || round) return;
    mutationPending.current = true; mutationVersion.current += 1;
    setRoundBusy(true); setActionError("");
    try {
      const result = await bridgeRequest("/group/round", connection.token, { botId: connection.botId, config: connection.config || DEFAULT_DEMO_CONFIG, members: connection.members });
      const next = parseRoundState(result.round, connection.botId);
      if (!next) throw new Error("The connector did not confirm a new round. Check Grok Bot before retrying.");
      setRound(next); setRoundLoaded(true); setSelection(null); setDraft("");
      setSendStatus("Round started. The bots choose their offers and can withdraw on their own.");
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The round could not be started."); }
    finally { mutationVersion.current += 1; mutationPending.current = false; setRoundBusy(false); setRetry(value => value + 1); }
  }

  async function approveSelected() {
    if (!connection || !round || mutationPending.current || !canApprove) return;
    mutationPending.current = true; mutationVersion.current += 1;
    setRoundBusy(true); setActionError("");
    try {
      const result = await bridgeRequest("/group/approve", connection.token, { botId: connection.botId, roundId: round.roundId, offerIds: selectedOffers.map(offer => offer.id) });
      const next = parseRoundState(result.round, connection.botId);
      if (!next) throw new Error("The connector did not confirm approval. Check Grok Bot before retrying.");
      setRound(next);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "The deal could not be approved."); }
    finally { mutationVersion.current += 1; mutationPending.current = false; setRoundBusy(false); setRetry(value => value + 1); }
  }

  useEffect(() => { setConnection(getGroupConnection()); setReady(true); }, []);
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      setRefreshing(true);
      try {
        const version = mutationVersion.current;
        const results = await Promise.allSettled([
          bridgeRequest(`/transcript?botId=${encodeURIComponent(connection!.botId)}`, connection!.token),
          ...(canManageRound ? [bridgeRequest(`/group/state?botId=${encodeURIComponent(connection!.botId)}`, connection!.token)] : []),
        ]);
        if (cancelled) return;
        const conversation = results[0];
        if (conversation.status === "fulfilled") {
          setTranscript(parseGrokTranscript(conversation.value, connection!.botId));
          setUpdatedAt(new Date()); setError("");
        } else setError(conversation.reason instanceof Error ? conversation.reason.message : "The shared room could not be refreshed.");
        const lifecycle = results[1];
        if (lifecycle && version === mutationVersion.current && !mutationPending.current) {
          if (lifecycle.status === "fulfilled") {
            try { setRound(parseRoundState(lifecycle.value.round, connection!.botId)); setRoundLoaded(true); setRoundError(""); }
            catch (cause) { setRoundError(cause instanceof Error ? cause.message : "The negotiation state could not be read."); }
          } else setRoundError(lifecycle.reason instanceof Error ? lifecycle.reason.message : "The negotiation state could not be refreshed.");
        }
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
  }, [connection, retry, canManageRound]);

  const authors = useMemo(() => {
    const found = new Map<string, GrokAuthor>();
    for (const member of connection?.members || []) found.set(member.id, member);
    for (const member of round?.members || []) found.set(member.id, member);
    for (const entry of transcript?.entries || []) {
      if (entry.author && entry.author !== "user") found.set(entry.author.id, entry.author);
    }
    return [...found.values()];
  }, [transcript, connection, round]);
  const selectedIds = selection?.roundId === round?.roundId ? selection?.ids || [] : round?.bestOfferIds || [];
  const selectedOffers = round?.offers.filter(offer => selectedIds.includes(offer.id)) || [];
  const selectedQuantity = selectedOffers.reduce((sum, offer) => sum + offer.quantity, 0);
  const selectedTotal = selectedOffers.reduce((sum, offer) => sum + offer.totalPence, 0);
  const hasDuplicateBuyer = new Set(selectedOffers.map(offer => offer.botId)).size !== selectedOffers.length;
  const overStock = selectedQuantity > config.quantity;
  const canApprove = round?.status === "negotiating" && selectedOffers.length > 0 && !overStock && !hasDuplicateBuyer && !roundBusy && !sending && !roundError && !round.error && !error;
  const hasFourRoles = connection?.members?.length === 4 && new Set(connection.members.map(member => member.id)).size === 4 && ["merchant", "denim", "bargain", "premium"].every(role => connection.members?.some(member => member.role === role));
  const messages = transcript?.entries.map(entry => ({ ...entry, text: visibleGroupMessage(entry.text) })).filter(entry => entry.text) || [];
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
          <div className="room-heading"><div><p className="eyebrow">Shared conversation</p><h2>{transcript?.agent.name || connection.botName}</h2></div><span className="room-count">{messages.length} messages</span></div>
          {authors.length > 0 && <div className="room-participants" aria-label="Room participants">{authors.map((author, index) => {
            const member = round?.members.find(item => item.id === author.id);
            return <span className={`room-participant room-person-${index % 4} ${member?.removal === "removed" ? "room-participant-departed" : ""}`} key={author.id}><span aria-hidden="true">{initials(author.name)}</span><span className="room-participant-detail">{author.name}{member && <small>{memberStatus(member)}</small>}</span></span>;
          })}</div>}
          {canManageRound === true && <section className={`room-round ${round?.approval?.acknowledged ? "room-round-acknowledged" : ""}`} aria-label="Autonomous negotiation">
            {!round && <>
              <p className="eyebrow">Autonomous negotiation</p><h3>Let the bots negotiate and leave on their own.</h3>
              <p className="room-note">Start a round, then approve your preferred deal here or say “approve” in the Grok chat. The merchant acknowledges the deal in chat and the other resellers leave the group automatically.</p>
              <button className="primary" disabled={!roundLoaded || roundBusy || sending || !hasFourRoles || !!error || !!roundError || !!transcript?.agent.isRunning} onClick={() => void startRound()}>{roundBusy ? "Starting round…" : !roundLoaded ? "Checking round…" : transcript?.agent.isRunning ? "Bots are working…" : "Start autonomous round"}</button>
              {!hasFourRoles && <p className="room-note"><Link href="/connect">Create a four-bot demo room</Link> to use autonomous deal approval and departures.</p>}
            </>}
            {round?.status === "negotiating" && <>
              <div className="room-composer-heading"><h3>Choose the deal.</h3><span>Live offers from the reseller bots</span></div>
              <p className="room-note">The highest-value compatible offers are selected by default. Choose one buyer or a split allocation. Bots can withdraw if a deal no longer works for them.</p>
              {round.offers.length === 0 ? <p className="room-round-wait" role="status">Waiting for eligible offers from the bots…</p> : <>
                <div className="room-offers">{round.offers.map(offer => <label className={`room-offer ${selectedIds.includes(offer.id) ? "room-offer-selected" : ""}`} key={offer.id}>
                  <input type="checkbox" checked={selectedIds.includes(offer.id)} disabled={roundBusy || sending} onChange={event => setSelection({ roundId: round.roundId, ids: event.target.checked ? [...selectedIds.filter(id => id !== offer.id), offer.id] : selectedIds.filter(id => id !== offer.id) })} />
                  <span><strong>{offer.botName}</strong><small>{offer.quantity} pieces × {formatGbpSpeech(offer.unitPricePence)}</small></span><strong>{formatGbpSpeech(offer.totalPence)}</strong>
                </label>)}</div>
                <div className="room-selection-summary"><p><span>Selected recovery</span><strong>{formatGbpSpeech(selectedTotal)}</strong></p><p><span>Pieces allocated</span><strong>{selectedQuantity} / {config.quantity}</strong></p><p><span>Remaining stock</span><strong>{Math.max(0, config.quantity - selectedQuantity)}</strong></p></div>
                {overStock && <p className="room-action-error" role="alert">These offers request more than the available stock. Deselect an offer before approving.</p>}
                {hasDuplicateBuyer && <p className="room-action-error" role="alert">Select only one offer per buyer.</p>}
                <div className="room-send-row"><button className="primary" disabled={!canApprove} onClick={() => void approveSelected()}>{roundBusy ? "Approving…" : "Approve selected deal"}</button><button className="ghost" disabled={roundBusy || sending} onClick={() => setSelection(null)}>Select best deal</button></div>
              </>}
              <p className="room-note">You can also send “approve” or “approve best deal” in chat to select the best compatible offers automatically.</p>
            </>}
            {round?.approval && <>
              <p className="eyebrow">{round.approval.acknowledged ? "Confirmed in Grok Bot" : "Deal approved"}</p>
              <h3>{round.approval.acknowledged ? "Deal acknowledged." : "Awaiting merchant acknowledgement…"}</h3>
              <p className="room-note">{round.approval.acknowledged ? "The merchant has acknowledged this allocation in the native chat. Resellers who were not selected leave automatically." : "Your allocation is locked. The merchant’s actual reply will confirm the deal in the chat below."}</p>
              <ul className="room-approved-buyers">{round.approval.allocations.map(offer => <li key={offer.id}><span><strong>{offer.botName}</strong><small>{offer.quantity} pieces × {formatGbpSpeech(offer.unitPricePence)}</small></span><strong>{formatGbpSpeech(offer.totalPence)}</strong></li>)}</ul>
              <div className="room-selection-summary"><p><span>Total recovery</span><strong>{formatGbpSpeech(round.approval.totalPence)}</strong></p><p><span>Pieces allocated</span><strong>{round.approval.quantity}</strong></p><p><span>Remaining stock</span><strong>{round.approval.remaining}</strong></p></div>
            </>}
            {round?.status === "closed" && !round.approval && <><h3>Negotiation closed.</h3><p className="room-note">{round.closedReason || "No deal was approved."}</p></>}
            {round?.status === "closed" && <p className="room-note">This round is closed. <Link href="/connect">Create a fresh four-bot room</Link> for another negotiation; departed bots remain in this conversation’s history.</p>}
            {(actionError || roundError || round?.error) && <p className="room-action-error" role="alert">{actionError || roundError || round?.error}</p>}
            <p className="room-note room-autonomy-note">Keep the Mac connector running. It follows the chat and handles departures even when this page is closed. Fictional deals only; no real orders or payments.</p>
          </section>}
          {canManageRound === false && <div className="room-lifecycle-update"><p>For automatic deal acknowledgement and bots leaving the group, <Link href="/connect">download and pair the latest connector</Link>.</p></div>}
          <section className="room-composer" aria-label="Send to the Grok Bot group">
            <div className="room-composer-heading"><h3>Talk to the room.</h3><span>Messages go to your native Grok group</span></div>
            {canSend ? <>
              <div className="room-draft-actions">{canManageRound === false && <button className="ghost" disabled={sending || roundBusy} onClick={() => { setDraft(connection.brief || defaultDemoBrief(config)); setSendStatus(""); }}>New round brief</button>}{(!canManageRound || round?.status === "negotiating") && <button className="ghost" disabled={sending || roundBusy} onClick={() => { setDraft("Approve best deal"); setSendStatus(""); }}>Approval draft</button>}</div>
              <label htmlFor="group-message">Review your message</label><textarea id="group-message" rows={3} maxLength={40000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask a follow-up or approve the best deal…" />
              <div className="room-send-row"><button className="primary" disabled={sending || roundBusy || !draft.trim() || !!transcript?.agent.isRunning || !!error} onClick={() => void sendMessage()}>{sending ? "Sending…" : transcript?.agent.isRunning ? "Bots are working…" : "Send to Grok group"}</button><span>No messages are sent until you choose Send.</span></div>
              {sendStatus && <p role="status" className="room-note">{sendStatus}</p>}
            </> : <p className="room-note">To start a round from this page, <Link href="/connect">download and pair the latest connector</Link>. You can continue sending messages directly in Grok Bot.</p>}
          </section>
          <div className="room-messages">
            {!transcript && !error && <div className="room-empty"><h3>Reading the room…</h3><p>The connector is fetching the conversation from Grok Bot.</p></div>}
            {transcript && messages.length === 0 && <div className="room-empty"><h3>The room is ready.</h3><p>{canManageRound ? "Start an autonomous round above. Each bot’s replies will appear here automatically." : "Send a message above to start the conversation. Each bot’s replies will appear here automatically."}</p></div>}
            {messages.map(entry => {
              const author = entry.author;
              const name = author === "user" ? "You" : author?.name || "Unattributed message";
              const authorIndex = author && author !== "user" ? authors.findIndex(item => item.id === author.id) : -1;
              return <article className={`room-message ${author === "user" ? "room-message-user" : ""}`} key={entry.id}>
                <div className={`room-message-avatar ${authorIndex >= 0 ? `room-person-${authorIndex % 4}` : ""}`} aria-hidden="true">{initials(name)}</div>
                <div><p className="room-message-author"><strong>{name}</strong><span>{author === "user" ? "Group message" : author ? "Grok Bot" : "Author unavailable"}</span></p><p className="room-message-text">{entry.text}</p></div>
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

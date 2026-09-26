"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { bridgeRequest, getConnection, getGroupConnection } from "@/lib/grok-connection";
import { DEFAULT_DEMO_CONFIG, parseDemoConfig, parseDemoSetup, type DemoConfig } from "@/lib/grok-demo";

export default function ConnectPage() {
  const [origin, setOrigin] = useState("");
  const [token, setToken] = useState("");
  const [bots, setBots] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [pairedToken, setPairedToken] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [roomName, setRoomName] = useState("The Last Drop — Live Negotiation");
  const [config, setConfig] = useState<DemoConfig>(DEFAULT_DEMO_CONFIG);
  const paired = !!pairedToken && pairedToken === token.trim();
  useEffect(() => {
    setOrigin(location.origin);
    const saved = getGroupConnection() || getConnection();
    if (saved) { setToken(saved.token); setSelected(saved.botId); if (saved.config) setConfig(saved.config); setMessage(`Saved room: ${saved.botName}. Pair to create a room or select another conversation.`); }
  }, []);
  async function connect() {
    setBusy("pair"); setMessage(""); setCanCreate(false); setPairedToken("");
    try {
      const pairing = token.trim();
      const data = await bridgeRequest("/bots", pairing);
      setBots(data.bots);
      setSelected(current => data.bots.some((bot: { id: string }) => bot.id === current) ? current : data.bots[0]?.id || "");
      setPairedToken(pairing);
      try { const capabilities = await bridgeRequest("/capabilities", pairing); setCanCreate(capabilities.features?.includes("native-group-setup") === true); }
      catch { setMessage("Connected. To create a room here, download the latest connector and restart it in Terminal."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed"); }
    finally { setBusy(""); }
  }
  async function setupDemo() {
    setBusy("setup"); setMessage("Creating or finding the four teammates and their native Grok Bot group…");
    try {
      const checked = parseDemoConfig(config);
      const result = parseDemoSetup(await bridgeRequest("/setup-demo", token.trim(), { name: roomName, config: checked }));
      sessionStorage.setItem("lastdrop-grok-room", JSON.stringify({ token: token.trim(), botId: result.group.id, botName: result.group.name, members: result.members, brief: result.brief, config: result.config }));
      location.assign("/group");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Room setup failed. Retry to reuse any teammates already created."); }
    finally { setBusy(""); }
  }
  function moneyField(key: keyof Omit<DemoConfig, "product" | "quantity" | "premiumMaxQuantity">, label: string) {
    return <label key={key}>{label}<span className="input-currency">£<input type="number" min="0.01" max="10000000" step="0.01" value={config[key] / 100} onChange={event => setConfig(current => ({ ...current, [key]: Math.round(Number(event.target.value) * 100) }))} /></span></label>;
  }
  return <div className="store"><AppNav current="connect" /><main className="office-main"><section className="tag connect-panel">
    <p className="office-kicker">Your account. Your teammates.</p><h1>Connect your Grok Bot.</h1>
    <p>Pair once, then create a merchant, three reseller bots and their shared conversation here. The bots negotiate inside Grok Bot; Last Drop shows the conversation.</p>
    <ol><li>Open Grok Bot and sign in on your Mac. You need Node.js and Python 3 installed.</li>
      <li><a href="/connect-grok.mjs" download>Download the latest connector</a>, then run this in Terminal:<pre className="connect-command">node ~/Downloads/connect-grok.mjs --origin {origin || "YOUR_SITE_URL"}</pre></li>
      <li>Copy the pairing code shown in Terminal. If the browser asks, allow this site to access your local network. Keep the connector running.</li></ol>
    <label>Pairing code<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} /></label>
    <button className="primary" disabled={!!busy || !token.trim()} onClick={() => void connect()}>{busy === "pair" ? "Connecting…" : "Pair with Grok Bot"}</button>
    {message && <p role="status" className="connect-status">{message}</p>}
    {paired && <>
      <section className="demo-setup">
        <p className="eyebrow">Four real bots. One native group.</p><h2>Create your demo room.</h2>
        <p>The merchant manages the lot. Denim, bargain and premium resellers choose their own offers. Repeating setup reuses this room’s teammates; you start the round separately.</p>
        <label>Room name<input maxLength={100} value={roomName} onChange={event => setRoomName(event.target.value)} /></label>
        <details className="demo-settings"><summary>Lot, prices and buyer budgets</summary>
          <label>Product description<input maxLength={500} value={config.product} onChange={event => setConfig(current => ({ ...current, product: event.target.value }))} /></label>
          <div className="demo-fields">
            <label>Lot quantity<input type="number" min="1" max="10000" step="1" value={config.quantity} onChange={event => setConfig(current => ({ ...current, quantity: Number(event.target.value) }))} /></label>
            <label>Premium buyer maximum quantity<input type="number" min="1" max={config.quantity} step="1" value={config.premiumMaxQuantity} onChange={event => setConfig(current => ({ ...current, premiumMaxQuantity: Number(event.target.value) }))} /></label>
            {moneyField("askingPricePence", "Asking price per piece")}{moneyField("floorPricePence", "Merchant floor per piece")}
            {moneyField("denimBudgetPence", "Denim buyer total budget")}{moneyField("bargainBudgetPence", "Bargain buyer total budget")}{moneyField("premiumBudgetPence", "Premium buyer total budget")}
          </div>
          <p className="room-note">These are constraints, not scripted bids. This demo makes no real orders or payments.</p>
        </details>
        <button className="primary" disabled={!!busy || !canCreate || !roomName.trim()} onClick={() => void setupDemo()}>{busy === "setup" ? "Preparing four bots and room…" : "Create or open demo room"}</button>
        {!canCreate && <p className="room-note">This connector needs an update. Download the latest version above, stop the old connector, then pair again.</p>}
      </section>
      {bots.length > 0 && <details className="demo-settings existing-room"><summary>Use an existing conversation</summary>
        <label>Bot or shared conversation<select value={selected} onChange={event => setSelected(event.target.value)}>{bots.map(bot => <option key={bot.id} value={bot.id}>{bot.name}</option>)}</select></label>
        <button className="primary" disabled={!!busy} onClick={() => { const bot = bots.find(row => row.id === selected); if (bot) { const saved = getGroupConnection(); sessionStorage.setItem("lastdrop-grok-room", JSON.stringify({ ...(saved?.botId === bot.id ? saved : {}), token: token.trim(), botId: bot.id, botName: bot.name })); location.assign("/group"); } }}>Watch shared room</button>
        <p className="room-note">Choose a group to watch its real participants. A single teammate can also draft the four roles on the original floor.</p>
        <button className="ghost" disabled={!!busy} onClick={() => { const bot = bots.find(row => row.id === selected); if (bot) { sessionStorage.setItem("lastdrop-grok", JSON.stringify({ token: token.trim(), botId: bot.id, botName: bot.name })); location.assign("/floor"); } }}>Use single-bot floor</button>
      </details>}
    </>}
    <p><button className="ghost" disabled={!!busy} onClick={() => { sessionStorage.removeItem("lastdrop-grok"); sessionStorage.removeItem("lastdrop-grok-room"); setToken(""); setBots([]); setPairedToken(""); setMessage("Disconnected."); }}>Disconnect</button> <Link href="/group">Shared room</Link> · <Link href="/floor">Back to the floor</Link></p>
    <small>Your Grok sign-in stays in your Mac’s Keychain. Pairing is saved for this browser tab only. <a href="/grok-bot-LICENSE.txt">Connector license</a></small>
  </section></main></div>;
}

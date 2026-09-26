# The Last Drop

Shops don't have a stock problem. They have a matchmaking problem.

A merchant flags dead stock — 300 Harbor & Co. trucker jackets, week nine on the rail — and pitches the lot to three reseller bots. They haggle in language. Plain code, not the model, refuses anything under the merchant's floor. One buyer walks. The best legal offer is approved into an order and a docket.

Built for the Grok Bot Commerce London Hackathon, Fleek, 26 Sep 2026.

## Setup (60 seconds)

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000. That is Harbor & Co.'s catalog. The negotiation floor is at http://localhost:3000/floor, and the customer shop is at http://localhost:3000/shop.

To speak with your existing Grok Bot teammates, run this app on the Mac where
Grok Bot is installed and signed in. Install the `grok-bot` skill, then copy
the example env file and restart:

```bash
cp .env.example .env.local
```

The default provider is **Grok Bot**, through the installed skill's
`scripts/grokbot.py` CLI. It checks `status`, resolves existing bots with `list`,
and uses `chat --id …` for each turn. It does not create bots or require an xAI
API key. By default, the four roles use existing bots named Nell, Mara, Len, and
Ida. Set `GROK_BOT_NAME` (or `GROK_BOT_ID`) to use one existing bot for all four
roles, or set each role's selector in `.env.local`. Each request includes the
role, lot, floor, and current round's tape and asks only for a fictional draft.

Current Grok Bot releases use account-based credential storage. If an older
skill reports an unexpected token format or an unsupported app version, apply
the compatibility patch in `scripts/grok-bot-compat.patch` to the installed
skill directory (once):

```bash
patch -d "$HOME/.agents/skills/grok-bot" -p1 < scripts/grok-bot-compat.patch
python3 scripts/test_grok_bot_compat.py
```

The patch reads the active account's encrypted token and the installed app's
version. Credentials stay in the skill's existing Keychain broker and are never
copied into this repository. Adjust the skill directory if installed elsewhere.

The floor displays connection problems with a **Check connection again** button.
It never silently substitutes recorded bids when a live connection fails. You
can explicitly choose **Play the recorded round**, or set `GROK_PROVIDER=replay`.
For a hosted server without the desktop app, use `GROK_PROVIDER=xai` with an
`XAI_API_KEY` instead. The CLI integration is intended for a trusted local demo,
not an unauthenticated public deployment.

## Environment

### Hosted user onboarding

The preferred demo is the native shared room. The connector bundles the
MIT-licensed [Last Drop fork of grok-bot-skill](https://github.com/Kazybekkh/grok-bot-skill).
After pairing, press **Create or open demo room**. Edit the lot, floor, and
buyer budgets; setup creates missing teammates and a native four-bot group,
or verifies and reuses an exact match. It does not start a round automatically.
In `/group`, press **Start autonomous round**. Grok's bots choose their own bids
and can withdraw when a deal does not suit them. The connector validates each
bot's readable offer sentence against the floor, budget and available stock. Select one
buyer or a compatible split, then **Approve selected deal**, or say exactly
**approve** / **approve best deal** in the native chat to select the best current
compatible offers. Questions such as “approve?” do not approve a deal.

The merchant must acknowledge the locked allocation in its own native message
before the app displays **Deal acknowledged**. Losing resellers are then removed
from the actual Grok group, preserving their bots and message history. A reseller
that declares withdrawal can also leave autonomously before approval. The
merchant and winning resellers remain. A new negotiation after departures needs
a fresh four-bot room (choose a new room name in Connect Grok).

New rounds use readable offer, withdrawal and confirmation sentences in native Grok
chat, with short lot/confirmation references instead of raw JSON markers. Old
rounds remain supported; existing chat history is not rewritten. After starting
a round, the website is optional: negotiation, human approval and acknowledgement
can all happen in the Grok Bot app.

The connector follows the chat every four seconds even with the website closed.
Its private round state lives under `~/.lastdrop/rounds`, scoped by the site origin,
with no pairing code or Grok credential stored there. It records mutation intent
before native sends, never blindly resends an uncertain message, and verifies
native membership before showing that a bot left. Keep the Mac connector running;
stopping it pauses this automation. The single downloadable file bundles both the
skill CLI and `scripts/grok-round.mjs`.

The shared-room demo does not create Shopify orders or make payments. The
floor/order demo below is a separate workflow. Remote judges still need a screen share of the paired Mac;
this feature does not publish private Grok transcripts to a public server.

To refresh the bundled CLI from a sibling fork checkout, run
`node scripts/bundle-grok-skill.mjs`. The fork includes current account-storage
and app-version compatibility, so it does not need the legacy patch below.

On Vercel, open `/connect`. Download the connector and run the command shown
there on the user's Mac, where Grok Bot is signed in. Enter its pairing code,
fetch the user's bots, and choose a teammate. The selection is per browser tab;
no bot ID or Grok credential is embedded in the deployed app. The connector
binds only to `127.0.0.1:4318`, checks the exact site origin and pairing code,
and uses the included MIT-licensed, compatibility-patched grok-bot CLI.
The user needs Node.js, Python 3, and Grok Bot on their Mac, and must keep the
connector running. Browser local-network permission may be required. This is
a local companion connection, not a hosted OAuth integration.

Product imagery is generated demo imagery; asset paths and prompts are recorded
in `docs/product-imagery.md`.

| Variable | Required | What it does |
| --- | --- | --- |
| `GROK_PROVIDER` | No | `grok-bot` (default), `xai`, or `replay`. |
| `GROK_BOT_SCRIPT` | No | Path to the installed skill's `grokbot.py`. Automatically searches `~/.agents`, `~/.codex`, `~/.cursor`, and `~/.claude` skill directories. |
| `GROK_BOT_PYTHON` | No | Python executable. Defaults to `python3`. |
| `GROK_BOT_NAME` / `GROK_BOT_ID` | No | One existing bot shared by all four roles. |
| `GROK_BOT_{MERCHANT,DENIM,BARGAIN,PREMIUM}_{NAME,ID}` | No | Per-role selectors override the shared bot; IDs take precedence over names for the same role. |
| `XAI_API_KEY` | For `xai` | xAI API key; unused by the Grok Bot skill. |
| `XAI_MODEL` | No | xAI chat model. Defaults to `grok-4.6`. |
| `SHOPIFY_STORE_DOMAIN` | No | Leave blank. The demo shop is the Harbor & Co. fixture. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | No | Leave blank. The catalog is shaped like a Shopify product export. |

The separate floor's round and wholesale order live in the browser session.
Native shared-room state persists locally in the connector. Supabase is not connected.

## Separate negotiation-floor demo

Leave the floor at **£22** (a shade over the £19.40 cost). Retail is £110. The wholesale ask is £38.

1. Open the catalog. The trucker is the only dead-stock row: 12 sold in nine weeks, 300 still on hand, about 225 weeks of cover, £5,820 tied up. The oxford and the jean are moving. The banner says this Shopify catalog is simulated.
2. Optional: open the storefront and the trucker product. Retail is £110. Add one to the bag. Hundreds stay in the warehouse.
3. Press **Pitch this lot**. On the floor, the badge says **Live · Grok Bot** when the skill is connected, or **Recorded round** when explicitly selected. The recorded script is deterministic; live wording and bids can vary. Nell opens. Mara (denim) bids **£34 × 300**. Len (bargain) bids **£16 × 300** and it stamps **Below floor**. Len walks. Ida (premium) bids **£41 × 120** and will not take the dump.
4. The rail highlights Mara. Her total clears Ida's higher unit price. Len's refused bid stays under the rail.
5. Send the counter already in the box: **£36**, "You are buying the cloth, not a leftover." Mara meets £36 on all 300. Ida holds the curated 120. Try a counter under £22 first if you want to show the floor stop a merchant too.
6. Press **Approve Mara**. Read the docket: lot, winner, unit price, quantity, total, London timestamp, and Len's rejected £16 still on the slip. It posts order **#1042** back to the Harbor catalog. Open the order book and the on-hand count is 0.

## What the code guarantees

`lib/commerce.ts` adjudicates every bid. A price under the floor is blocked, dropped from the book when a buyer walks, and cannot be selected or turned into an order. `POST /api/order` runs that same function again. `lib/shop.ts` decides which catalog row is dead stock and posts the winning docket as the next order. Tests cover floor rejection, winner selection, the receipt, and the shop inventory drop.

Live turns go through `lib/grok.ts`, which selects the installed skill adapter
in `lib/grok-bot.ts` or the explicit xAI API provider. Each desk has its own
persona. The skill adapter parses completed assistant replies only; user echoes,
tool output, and still-running turns never become bids. Concurrent turns are
rejected within the local server process to avoid mixing bot conversations.

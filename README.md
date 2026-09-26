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

Open http://localhost:3000.

To speak with live Grok, copy the example env file and add a key, then restart:

```bash
cp .env.example .env.local
```

## Environment

| Variable | Required | What it does |
| --- | --- | --- |
| `XAI_API_KEY` | No | Turns on live Grok for Nell, Mara, Len, and Ida. With no key, the app plays a labeled recorded round and never calls it live. |
| `XAI_MODEL` | No | Chat model. Defaults to `grok-4.6`. |

The round lives in the browser session. Supabase is not used.

## 3-minute demo

Leave the floor at **£22** (a shade over the £19.40 cost). Asking price is £38.

1. Read the hang-tag: 300 jackets, mid-indigo, 13.5 oz Japanese selvedge, cut in Porto. Say the line: shops don't have a stock problem, they have a matchmaking problem.
2. Press **Pitch this lot**. The badge says **Recorded round** unless `XAI_API_KEY` is set. Nell opens. Mara (denim) bids **£34 × 300**. Len (bargain) bids **£16 × 300** and it stamps **Below floor**. Len walks. Ida (premium) bids **£41 × 120** and will not take the dump.
3. The rail highlights Mara. Her total clears Ida's higher unit price. Len's refused bid stays under the rail.
4. Send the counter already in the box: **£36**, "You are buying the cloth, not a leftover." Mara meets £36 on all 300. Ida holds the curated 120. Try a counter under £22 first if you want to show the floor stop a merchant too.
5. Press **Approve Mara**. Read the docket: lot, winner, unit price, quantity, total, London timestamp, and Len's rejected £16 still on the slip.

## What the code guarantees

`lib/commerce.ts` adjudicates every bid. A price under the floor is blocked, dropped from the book when a buyer walks, and cannot be selected or turned into an order. `POST /api/order` runs that same function again. Tests cover floor rejection, winner selection, and the receipt.

Live turns go through `lib/grok.ts` only. Each desk has its own system prompt. The provider is that one module — swap the fetch, keep the room.

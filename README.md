# 🔥 HOT SEAT

A no-download party game. One phone per person, a room code to join. You don't
answer questions — you **predict your friends**, and bet on who the group will
pick. Read the room right and you're safe. Miss it and you take the hit.

Plays 2 to 20 people (the host sets the room's max), sober or drinking.

## How a round works

1. Everyone joins a room with a 4-letter code on their own phone.
2. The same prompt hits every screen — *"Who's most likely to text their ex tonight?"*
3. You secretly vote for someone, **and** predict who the group will pick.
4. Dramatic reveal: whoever the group picked is in the **hot seat**.
5. Misread the room → take a sip. The hot seat takes the heat too.
6. Next prompt. Rounds stay under a minute.

There's no correct answer to the question — the majority *is* the answer, so
you're really betting on how well you know the room.

## Modes

| Mode | What it is |
|---|---|
| **Chill** | Clean and silly. Good for mixed groups. |
| **Roast** | Savage but friendly. All about the room. |
| **Spicy** | After dark — every phone opts in before it unlocks. |
| **Chaos** | Everything mixed, plus wildcard rounds that flip the rules. |

## Stack

- **Client:** React + Vite (phone-first)
- **Server:** Node + Express + Socket.IO — realtime rooms held in memory
- No database: a room lives in RAM and dies when it empties. Party games are ephemeral.

## Run it locally

```bash
# terminal 1 — server
cd server && npm install && npm start      # :3001

# terminal 2 — client
cd client && npm install && npm run dev     # :5173
```

Open `http://localhost:5173` on a couple of phones/tabs on the same network.
(For phones, point `VITE_SERVER_URL` at your machine's LAN IP — see `.env.example`.)

Run the game-logic checks:

```bash
cd server && npm test
```

## Deploy

The server serves the built client, so it's a single process:

```bash
cd client && npm install && npm run build   # outputs client/dist
cd ../server && npm install && npm start      # serves dist + sockets on $PORT
```

Any **persistent** Node host (Railway, Fly, Render, a VPS) works — it needs a
long-lived process for the Socket.IO server and its in-memory rooms. Serverless
platforms (Vercel, Netlify Functions, Cloudflare Workers) can't host the
realtime backend; use them only for a separate static frontend. Set `PORT` if
the platform needs it; sockets use the same port.

**Railway (recommended, one click):** the repo ships `railway.json`.

1. Push to GitHub (already done).
2. [railway.com](https://railway.com) → **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway reads `railway.json`: runs `npm run build` (builds the client) then
   `npm start` (serves the client + Socket.IO on one port, `$PORT` injected).
   Node is pinned to 22 via `.nvmrc`.
4. **Settings → Networking → Generate Domain** to get a public URL. WebSockets
   work on it out of the box. Done.

The hobby plan stays always-on (no cold-start/idle spin-down), so live rooms
don't drop. To split frontend/backend later, host the client anywhere static
and set `VITE_SERVER_URL` to the backend's URL at build time.

**Render (also works):** the repo also ships a `render.yaml` blueprint
(**New → Blueprint** → pick repo). The free plan spins down when idle (~30s cold
start drops live rooms); bump `plan:` to `starter` for always-on.

**Moving off Render:** deleting the repo push won't undeploy it — in the Render
dashboard, open the `hotseat` service → **Settings → Delete Service** (or just
turn off **Auto-Deploy**) once Railway is live.

## Shipped vs. deferred

**In:** the full core loop (rooms, voting + prediction, reveal, scoring,
penalties), all four modes with Spicy/Chaos consent gating, wildcard rounds
(minority / double / reverse), reconnect-on-refresh, and an end-of-night recap
with awards.

All three **signature features** are wired in:
- **The Traitor** — each round (3+ players) one player is secretly told to vote
  against the crowd; pulling it off means no drink + a revenge token, and the
  reveal names them either way.
- **Revenge tokens** — the most-picked player earns a token to hand anyone a
  challenge, broadcast to the room as a toast.
- **The Exposed Card** — once a game (round 3+), the reveal shows exactly who
  voted for whom. Votes are kept server-side and never leaked otherwise.

**Deferred:** per-round timers and QR-code room joins.

> `ponytail:` the Traitor's "nobody catches them" is simplified — success =
> voting off the hot seat, no separate catch-the-traitor vote. The Exposed Card
> fires on a random roll (≤1/game). Add a catch vote / host-triggered expose if
> playtesting wants them.

## Not drinking?

Every penalty has a non-drinking challenge. Nobody is ever required to drink.
18+. Know your limit.

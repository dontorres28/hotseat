// In-memory game state. Party games are ephemeral — a room lives in RAM and
// dies when it empties. No database for v1.
// ponytail: in-memory single-process store; move rooms to Redis only if you run
// more than one server instance.

import { promptsForMode, shuffled, CHALLENGES, WILDCARDS, CONSENT_MODES, PACKS, packById } from './content.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no easily-confused chars
const rooms = new Map(); // code -> room
const EMPTY_GRACE_MS = 2 * 60 * 1000; // keep a room this long after it empties, for reconnects

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createRoom(mode) {
  const code = makeCode();
  const room = {
    code,
    mode,
    hostId: null,
    phase: 'lobby',
    round: 0,
    players: new Map(), // id -> player
    deck: shuffled(promptsForMode(mode)),
    deckIndex: 0,
    unlockedPacks: new Set(), // purchased (stubbed) packs
    enabledPacks: new Set(),  // unlocked packs switched on for this room
    prompt: null,
    wildcard: null,
    submissions: new Map(), // playerId -> { voteFor, predict }
    usedChallenges: new Set(),
    lastReveal: null,
    emptyTimer: null,
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get((code || '').toUpperCase());
}

// Rebuild the deck from the mode plus any unlocked+enabled packs. Called at
// game start so lobby pack choices take effect.
export function buildDeck(room) {
  let prompts = [...promptsForMode(room.mode)];
  for (const id of room.enabledPacks) {
    if (room.unlockedPacks.has(id)) prompts = prompts.concat(packById(id)?.prompts ?? []);
  }
  room.deck = shuffled(prompts);
  room.deckIndex = 0;
}

// Stubbed purchase. Marks a pack unlocked + enabled for this room.
// ponytail: wire Stripe Checkout + a webhook that calls this on payment success;
// no real charge happens here.
export function unlockPack(room, packId) {
  if (!packById(packId)) return false;
  room.unlockedPacks.add(packId);
  room.enabledPacks.add(packId);
  return true;
}

// Toggle an already-unlocked pack on/off for this room.
export function togglePack(room, packId) {
  if (!room.unlockedPacks.has(packId)) return false;
  if (room.enabledPacks.has(packId)) room.enabledPacks.delete(packId);
  else room.enabledPacks.add(packId);
  return true;
}

// Catalog with this room's purchase/enable state, for the lobby UI.
export function packCatalog(room) {
  return PACKS.map((p) => ({
    id: p.id, name: p.name, emoji: p.emoji, price: p.price, blurb: p.blurb,
    unlocked: room.unlockedPacks.has(p.id), enabled: room.enabledPacks.has(p.id),
  }));
}

export function addPlayer(room, name, { host = false } = {}) {
  const id = makeId();
  const player = {
    id,
    name: name.trim().slice(0, 20) || 'Player',
    connected: true,
    consented: !CONSENT_MODES.includes(room.mode),
    socketId: null,
    timesInHotSeat: 0,
    correctPredictions: 0,
    sips: 0,
    tokens: 0,       // revenge tokens
    traitorWins: 0,  // rounds pulled off as the Traitor
  };
  room.players.set(id, player);
  if (host || !room.hostId) room.hostId = id;
  if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
  return player;
}

export function removePlayer(room, playerId) {
  const p = room.players.get(playerId);
  if (p) p.connected = false;
  // Hand host off to any still-connected player.
  if (room.hostId === playerId) {
    const next = [...room.players.values()].find((x) => x.connected && x.id !== playerId);
    room.hostId = next ? next.id : room.hostId;
  }
  // If everyone is gone, schedule cleanup.
  if (![...room.players.values()].some((x) => x.connected)) {
    room.emptyTimer = setTimeout(() => rooms.delete(room.code), EMPTY_GRACE_MS);
  }
}

export function allConsented(room) {
  return [...room.players.values()].filter((p) => p.connected).every((p) => p.consented);
}

function activePlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}

export function dealPrompt(room) {
  if (room.deckIndex >= room.deck.length) {
    room.deck = shuffled(room.deck); // reshuffle, keep playing
    room.deckIndex = 0;
  }
  room.round += 1;
  room.prompt = room.deck[room.deckIndex++];
  room.submissions = new Map();
  // Chaos mode (or a 1-in-5 roll) can flip a wildcard rule.
  const roll = room.mode === 'chaos' ? Math.random() < 0.4 : Math.random() < 0.12;
  room.wildcard = roll ? WILDCARDS[Math.floor(Math.random() * WILDCARDS.length)] : null;
  // The Traitor: one random player is secretly told to vote against the crowd.
  // Needs a real crowd to hide in.
  const active = activePlayers(room);
  room.traitorId = active.length >= 3 ? active[Math.floor(Math.random() * active.length)].id : null;
  room.phase = 'prompt';
  room.lastReveal = null;
}

export function traitorId(room) {
  return room.traitorId || null;
}

export function submit(room, playerId, voteFor, predict) {
  const players = activePlayers(room);
  const ids = new Set(players.map((p) => p.id));
  // You can't vote for yourself; prediction can be anyone.
  if (!ids.has(voteFor) || voteFor === playerId) {
    const others = players.filter((p) => p.id !== playerId);
    voteFor = others.length ? others[0].id : playerId;
  }
  if (!ids.has(predict)) predict = voteFor;
  room.submissions.set(playerId, { voteFor, predict });
}

export function everyoneSubmitted(room) {
  const players = activePlayers(room);
  return players.length > 0 && players.every((p) => room.submissions.has(p.id));
}

function drawChallenge(room) {
  const pool = CHALLENGES.filter((c) => !room.usedChallenges.has(c));
  const pick = (pool.length ? pool : CHALLENGES)[Math.floor(Math.random() * (pool.length || CHALLENGES.length))];
  room.usedChallenges.add(pick);
  if (room.usedChallenges.size >= CHALLENGES.length) room.usedChallenges.clear();
  return pick;
}

// Tally votes, decide the hot seat, assign penalties, update running stats.
export function reveal(room) {
  const players = activePlayers(room);
  const counts = new Map(players.map((p) => [p.id, 0]));
  for (const { voteFor } of room.submissions.values()) {
    counts.set(voteFor, (counts.get(voteFor) || 0) + 1);
  }
  const wc = room.wildcard?.id;

  // Hot seat target: most-picked normally, least-picked under MINORITY.
  const entries = [...counts.entries()];
  const pickMinority = wc === 'minority';
  let best = pickMinority ? Infinity : -1;
  for (const [, n] of entries) {
    if (pickMinority ? n < best : n > best) best = n;
  }
  const tied = entries.filter(([, n]) => n === best).map(([id]) => id);
  const targetId = tied[Math.floor(Math.random() * tied.length)];
  const target = room.players.get(targetId);
  if (target) target.timesInHotSeat += 1;

  // Most-picked player (for the revenge token) — the hot seat normally, but a
  // distinct person under the MINORITY rule.
  const maxVotes = Math.max(...entries.map(([, n]) => n));
  const topTied = entries.filter(([, n]) => n === maxVotes).map(([id]) => id);
  const mostPickedId = topTied[Math.floor(Math.random() * topTied.length)];

  // The Traitor pulled it off if they voted AGAINST the crowd (not the hot seat).
  const tId = room.traitorId;
  const tSub = tId ? room.submissions.get(tId) : null;
  const traitorWon = !!(tId && tSub && tSub.voteFor !== targetId);

  const doubled = wc === 'double';
  const reversed = wc === 'reverse';

  const results = players.map((p) => {
    const sub = room.submissions.get(p.id);
    const readRight = sub && sub.predict === targetId; // did they read the room?
    if (readRight) p.correctPredictions += 1;
    let drinks;
    if (p.id === tId) {
      drinks = !traitorWon; // the Traitor is judged on the mission, not the read
    } else {
      // Who drinks: wrong readers normally; under REVERSE the right readers drink.
      drinks = reversed ? !!readRight : !readRight;
    }
    let sips = 0;
    if (drinks) { sips = doubled && p.id !== tId ? 2 : 1; p.sips += sips; }
    return { id: p.id, name: p.name, predict: sub?.predict ?? null, readRight: !!readRight, sips };
  });

  // Revenge token: the most-picked player earns one to spend later.
  const mostPicked = room.players.get(mostPickedId);
  if (mostPicked) mostPicked.tokens += 1;
  // Traitor reward: a win is a token too.
  if (traitorWon) { const t = room.players.get(tId); if (t) { t.tokens += 1; t.traitorWins += 1; } }

  // The hot seat always takes the heat, with a challenge.
  const challenge = drawChallenge(room);
  if (target) target.sips += 1;

  // The Exposed Card: once a game (from round 3+), reveal who voted for whom.
  let exposed = null;
  if (!room.exposedUsed && room.round >= 3 && Math.random() < 0.3) {
    room.exposedUsed = true;
    exposed = [...room.submissions.entries()].map(([voter, s]) => ({
      voter: room.players.get(voter)?.name,
      target: room.players.get(s.voteFor)?.name,
    }));
  }

  room.phase = 'reveal';
  room.lastReveal = {
    prompt: room.prompt,
    wildcard: room.wildcard,
    round: room.round,
    // Vote *counts* only — individual votes stay secret unless it's an Exposed round.
    breakdown: entries
      .map(([id, n]) => ({ name: room.players.get(id)?.name, votes: n }))
      .sort((a, b) => b.votes - a.votes),
    targetId,
    targetName: target?.name,
    challenge,
    results,
    revengeTo: mostPicked?.name,
    traitor: tId ? { name: room.players.get(tId)?.name, won: traitorWon } : null,
    exposed,
  };
  return room.lastReveal;
}

// Spend a revenge token to hand someone a challenge. Returns the payload to
// broadcast, or null if the move isn't allowed.
export function spendToken(room, playerId, targetId) {
  const from = room.players.get(playerId);
  const to = room.players.get(targetId);
  if (!from || !to || from.tokens <= 0 || targetId === playerId) return null;
  from.tokens -= 1;
  return { fromName: from.name, toName: to.name, challenge: drawChallenge(room) };
}

export function recap(room) {
  room.phase = 'recap';
  const players = [...room.players.values()];
  const award = (key) => {
    const max = Math.max(0, ...players.map((p) => p[key]));
    return max > 0 ? players.filter((p) => p[key] === max).map((p) => p.name) : [];
  };
  return {
    rounds: room.round,
    awards: [
      { title: 'Most Roasted', emoji: '🔥', winners: award('timesInHotSeat'), stat: 'times in the hot seat' },
      { title: 'Best Mind Reader', emoji: '🔮', winners: award('correctPredictions'), stat: 'rooms read right' },
      { title: 'Biggest Traitor', emoji: '😈', winners: award('traitorWins'), stat: 'traitor missions pulled off' },
      { title: 'The Tank', emoji: '🍺', winners: award('sips'), stat: 'sips taken' },
    ],
    scoreboard: players
      .map((p) => ({ name: p.name, reads: p.correctPredictions, hotseat: p.timesInHotSeat, sips: p.sips }))
      .sort((a, b) => b.reads - a.reads),
  };
}

// Public snapshot sent to every client. Never leaks individual votes.
export function snapshot(room) {
  return {
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    needsConsent: CONSENT_MODES.includes(room.mode),
    packs: packCatalog(room),
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, connected: p.connected, consented: p.consented, tokens: p.tokens,
    })),
    prompt: room.phase === 'prompt' ? room.prompt : null,
    wildcard: room.phase === 'prompt' ? room.wildcard : null,
    submittedIds: room.phase === 'prompt' ? [...room.submissions.keys()] : [],
    reveal: room.phase === 'reveal' ? room.lastReveal : null,
  };
}

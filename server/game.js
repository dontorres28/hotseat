// In-memory game state. Party games are ephemeral — a room lives in RAM and
// dies when it empties. No database for v1.
// ponytail: in-memory single-process store; move rooms to Redis only if you run
// more than one server instance.

import { promptsForMode, shuffled, CONSENT_MODES, packExists, packPrompts, packCatalog as catalogFor, wildcardList, challengeEntries, dareEntries, awards as awardStrings, topicsList, validatePrompt } from './content.js';

export function randomDare(room) {
  const n = room ? connectedCount(room) : 20;
  const lang = room ? room.lang : 'en';
  const fit = dareEntries(lang).filter((d) => d.min <= n);
  const pool = fit.length ? fit : dareEntries(lang);
  return pool[Math.floor(Math.random() * pool.length)].text;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no easily-confused chars
const rooms = new Map(); // code -> room
const EMPTY_GRACE_MS = 2 * 60 * 1000; // keep a room this long after it empties, for reconnects
const MAX_ROOMS = 5000; // ponytail: single-process memory guard; raise or move to Redis if you scale out

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

function pickTopic(lang) {
  const t = topicsList(lang);
  return t[Math.floor(Math.random() * t.length)];
}

// A player submits (or replaces) their one lobby question. Validated server-side.
export function setCustomPrompt(room, playerId, text) {
  const p = room.players.get(playerId);
  if (!p) return { error: 'no_player' };
  if (room.phase !== 'lobby') return { error: 'closed' };
  const names = [...room.players.values()].map((x) => x.name);
  const res = validatePrompt(text, names);
  if (res.error) return res;
  p.customPrompt = res.text;
  return { ok: true };
}

export function createRoom(mode, lang = 'en') {
  if (rooms.size >= MAX_ROOMS) return null;
  const code = makeCode();
  const room = {
    code,
    mode,
    lang,
    hostId: null,
    phase: 'lobby',
    round: 0,
    players: new Map(), // id -> player
    deck: shuffled(promptsForMode(mode, lang)),
    deckIndex: 0,
    maxPlayers: mode === 'duel' ? 4 : 20, // duel is a 2-4 mode; everything else opens to 20
    totalRounds: 10, // host-chosen game length (3-20)
    enabledPacks: new Set(), // packs switched on for this room
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
  return rooms.get(String(code || '').toUpperCase());
}

// Rebuild the deck from the mode plus any enabled packs. Called at game start
// so lobby pack choices take effect.
export function buildDeck(room) {
  let prompts = [...promptsForMode(room.mode, room.lang)];
  for (const id of room.enabledPacks) prompts = prompts.concat(packPrompts(id, room.lang));
  // Fold in the questions players wrote in the lobby.
  prompts = prompts.concat([...room.players.values()].map((p) => p.customPrompt).filter(Boolean));
  room.deck = shuffled(prompts);
  room.deckIndex = 0;
}

// Toggle a pack on/off for this room. Packs are free — just a selection.
export function togglePack(room, packId) {
  if (!packExists(packId)) return false;
  if (room.enabledPacks.has(packId)) room.enabledPacks.delete(packId);
  else room.enabledPacks.add(packId);
  return true;
}

// Catalog with this room's enabled state (in the room's language), for the lobby UI.
export function packCatalog(room) {
  return catalogFor(room.enabledPacks, room.lang);
}

export function addPlayer(room, name, { host = false } = {}) {
  const id = makeId();
  const player = {
    id,
    name: String(name ?? '').trim().slice(0, 20) || 'Player',
    connected: true,
    consented: !CONSENT_MODES.includes(room.mode),
    socketId: null,
    timesInHotSeat: 0,
    correctPredictions: 0,
    sips: 0,
    tokens: 0,       // revenge tokens
    traitorWins: 0,  // rounds pulled off as the Traitor
    topic: pickTopic(room.lang), // seed for the player's own question
    customPrompt: null,
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

const MIN_PLAYERS = 2;        // minimum to start a game
export const MIN_MAX = 2;     // smallest cap a host can set
export const MAX_MAX = 20;    // largest cap
export const MIN_ROUNDS = 3;  // host-chosen game length
export const MAX_ROUNDS = 20;

export function setRounds(room, n) {
  room.totalRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.floor(Number(n)) || room.totalRounds));
  return room.totalRounds;
}

export function connectedCount(room) {
  return [...room.players.values()].filter((p) => p.connected).length;
}
export function enoughPlayers(room) {
  return connectedCount(room) >= MIN_PLAYERS;
}
export function roomFull(room) {
  return connectedCount(room) >= room.maxPlayers;
}
// Host sets the cap; it can't go below who's already here, or outside [2, 20].
export function setMax(room, n) {
  const ceiling = room.mode === 'duel' ? 4 : MAX_MAX; // duel caps at 4
  const floor = Math.max(MIN_MAX, connectedCount(room));
  room.maxPlayers = Math.min(ceiling, Math.max(floor, Math.floor(Number(n)) || floor));
  return room.maxPlayers;
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
  const active = activePlayers(room);
  if (room.mode === 'duel') {
    // Two players face off; no wildcard, no traitor.
    const two = shuffled(active).slice(0, 2).map((p) => p.id);
    room.pair = two.length === 2 ? two : null;
    room.wildcard = null;
    room.traitorId = null;
  } else {
    room.pair = null;
    // Chaos mode (or a 1-in-5 roll) can flip a wildcard rule.
    const roll = room.mode === 'chaos' ? Math.random() < 0.4 : Math.random() < 0.12;
    const wilds = wildcardList(room.lang);
    room.wildcard = roll ? wilds[Math.floor(Math.random() * wilds.length)] : null;
    // The Traitor: one random player is secretly told to vote against the crowd.
    room.traitorId = active.length >= 3 ? active[Math.floor(Math.random() * active.length)].id : null;
  }
  room.phase = 'prompt';
  room.lastReveal = null;
}

export function traitorId(room) {
  return room.traitorId || null;
}

export function submit(room, playerId, voteFor, predict) {
  if (room.mode === 'duel') {
    const pair = room.pair || [];
    if (!pair.includes(voteFor)) voteFor = pair[0];
    room.submissions.set(playerId, { voteFor, predict: voteFor });
    return;
  }
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
  const n = connectedCount(room);
  const fit = challengeEntries(room.lang).filter((c) => c.min <= n); // ones that make sense for this group size
  const fresh = fit.filter((c) => !room.usedChallenges.has(c.i));
  const from = fresh.length ? fresh : fit;
  const pick = from[Math.floor(Math.random() * from.length)];
  room.usedChallenges.add(pick.i); // track by index — language-neutral
  if (room.usedChallenges.size >= fit.length) room.usedChallenges.clear();
  return pick.text;
}

// Duel: two players face off, the room votes who's more likely, that player drinks.
function revealDuel(room) {
  const players = activePlayers(room);
  const [a, b] = room.pair || [];
  let va = 0, vb = 0;
  for (const { voteFor } of room.submissions.values()) {
    if (voteFor === a) va += 1; else if (voteFor === b) vb += 1;
  }
  const tie = va === vb;
  const targetId = vb > va ? b : a;
  const drinkers = tie ? [a, b] : [targetId];
  for (const id of drinkers) { const p = room.players.get(id); if (p) { p.timesInHotSeat += 1; p.sips += 1; } }
  const challenge = drawChallenge(room);
  room.phase = 'reveal';
  room.lastReveal = {
    duel: true,
    prompt: room.prompt,
    round: room.round,
    pair: [
      { name: room.players.get(a)?.name, votes: va },
      { name: room.players.get(b)?.name, votes: vb },
    ],
    tie,
    targetId,
    targetName: room.players.get(targetId)?.name,
    drinkers: drinkers.map((id) => room.players.get(id)?.name),
    challenge,
    results: players.map((p) => ({ id: p.id, name: p.name, sips: drinkers.includes(p.id) ? 1 : 0 })),
  };
  return room.lastReveal;
}

// Tally votes, decide the hot seat, assign penalties, update running stats.
export function reveal(room) {
  if (room.mode === 'duel') return revealDuel(room);
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
  const duel = room.mode === 'duel'; // no predictions or traitor in duel
  const A = awardStrings(room.lang);
  return {
    rounds: room.round,
    duel,
    awards: [
      { title: A.mostRoasted.title, emoji: '🔥', winners: award('timesInHotSeat'), stat: A.mostRoasted.stat },
      ...(duel ? [] : [
        { title: A.mindReader.title, emoji: '🔮', winners: award('correctPredictions'), stat: A.mindReader.stat },
        { title: A.traitor.title, emoji: '😈', winners: award('traitorWins'), stat: A.traitor.stat },
      ]),
      { title: A.tank.title, emoji: '🍺', winners: award('sips'), stat: A.tank.stat },
    ],
    scoreboard: players
      .map((p) => ({ name: p.name, reads: p.correctPredictions, hotseat: p.timesInHotSeat, sips: p.sips }))
      .sort((a, b) => (duel ? b.hotseat - a.hotseat : b.reads - a.reads)),
  };
}

// Public snapshot sent to every client. Never leaks individual votes.
export function snapshot(room) {
  return {
    code: room.code,
    mode: room.mode,
    lang: room.lang,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    needsConsent: CONSENT_MODES.includes(room.mode),
    maxPlayers: room.maxPlayers,
    totalRounds: room.totalRounds,
    packs: packCatalog(room),
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, connected: p.connected, consented: p.consented, tokens: p.tokens,
      topic: p.topic, addedPrompt: !!p.customPrompt,
    })),
    prompt: room.phase === 'prompt' ? room.prompt : null,
    wildcard: room.phase === 'prompt' ? room.wildcard : null,
    duel: room.mode === 'duel',
    pair: (room.phase === 'prompt' && room.pair)
      ? room.pair.map((id) => ({ id, name: room.players.get(id)?.name }))
      : null,
    submittedIds: room.phase === 'prompt' ? [...room.submissions.keys()] : [],
    reveal: room.phase === 'reveal' ? room.lastReveal : null,
  };
}

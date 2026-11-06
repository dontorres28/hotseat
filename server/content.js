// Content aggregator. Each language lives in content/<lang>.js (index-aligned
// arrays); here we resolve by the room's language and keep language-neutral
// metadata (challenge min-players, pack ids/emojis, wildcard ids).
import EN from './content/en.js';
import DE from './content/de.js';

export const MODES = ['chill', 'roast', 'spicy', 'chaos', 'duel'];
export const CONSENT_MODES = ['spicy', 'chaos'];
export const LANGS = ['en', 'de']; // es, fr, it coming next
const LANG_MAP = { en: EN, de: DE };
export function isLang(l) { return LANGS.includes(l); }
function L(l) { return LANG_MAP[l] || EN; }

// Crowd heuristic from the canonical English text; applies to every language by index.
const CROWD_RE = /\b(everyone|anyone who|the room|the group|waterfall|social|nose goes|go around|first to blank|youngest|oldest|tallest|house rule|bartender|two people|pick two)\b/i;
export function challengeMinPlayers(text) { return CROWD_RE.test(text) ? 3 : 2; }
const CHALLENGE_MIN = EN.challenges.map(challengeMinPlayers);
const DARE_MIN = EN.dares.map(challengeMinPlayers);

// Back-compat for tests: the English arrays.
export const CHALLENGES = EN.challenges;
export const DARES = EN.dares;

// Language-neutral pack + wildcard metadata.
const PACK_META = [
  { id: 'college', emoji: '🎓' },
  { id: 'work', emoji: '💼' },
  { id: 'couples', emoji: '💘' },
  { id: 'besties', emoji: '👯' },
  { id: 'travel', emoji: '✈️' },
  { id: 'throwback', emoji: '📼' },
  { id: 'deep', emoji: '🧠' },
];
const WILDCARD_IDS = ['minority', 'double', 'reverse'];

export function packExists(id) { return PACK_META.some((p) => p.id === id); }

export function promptsForMode(mode, lang) {
  const p = L(lang).prompts;
  if (mode === 'chaos') return [...p.chill, ...p.roast, ...p.spicy];
  if (mode === 'duel') return [...p.chill, ...p.roast];
  return p[mode] ?? p.chill;
}

export function packPrompts(id, lang) {
  return L(lang).packs[id]?.prompts ?? [];
}

export function packCatalog(enabled, lang) {
  const packs = L(lang).packs;
  return PACK_META.map((m) => ({
    id: m.id, emoji: m.emoji,
    name: packs[m.id]?.name ?? m.id,
    blurb: packs[m.id]?.blurb ?? '',
    enabled: enabled.has(m.id),
  }));
}

export function wildcardList(lang) {
  return L(lang).wildcards.map((label, i) => ({ id: WILDCARD_IDS[i], label }));
}

export function challengeEntries(lang) {
  return L(lang).challenges.map((text, i) => ({ i, text, min: CHALLENGE_MIN[i] }));
}

export function dareEntries(lang) {
  return L(lang).dares.map((text, i) => ({ text, min: DARE_MIN[i] }));
}

export function awards(lang) { return L(lang).awards; }

export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

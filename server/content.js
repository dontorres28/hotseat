// Content aggregator. Each language lives in content/<lang>.js (index-aligned
// arrays); here we resolve by the room's language and keep language-neutral
// metadata (challenge min-players, pack ids/emojis, wildcard ids).
import EN from './content/en.js';
import DE from './content/de.js';
import ES from './content/es.js';
import FR from './content/fr.js';
import IT from './content/it.js';

export const MODES = ['chill', 'roast', 'spicy', 'chaos', 'duel'];
export const CONSENT_MODES = ['spicy', 'chaos'];
export const LANGS = ['en', 'de', 'es', 'fr', 'it'];
const LANG_MAP = { en: EN, de: DE, es: ES, fr: FR, it: IT };
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

export function duoEntries(lang) {
  return (L(lang).duos || EN.duos).map((text, i) => ({ i, text }));
}

export function awards(lang) { return L(lang).awards; }

export function topicsList(lang) { return L(lang).topics || EN.topics; }

// Guardrails for player-written questions. ponytail: a plain word-boundary
// blocklist — swap for a moderation API only if real abuse shows up. Covers
// slurs + explicit terms across the five languages we ship.
const BANNED = [
  // slurs (en + common cross-language)
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'kike',
  'spic', 'chink', 'coon', 'wetback', 'dyke', 'negro', 'neger', 'schwuchtel',
  'maricon', 'maricón', 'pédé', 'pede', 'frocio', 'ricchione',
  // explicit sexual / violence
  'rape', 'rapist', 'molest', 'pedo', 'pedophile', 'incest', 'bestiality',
  'porn', 'blowjob', 'cum', 'jizz', 'coño', 'violación', 'violacion', 'stupro',
  // hard profanity
  'fuck', 'motherfucker', 'cunt', 'cock', 'pussy', 'whore', 'slut',
  'fick', 'hure', 'fotze', 'puta', 'mierda', 'putain', 'merde', 'cazzo', 'stronzo',
];
const BANNED_RE = new RegExp('\\b(' + BANNED.join('|') + ')\\b', 'i');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Returns { text } if clean, or { error } naming why. playerNames blocks
// questions that single out one person.
export function validatePrompt(text, playerNames = []) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 6) return { error: 'tooShort' };
  if (t.length > 120) return { error: 'tooLong' };
  if (BANNED_RE.test(t)) return { error: 'offensive' };
  const names = playerNames.map((n) => String(n).trim()).filter((n) => n.length >= 2);
  if (names.length) {
    const nameRe = new RegExp('\\b(' + names.map(escapeRe).join('|') + ')\\b', 'i');
    if (nameRe.test(t)) return { error: 'targeting' };
  }
  return { text: t };
}

export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

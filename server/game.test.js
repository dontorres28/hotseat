// Run: node game.test.js  — plain asserts, no framework.
import assert from 'node:assert';
import * as game from './game.js';
import { CHALLENGES, challengeMinPlayers } from './content.js';
import EN from './content/en.js';
import DE from './content/de.js';
import ES from './content/es.js';
import FR from './content/fr.js';
import IT from './content/it.js';

// Every translation file must stay index-aligned with English, and a translated room must resolve.
for (const [lang, T] of [['de', DE], ['es', ES], ['fr', FR], ['it', IT]]) {
  assert.equal(EN.challenges.length, T.challenges.length, `${lang} challenge counts aligned`);
  assert.equal(EN.dares.length, T.dares.length, `${lang} dare counts aligned`);
  assert.equal(EN.topics.length, T.topics.length, `${lang} topic counts aligned`);
  assert.equal(EN.wildcards.length, T.wildcards.length, `${lang} wildcard counts aligned`);
  for (const m of ['chill', 'roast', 'spicy']) {
    assert.equal(EN.prompts[m].length, T.prompts[m].length, `${lang} prompt count aligned: ${m}`);
  }
  for (const id of Object.keys(EN.packs)) {
    assert.ok(T.packs[id], `${lang} has pack ${id}`);
    assert.equal(EN.packs[id].prompts.length, T.packs[id].prompts.length, `${lang} pack prompts aligned: ${id}`);
  }
  const r = game.createRoom('chill', lang);
  game.buildDeck(r);
  assert.ok(r.deck.length > 0 && r.deck[0] !== EN.prompts.chill[0], `${lang} room resolves translated prompts`);
}

// Challenge fit: crowd challenges need 3+, and a 2-player game never draws one.
{
  assert.equal(challengeMinPlayers('Waterfall: everyone drinks.'), 3, 'crowd challenge needs 3+');
  assert.equal(challengeMinPlayers('Take a sip.'), 2, 'simple challenge works with 2');
  const r = game.createRoom('duel');
  const a = game.addPlayer(r, 'A', { host: true });
  const b = game.addPlayer(r, 'B');
  // Many draws in a 2-player room: nothing may reference 3+ people.
  for (let i = 0; i < 80; i++) {
    game.dealPrompt(r); r.pair = [a.id, b.id];
    game.submit(r, a.id, a.id); game.submit(r, b.id, a.id);
    const rev = game.reveal(r);
    assert.ok(challengeMinPlayers(rev.challenge) <= 2, `2-player challenge must fit 2, got: ${rev.challenge}`);
    assert.ok(challengeMinPlayers(game.randomDare(r)) <= 2, `2-player dare must fit 2`);
  }
}

// Challenge deck: 100+, no duplicates.
{
  assert.ok(CHALLENGES.length >= 100, `expected 100+ challenges, got ${CHALLENGES.length}`);
  assert.equal(new Set(CHALLENGES).size, CHALLENGES.length, 'challenges must be unique');
}

function room4(mode = 'chill') {
  const r = game.createRoom(mode);
  const a = game.addPlayer(r, 'Ana', { host: true });
  const b = game.addPlayer(r, 'Ben');
  const c = game.addPlayer(r, 'Cy');
  const d = game.addPlayer(r, 'Dee');
  return { r, a, b, c, d };
}

// Majority target + prediction penalties.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r);
  r.wildcard = null; r.traitorId = null; // force a plain round
  // Everyone votes Ben -> Ben is the hot seat.
  game.submit(r, a.id, b.id, b.id); // read right
  game.submit(r, b.id, c.id, b.id); // can't self-vote, predicts Ben (right)
  game.submit(r, c.id, b.id, a.id); // read wrong
  game.submit(r, d.id, b.id, b.id); // read right
  assert.ok(game.everyoneSubmitted(r));
  const rev = game.reveal(r);
  assert.equal(rev.targetName, 'Ben', 'Ben should be in the hot seat');
  const cy = rev.results.find((x) => x.name === 'Cy');
  assert.equal(cy.sips, 1, 'wrong prediction drinks');
  const ana = rev.results.find((x) => x.name === 'Ana');
  assert.equal(ana.sips, 0, 'right prediction is safe');
  assert.equal(b.timesInHotSeat, 1);
}

// MINORITY wildcard flips the target to least-picked.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r);
  r.wildcard = { id: 'minority', label: 'x' }; r.traitorId = null;
  // Ana 2, Ben 1, Cy 1, Dee 0 -> Dee is uniquely least-picked -> hot seat.
  game.submit(r, a.id, b.id, d.id); // votes Ben, predicts Dee
  game.submit(r, b.id, c.id, b.id); // votes Cy
  game.submit(r, c.id, a.id, b.id); // votes Ana
  game.submit(r, d.id, a.id, d.id); // votes Ana
  const rev = game.reveal(r);
  assert.equal(rev.targetName, 'Dee', 'minority target is least-picked');
  assert.ok(rev.results.find((x) => x.name === 'Ana').readRight, 'Ana predicted Dee');
}

// REVERSE wildcard: the right readers drink instead.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r);
  r.wildcard = { id: 'reverse', label: 'x' }; r.traitorId = null;
  game.submit(r, a.id, b.id, b.id); // right read -> drinks under reverse
  game.submit(r, c.id, b.id, a.id); // wrong read -> safe under reverse
  game.submit(r, d.id, b.id, b.id);
  game.submit(r, b.id, c.id, b.id);
  const rev = game.reveal(r);
  assert.equal(rev.targetName, 'Ben');
  assert.equal(rev.results.find((x) => x.name === 'Ana').sips, 1, 'reverse: right read drinks');
  assert.equal(rev.results.find((x) => x.name === 'Cy').sips, 0, 'reverse: wrong read safe');
}

// Recap awards pick the leader(s).
{
  const { r, a } = room4();
  a.timesInHotSeat = 3; a.correctPredictions = 1; a.sips = 5;
  const rc = game.recap(r);
  assert.deepEqual(rc.awards.find((x) => x.title === 'Most Roasted').winners, ['Ana']);
  assert.deepEqual(rc.awards.find((x) => x.title === 'The Tank').winners, ['Ana']);
}

// Traitor pulls it off by voting against the crowd.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r); r.wildcard = null; r.traitorId = c.id;
  game.submit(r, a.id, b.id, b.id);
  game.submit(r, b.id, c.id, b.id);
  game.submit(r, c.id, d.id, b.id); // traitor votes Dee, not the hot seat Ben
  game.submit(r, d.id, b.id, b.id);
  const rev = game.reveal(r);
  assert.equal(rev.targetName, 'Ben');
  assert.equal(rev.traitor.name, 'Cy');
  assert.ok(rev.traitor.won, 'traitor voted against the crowd');
  assert.equal(rev.results.find((x) => x.name === 'Cy').sips, 0, 'winning traitor is safe');
  assert.equal(c.traitorWins, 1);
  assert.ok(c.tokens >= 1, 'a traitor win grants a token');
}

// Traitor who votes with the crowd fails and drinks.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r); r.wildcard = null; r.traitorId = c.id;
  game.submit(r, a.id, b.id, b.id);
  game.submit(r, b.id, c.id, b.id);
  game.submit(r, c.id, b.id, b.id); // traitor votes the hot seat -> fail
  game.submit(r, d.id, b.id, b.id);
  const rev = game.reveal(r);
  assert.ok(!rev.traitor.won);
  assert.equal(rev.results.find((x) => x.name === 'Cy').sips, 1, 'failed traitor drinks');
}

// Revenge token: most-picked earns one and can spend it exactly once.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r); r.wildcard = null; r.traitorId = null;
  game.submit(r, a.id, b.id, b.id);
  game.submit(r, c.id, b.id, b.id);
  game.submit(r, d.id, b.id, b.id); // Ben is clearly most-picked
  const rev = game.reveal(r);
  assert.equal(rev.revengeTo, 'Ben');
  assert.ok(b.tokens >= 1, 'most-picked earns a token');
  const payload = game.spendToken(r, b.id, a.id);
  assert.ok(payload && payload.toName === 'Ana' && payload.challenge, 'spend hands a challenge');
  assert.equal(b.tokens, 0, 'token consumed');
  assert.equal(game.spendToken(r, b.id, a.id), null, 'no tokens left to spend');
}

// Exposed Card lists who voted for whom when it fires.
{
  const { r, a, b, c, d } = room4();
  r.round = 5; r.exposedUsed = false;
  game.dealPrompt(r); r.traitorId = null;
  game.submit(r, a.id, b.id, b.id);
  game.submit(r, b.id, c.id, c.id);
  game.submit(r, c.id, b.id, b.id);
  game.submit(r, d.id, b.id, b.id);
  const orig = Math.random; Math.random = () => 0; // force the exposed roll
  const rev = game.reveal(r);
  Math.random = orig;
  assert.ok(Array.isArray(rev.exposed) && rev.exposed.length === 4, 'exposed lists every voter');
  assert.ok(rev.exposed.every((e) => e.voter && e.target), 'exposed maps voter -> target by name');
}

// Snapshot never leaks who voted for whom.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r);
  game.submit(r, a.id, b.id, b.id);
  const snap = game.snapshot(r);
  assert.ok(!JSON.stringify(snap).includes('voteFor'), 'no raw votes in snapshot');
  assert.deepEqual(snap.submittedIds, [a.id], 'only submitted ids, not their choices');
}

// Prompt packs: free toggles that feed the deck.
{
  const r = game.createRoom('chill');
  assert.equal(game.togglePack(r, 'nope'), false, 'unknown pack is rejected');
  game.buildDeck(r);
  const base = r.deck.length;
  assert.ok(game.togglePack(r, 'college'), 'enable a pack');
  game.buildDeck(r);
  assert.ok(r.deck.length > base, 'enabled pack adds prompts');
  assert.ok(game.togglePack(r, 'college'), 'toggle it back off');
  game.buildDeck(r);
  assert.equal(r.deck.length, base, 'disabled pack drops back out of the deck');
  const cat = game.packCatalog(r).find((p) => p.id === 'college');
  assert.ok(cat && !cat.enabled && cat.name && cat.price === undefined, 'catalog is enable-only, no price');
}

// Minimum players to start is 2.
{
  const r = game.createRoom('chill');
  game.addPlayer(r, 'A');
  assert.equal(game.enoughPlayers(r), false, '1 player is not enough');
  game.addPlayer(r, 'B');
  assert.equal(game.enoughPlayers(r), true, '2 players can start');
}

// Host-set max: clamped to [max(2, present), 20], and it fills up.
{
  const r = game.createRoom('chill');
  game.addPlayer(r, 'A'); game.addPlayer(r, 'B'); game.addPlayer(r, 'C');
  assert.equal(game.setMax(r, 2), 3, "can't set max below who's present");
  assert.equal(game.setMax(r, 99), 20, 'capped at 20');
  assert.equal(game.setMax(r, 5), 5, 'set to 5');
  assert.equal(game.roomFull(r), false, '3 of 5 is not full');
  game.addPlayer(r, 'D'); game.addPlayer(r, 'E');
  assert.equal(game.roomFull(r), true, '5 of 5 is full');
}

// Host-chosen round count clamps to [3, 20].
{
  const r = game.createRoom('chill');
  assert.equal(r.totalRounds, 10, 'default 10 rounds');
  assert.equal(game.setRounds(r, 1), 3, 'floor at 3');
  assert.equal(game.setRounds(r, 99), 20, 'cap at 20');
  assert.equal(game.setRounds(r, 7), 7, 'set to 7');
}

// Duel caps at 4 automatically.
{
  const r = game.createRoom('duel');
  assert.equal(r.maxPlayers, 4, 'duel room defaults to max 4');
  assert.equal(game.setMax(r, 20), 4, 'duel max cannot exceed 4');
}

// Duel mode: two face off, the more-voted one drinks; non-pair voters are safe.
{
  const { r, a, b, c, d } = room4('duel');
  game.dealPrompt(r);
  r.pair = [a.id, b.id]; // force the matchup
  game.submit(r, a.id, a.id);
  game.submit(r, b.id, a.id);
  game.submit(r, c.id, a.id);
  game.submit(r, d.id, b.id); // Ana 3, Ben 1
  const rev = game.reveal(r);
  assert.equal(rev.duel, true);
  assert.equal(rev.targetName, 'Ana', 'more-voted of the pair is called out');
  assert.equal(rev.results.find((x) => x.name === 'Ana').sips, 1, 'called-out drinks');
  assert.equal(rev.results.find((x) => x.name === 'Cy').sips, 0, 'non-pair voters are safe');
  // Tie -> both drink.
  game.dealPrompt(r); r.pair = [a.id, b.id];
  game.submit(r, a.id, a.id); game.submit(r, b.id, b.id);
  game.submit(r, c.id, a.id); game.submit(r, d.id, b.id); // 2-2
  const rev2 = game.reveal(r);
  assert.ok(rev2.tie && rev2.drinkers.length === 2, 'a tie makes both drink');
}

// Custom lobby questions: validate guardrails and fold into the deck.
{
  const r = game.createRoom('chill', 'en');
  const ana = game.addPlayer(r, 'Ana', { host: true });
  const ben = game.addPlayer(r, 'Ben');
  assert.ok(ana.topic, 'players get a seeded topic');

  // Clean question is accepted.
  assert.ok(game.setCustomPrompt(r, ana.id, "Who's most likely to move abroad?").ok, 'clean prompt accepted');
  assert.equal(ben.customPrompt, null, "a player's prompt is their own");

  // Offensive word rejected.
  assert.equal(game.setCustomPrompt(r, ben.id, 'Who is the biggest fuck up here?').error, 'offensive', 'offensive rejected');
  // Naming a player rejected.
  assert.equal(game.setCustomPrompt(r, ben.id, 'Who would date Ana first?').error, 'targeting', 'targeting a player rejected');
  // Too short rejected.
  assert.equal(game.setCustomPrompt(r, ben.id, 'who?').error, 'tooShort', 'too short rejected');

  // Accepted customs land in the built deck.
  game.buildDeck(r);
  assert.ok(r.deck.includes("Who's most likely to move abroad?"), 'custom prompt is in the deck');
  assert.ok(!r.deck.some((p) => /fuck/i.test(p)), 'rejected prompt never reaches the deck');

  // Can't add once the game has started.
  game.dealPrompt(r);
  assert.equal(game.setCustomPrompt(r, ana.id, 'Who would win a staring contest?').error, 'closed', 'closed after start');
}

console.log('ok — all game checks passed');

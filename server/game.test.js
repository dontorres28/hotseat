// Run: node game.test.js  — plain asserts, no framework.
import assert from 'node:assert';
import * as game from './game.js';

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
  r.wildcard = null; // force plain round
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
  r.wildcard = { id: 'minority', label: 'x' };
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
  r.wildcard = { id: 'reverse', label: 'x' };
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

// Prompt packs: locked until unlocked; unlocked+enabled packs feed the deck.
{
  const r = game.createRoom('chill');
  assert.equal(game.unlockPack(r, 'nope'), false, 'unknown pack is rejected');
  assert.equal(game.togglePack(r, 'college'), false, 'cannot toggle a locked pack');
  game.buildDeck(r);
  const base = r.deck.length;
  assert.ok(game.unlockPack(r, 'college'), 'known pack unlocks');
  game.buildDeck(r);
  assert.ok(r.deck.length > base, 'unlocked+enabled pack adds prompts');
  assert.ok(game.togglePack(r, 'college'), 'unlocked pack toggles off');
  game.buildDeck(r);
  assert.equal(r.deck.length, base, 'disabled pack drops back out of the deck');
  const cat = game.packCatalog(r).find((p) => p.id === 'college');
  assert.ok(cat.unlocked && !cat.enabled, 'catalog reflects unlocked-but-off');
}

console.log('ok — all game checks passed');

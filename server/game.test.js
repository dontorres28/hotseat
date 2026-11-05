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
  // 3 votes on Ben, nobody on Dee -> Dee (least) is the hot seat.
  game.submit(r, a.id, b.id, d.id);
  game.submit(r, c.id, b.id, b.id);
  game.submit(r, d.id, b.id, d.id);
  game.submit(r, b.id, c.id, a.id);
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

// Snapshot never leaks who voted for whom.
{
  const { r, a, b, c, d } = room4();
  game.dealPrompt(r);
  game.submit(r, a.id, b.id, b.id);
  const snap = game.snapshot(r);
  assert.ok(!JSON.stringify(snap).includes('voteFor'), 'no raw votes in snapshot');
  assert.deepEqual(snap.submittedIds, [a.id], 'only submitted ids, not their choices');
}

console.log('ok — all game checks passed');

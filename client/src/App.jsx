import { useEffect, useRef, useState } from 'react';
import { socket } from './socket.js';

const MODES = [
  { id: 'chill', name: 'Chill', emoji: '😎', blurb: 'Clean and silly.' },
  { id: 'roast', name: 'Roast', emoji: '🔥', blurb: 'Savage but friendly.' },
  { id: 'spicy', name: 'Spicy', emoji: '🌶️', blurb: 'After dark. Opt-in.' },
  { id: 'chaos', name: 'Chaos', emoji: '🎲', blurb: 'Mixed + wildcards.' },
  { id: 'duel', name: 'Duel', emoji: '⚔️', blurb: 'Face-off. 2 to 4.' },
];

const LS = 'hotseat.session';

export default function App() {
  const [me, setMe] = useState(null);
  const [code, setCode] = useState(null);
  const [state, setState] = useState(null);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState(null); // 'traitor' | 'crew' | null
  const [toast, setToast] = useState(null);

  useEffect(() => {
    socket.on('joined', ({ code, playerId }) => {
      setMe(playerId); setCode(code); setRecap(null);
      localStorage.setItem(LS, JSON.stringify({ code, playerId }));
    });
    socket.on('state', (s) => {
      setState(s);
      if (s.phase !== 'recap') setRecap(null);
      if (s.phase !== 'prompt') setSecret(null); // secret role only lives during a round
    });
    socket.on('recap', (r) => setRecap(r));
    socket.on('secret', ({ role }) => setSecret(role));
    socket.on('revenge', (r) => { setToast(r); setTimeout(() => setToast(null), 4500); });
    // Try to resume a refreshed session.
    const resume = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(LS) || 'null');
        if (saved) socket.emit('resume', saved, (res) => { if (!res?.ok) localStorage.removeItem(LS); });
      } catch { /* ignore */ }
    };
    socket.on('connect', resume);
    if (socket.connected) resume();
    return () => socket.off();
  }, []);

  const leave = () => {
    socket.emit('leaveRoom');
    localStorage.removeItem(LS);
    setMe(null); setCode(null); setState(null); setRecap(null); setSecret(null);
  };

  if (!state || !me) return <Home setError={setError} error={error} />;

  const isHost = state.hostId === me;
  let screen;
  if (recap) screen = <Recap recap={recap} leave={leave} isHost={isHost} />;
  else if (state.phase === 'lobby') screen = <Lobby state={state} me={me} isHost={isHost} leave={leave} />;
  else if (state.phase === 'prompt') screen = state.duel
    ? <DuelRound state={state} me={me} isHost={isHost} />
    : <Round state={state} me={me} isHost={isHost} secret={secret} />;
  else if (state.phase === 'reveal') screen = state.reveal?.duel
    ? <DuelReveal state={state} me={me} isHost={isHost} />
    : <Reveal state={state} me={me} isHost={isHost} />;
  else screen = <Wordmark sub="loading…" />;

  const inGame = !recap && (state.phase === 'prompt' || state.phase === 'reveal');
  return <>{screen}{toast && <Toast t={toast} />}{inGame && <button className="leave-float" onClick={leave}>Leave</button>}</>;
}

// Shown when you're told to drink — swap the sip for a non-drinking dare.
function DareSwap() {
  const [dare, setDare] = useState(null);
  if (dare) return <p className="dare">🎯 Dare instead: {dare}</p>;
  return (
    <button className="swap-btn" onClick={() => socket.emit('swapDare', {}, (d) => setDare(d))}>
      Not drinking? Swap for a dare
    </button>
  );
}

function Toast({ t }) {
  return (
    <div className="toast">
      <strong>🎟️ {t.fromName} spent a revenge token on {t.toName}</strong>
      <span>{t.challenge}</span>
    </div>
  );
}

function Wordmark({ sub }) {
  return (
    <div className="screen center">
      <Logo />
      {sub && <p className="muted">{sub}</p>}
    </div>
  );
}

function Logo({ small }) {
  return <img className={small ? 'logo logo-sm' : 'logo'} src="/logo.webp" alt="HOT SEAT" />;
}

function Home({ setError, error }) {
  const invited = new URLSearchParams(window.location.search).get('c');
  const [tab, setTab] = useState(invited ? 'join' : 'start'); // start | join
  const [name, setName] = useState('');
  const [mode, setMode] = useState('chill');
  const [joinCode, setJoinCode] = useState((invited || '').toUpperCase().slice(0, 4));

  const create = () => {
    if (!name.trim()) return setError('Enter your name first.');
    socket.emit('createRoom', { name, mode }, (res) => { if (!res?.ok) setError(res?.error || 'Something broke.'); });
  };
  const join = () => {
    if (!name.trim()) return setError('Enter your name first.');
    if (joinCode.trim().length < 4) return setError('Room codes are 4 letters.');
    socket.emit('joinRoom', { code: joinCode, name }, (res) => { if (!res?.ok) setError(res?.error || 'Could not join.'); });
  };

  return (
    <div className="screen">
      <div className="center" style={{ marginTop: 24 }}><Logo /></div>
      <p className="tagline">Don't answer. Predict your friends.</p>

      <div className="seg" data-active={tab}>
        <span className="seg-ind" aria-hidden="true" />
        <button className="seg-btn" onClick={() => setTab('start')}>Start a room</button>
        <button className="seg-btn" onClick={() => setTab('join')}>Join</button>
      </div>

      <input className="field" placeholder="Your name" maxLength={20} value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }} />

      <div key={tab} className="tab-body">
        {tab === 'start' ? (
          <>
            <div className="modes">
              {MODES.map((m, i) => (
                <button key={m.id} style={{ '--i': i }} className={mode === m.id ? 'mode on' : 'mode'} onClick={() => setMode(m.id)}>
                  <span className="mode-txt"><strong>{m.emoji} {m.name}</strong><span>{m.blurb}</span></span>
                  <span className="mode-check" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button className="btn primary" onClick={create}>Create room</button>
          </>
        ) : (
          <>
            <input className="field code-in" placeholder="CODE" maxLength={4} value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }} />
            <button className="btn primary" onClick={join}>Join room</button>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      <p className="fine">18+. Know your limit. There's always a non-drinking challenge, never required to drink.</p>
    </div>
  );
}

function Lobby({ state, me, isHost, leave }) {
  const [copied, setCopied] = useState(false);
  const you = state.players.find((p) => p.id === me);
  const needMyConsent = state.needsConsent && you && !you.consented;
  const waiting = state.players.filter((p) => p.connected && !p.consented).length;
  const connected = state.players.filter((p) => p.connected).length;
  const enough = connected >= 2;
  const max = state.maxPlayers ?? 20;

  const share = async () => {
    const url = `${window.location.origin}/?c=${state.code}`;
    const data = { title: 'HOT SEAT', text: `Join my HOT SEAT room, code ${state.code}`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* user dismissed share sheet */ }
  };

  return (
    <div className="screen">
      <TopBar leave={leave} />
      <div className="center">
        <p className="muted">Room code</p>
        <button className="bigcode" onClick={share}>{state.code}</button>
        <p className="muted share-hint">{copied ? '✅ Invite link copied' : `${state.mode.toUpperCase()} mode, tap to share`}</p>
      </div>

      <div className="players">
        {state.players.map((p, i) => (
          <div key={p.id} style={{ '--i': i }} className={'chip' + (p.connected ? '' : ' off')}>
            {p.name}{p.id === state.hostId ? ' 👑' : ''}{state.needsConsent && p.consented ? ' ✅' : ''}
          </div>
        ))}
      </div>

      <div className="maxrow">
        <span className="muted">{connected} / {max} players</span>
        {isHost && (
          <div className="stepper">
            <button onClick={() => socket.emit('setMax', { max: max - 1 })} disabled={max <= Math.max(2, connected)}>−</button>
            <span>max {max}</span>
            <button onClick={() => socket.emit('setMax', { max: max + 1 })} disabled={max >= 20}>+</button>
          </div>
        )}
      </div>

      <Packs packs={state.packs || []} isHost={isHost} />

      {needMyConsent && (
        <button className="btn primary" onClick={() => socket.emit('consent')}>This gets spicy, I'm in 🌶️</button>
      )}

      {isHost ? (
        <button className="btn primary" disabled={!enough || waiting > 0}
          onClick={() => socket.emit('start')}>
          {!enough ? 'Need 2+ players' : waiting > 0 ? `Waiting on ${waiting} to opt in` : 'Start game'}
        </button>
      ) : (
        <p className="muted center">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function Packs({ packs, isHost }) {
  const [open, setOpen] = useState(false);
  const enabled = packs.filter((p) => p.enabled);
  if (!isHost) {
    return enabled.length ? (
      <div className="packs-ro">
        <span className="muted">Packs:</span>
        {enabled.map((p) => <span key={p.id} className="chip">{p.emoji} {p.name}</span>)}
      </div>
    ) : null;
  }
  return (
    <div className="packs">
      <button className="packs-toggle" onClick={() => setOpen((o) => !o)}>
        <span>🎒 Prompt packs{enabled.length ? ` · ${enabled.length} on` : ''}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && packs.map((p, i) => (
        <div key={p.id} style={{ '--i': i }} className={'pack-row' + (p.enabled ? ' on' : '')}>
          <div className="pack-meta">
            <strong>{p.emoji} {p.name}</strong>
            <span className="muted">{p.blurb}</span>
          </div>
          {p.unlocked ? (
            <button className={'pack-btn' + (p.enabled ? ' on' : '')} onClick={() => socket.emit('togglePack', { packId: p.id })}>
              {p.enabled ? 'On' : 'Off'}
            </button>
          ) : (
            <button className="pack-btn buy" onClick={() => socket.emit('unlockPack', { packId: p.id })}>
              Unlock ${p.price}
            </button>
          )}
        </div>
      ))}
      {open && <p className="fine">Demo unlock, no real charge yet. Payments slot in here.</p>}
    </div>
  );
}

function DuelRound({ state, me, isHost }) {
  const submitted = state.submittedIds.includes(me);
  const pair = state.pair || [];
  const players = state.players.filter((p) => p.connected);
  const done = state.submittedIds.length;

  if (submitted) {
    return (
      <div className="screen center">
        <Logo small />
        <p className="locked">Locked in 🔒</p>
        <p className="muted">{done} / {players.length} voted</p>
        {isHost && done < players.length && (
          <button className="btn ghost" onClick={() => socket.emit('revealNow')}>Skip stragglers → reveal</button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="round-head"><span className="round-n">Round {state.round}</span><span className="wild">⚔️ DUEL</span></div>
      <h2 className="prompt">{state.prompt}</h2>
      <p className="label">Tap who's more likely:</p>
      <div className="duel">
        {pair.map((p) => (
          <button key={p.id} className="duel-pick" onClick={() => socket.emit('submit', { voteFor: p.id, predict: p.id })}>
            {p.name}{p.id === me ? ' (you)' : ''}
          </button>
        ))}
      </div>
      <p className="muted center">{done} / {players.length} voted</p>
    </div>
  );
}

function DuelReveal({ state, me, isHost }) {
  const r = state.reveal;
  const youDrink = (r.results.find((x) => x.id === me)?.sips || 0) > 0;
  const maxVotes = Math.max(1, ...r.pair.map((p) => p.votes));

  return (
    <div className="screen">
      <div className="round-head"><span className="round-n">Round {r.round}</span><span className="wild">⚔️ DUEL</span></div>
      <p className="prompt sm">{r.prompt}</p>

      <div className="hotseat-card">
        <p className="muted">{r.tie ? "It's a tie" : 'More likely'}</p>
        <div className="hotseat-name">{(r.tie ? r.drinkers.join(' & ') : r.targetName)} 🔥</div>
      </div>

      <div className="bars">
        {r.pair.map((p, i) => (
          <div key={i} className="bar-row">
            <span className="bar-name">{p.name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ '--w': p.votes / maxVotes, '--i': i }} /></div>
            <span className="bar-votes">{p.votes}</span>
          </div>
        ))}
      </div>

      <div className={'verdict ' + (youDrink ? 'drink' : 'safe')}>
        {youDrink ? (<><strong>You got picked.</strong><p>{r.challenge}</p></>) : (<><strong>Safe.</strong><p>Not you this time.</p></>)}
        {youDrink && <DareSwap />}
      </div>

      {isHost ? (
        <div className="row">
          <button className="btn ghost" onClick={() => socket.emit('end')}>End game</button>
          <button className="btn primary" onClick={() => socket.emit('next')}>Next round →</button>
        </div>
      ) : (
        <p className="muted center">Waiting for the host…</p>
      )}
    </div>
  );
}

function Round({ state, me, isHost, secret }) {
  const [vote, setVote] = useState(null);
  const [predict, setPredict] = useState(null);
  const submitted = state.submittedIds.includes(me);
  const players = state.players.filter((p) => p.connected);
  const total = players.length;
  const done = state.submittedIds.length;

  const send = () => { if (vote && predict) socket.emit('submit', { voteFor: vote, predict }); };

  if (submitted) {
    return (
      <div className="screen center">
        <Logo small />
        <p className="locked">Locked in 🔒</p>
        <p className="muted">{done} / {total} answered</p>
        {isHost && done < total && (
          <button className="btn ghost" onClick={() => socket.emit('revealNow')}>Skip stragglers → reveal</button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="round-head">
        <span className="round-n">Round {state.round}</span>
        {state.wildcard && <span className="wild">WILDCARD</span>}
      </div>
      {state.wildcard && <div className="wild-banner">⚡ {state.wildcard.label}</div>}
      {secret === 'traitor' && (
        <div className="traitor-banner">😈 You're the TRAITOR. Vote <em>against</em> the crowd. Don't pick who you think lands in the hot seat. Pull it off for a reward.</div>
      )}
      <h2 className="prompt">{state.prompt}</h2>

      <p className="label">Who fits? <span className="muted">(not you)</span></p>
      <PickGrid players={players.filter((p) => p.id !== me)} value={vote} onPick={setVote} accent="red" />

      <p className="label">Who will the group pick?</p>
      <PickGrid players={players} value={predict} onPick={setPredict} accent="cream" />

      <button className="btn primary" disabled={!vote || !predict} onClick={send}>Lock it in</button>
    </div>
  );
}

function PickGrid({ players, value, onPick, accent }) {
  return (
    <div className="grid">
      {players.map((p, i) => (
        <button key={p.id} style={{ '--i': i }} className={'pick ' + accent + (value === p.id ? ' on' : '')} onClick={() => onPick(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

function Reveal({ state, me, isHost }) {
  const r = state.reveal;
  const [picking, setPicking] = useState(false);
  const mine = r.results.find((x) => x.id === me);
  const youAreHotSeat = r.targetId === me;
  const maxVotes = Math.max(1, ...r.breakdown.map((b) => b.votes));
  const meP = state.players.find((p) => p.id === me);
  const myTokens = meP?.tokens || 0;

  const spend = (targetId) => { socket.emit('spendToken', { targetId }); setPicking(false); };

  return (
    <div className="screen">
      <div className="round-head"><span className="round-n">Round {r.round}</span></div>
      <p className="prompt sm">{r.prompt}</p>

      <div className="hotseat-card">
        <p className="muted">In the hot seat</p>
        <div className="hotseat-name">{r.targetName} 🔥</div>
      </div>

      <div className="bars">
        {r.breakdown.map((b, i) => (
          <div key={i} className="bar-row">
            <span className="bar-name">{b.name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ '--w': b.votes / maxVotes, '--i': i }} /></div>
            <span className="bar-votes">{b.votes}</span>
          </div>
        ))}
      </div>

      <div className={'verdict ' + (youAreHotSeat || mine?.sips ? 'drink' : 'safe')}>
        {youAreHotSeat ? (
          <><strong>You're in the hot seat.</strong><p>{r.challenge}</p></>
        ) : mine?.sips ? (
          <><strong>You misread the room.</strong><p>Take {mine.sips === 2 ? 'two sips' : 'a sip'}.</p></>
        ) : (
          <><strong>Safe.</strong><p>You read the room right.</p></>
        )}
        {(youAreHotSeat || mine?.sips) && <DareSwap />}
      </div>

      {r.traitor && (
        <div className={'traitor-reveal ' + (r.traitor.won ? 'won' : 'caught')}>
          😈 <strong>{r.traitor.name}</strong> was the Traitor, {r.traitor.won ? 'and got away with it.' : 'and voted with the crowd. Busted.'}
        </div>
      )}

      {r.exposed && (
        <div className="exposed">
          <div className="exposed-head">🃏 THE EXPOSED CARD</div>
          <p className="muted">Who voted for whom this round:</p>
          {r.exposed.map((e, i) => (
            <div key={i} className="exposed-row"><span>{e.voter}</span><span className="arrow">→</span><strong>{e.target}</strong></div>
          ))}
        </div>
      )}

      {r.revengeTo === meP?.name && <p className="earned">🎟️ You took the most heat. You earned a revenge token.</p>}

      {myTokens > 0 && (
        picking ? (
          <div className="spend">
            <p className="label">Hand a challenge to…</p>
            <PickGrid players={state.players.filter((p) => p.id !== me)} value={null} onPick={spend} accent="red" />
            <button className="btn ghost" onClick={() => setPicking(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn ghost" onClick={() => setPicking(true)}>🎟️ Spend revenge token ({myTokens})</button>
        )
      )}

      {isHost ? (
        <div className="row">
          <button className="btn ghost" onClick={() => socket.emit('end')}>End game</button>
          <button className="btn primary" onClick={() => socket.emit('next')}>Next round →</button>
        </div>
      ) : (
        <p className="muted center">Waiting for the host…</p>
      )}
    </div>
  );
}

function Recap({ recap, leave, isHost }) {
  return (
    <div className="screen">
      <div className="center" style={{ marginTop: 16 }}><Logo small /></div>
      <p className="tagline">{recap.rounds} rounds. Here's the damage.</p>

      <div className="awards">
        {recap.awards.map((a, i) => (
          <div key={a.title} style={{ '--i': i }} className="award">
            <span className="award-emoji">{a.emoji}</span>
            <div>
              <strong>{a.title}</strong>
              <div className="award-win">{a.winners.length ? a.winners.join(', ') : 'nobody'}</div>
              <span className="muted">{a.stat}</span>
            </div>
          </div>
        ))}
      </div>

      <table className="score">
        <thead><tr><th>Player</th>{!recap.duel && <th>Reads</th>}<th>🔥</th><th>🍺</th></tr></thead>
        <tbody>
          {recap.scoreboard.map((s) => (
            <tr key={s.name}><td>{s.name}</td>{!recap.duel && <td>{s.reads}</td>}<td>{s.hotseat}</td><td>{s.sips}</td></tr>
          ))}
        </tbody>
      </table>

      <button className="btn primary" onClick={leave}>New game</button>
      <p className="fine">Screenshot it. Settle it later.</p>
    </div>
  );
}

function TopBar({ leave }) {
  return (
    <div className="topbar">
      <Logo small />
      <button className="leave" onClick={leave}>Leave</button>
    </div>
  );
}

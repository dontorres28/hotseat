import { useEffect, useRef, useState } from 'react';
import { socket } from './socket.js';

const MODES = [
  { id: 'chill', name: 'Chill', blurb: 'Clean and silly. Good for mixed groups.' },
  { id: 'roast', name: 'Roast', blurb: 'Savage but friendly. All about the room.' },
  { id: 'spicy', name: 'Spicy', blurb: 'After dark. Every phone opts in first.' },
  { id: 'chaos', name: 'Chaos', blurb: 'Everything mixed, plus wildcard rounds.' },
];

const LS = 'hotseat.session';

export default function App() {
  const [me, setMe] = useState(null);
  const [code, setCode] = useState(null);
  const [state, setState] = useState(null);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('joined', ({ code, playerId }) => {
      setMe(playerId); setCode(code); setRecap(null);
      localStorage.setItem(LS, JSON.stringify({ code, playerId }));
    });
    socket.on('state', (s) => { setState(s); if (s.phase !== 'recap') setRecap(null); });
    socket.on('recap', (r) => setRecap(r));
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

  const leave = () => { localStorage.removeItem(LS); setMe(null); setCode(null); setState(null); setRecap(null); };

  if (!state || !me) return <Home setError={setError} error={error} />;
  if (recap) return <Recap recap={recap} leave={leave} isHost={state.hostId === me} />;

  const isHost = state.hostId === me;
  if (state.phase === 'lobby') return <Lobby state={state} me={me} isHost={isHost} leave={leave} />;
  if (state.phase === 'prompt') return <Round state={state} me={me} isHost={isHost} />;
  if (state.phase === 'reveal') return <Reveal state={state} me={me} isHost={isHost} />;
  return <Wordmark sub="loading…" />;
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
  const [tab, setTab] = useState('start'); // start | join
  const [name, setName] = useState('');
  const [mode, setMode] = useState('chill');
  const [joinCode, setJoinCode] = useState('');

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

      <div className="tabs">
        <button className={tab === 'start' ? 'tab on' : 'tab'} onClick={() => setTab('start')}>Start a room</button>
        <button className={tab === 'join' ? 'tab on' : 'tab'} onClick={() => setTab('join')}>Join</button>
      </div>

      <input className="field" placeholder="Your name" maxLength={20} value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }} />

      {tab === 'start' ? (
        <>
          <div className="modes">
            {MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? 'mode on' : 'mode'} onClick={() => setMode(m.id)}>
                <strong>{m.name}</strong><span>{m.blurb}</span>
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

      {error && <p className="error">{error}</p>}
      <p className="fine">21+. Know your limit. There's always a non-drinking challenge — never required to drink.</p>
    </div>
  );
}

function Lobby({ state, me, isHost, leave }) {
  const you = state.players.find((p) => p.id === me);
  const needMyConsent = state.needsConsent && you && !you.consented;
  const waiting = state.players.filter((p) => p.connected && !p.consented).length;
  const enough = state.players.filter((p) => p.connected).length >= 2;

  return (
    <div className="screen">
      <TopBar leave={leave} />
      <div className="center">
        <p className="muted">Room code</p>
        <div className="bigcode">{state.code}</div>
        <p className="muted">{state.mode.toUpperCase()} mode</p>
      </div>

      <div className="players">
        {state.players.map((p) => (
          <div key={p.id} className={'chip' + (p.connected ? '' : ' off')}>
            {p.name}{p.id === state.hostId ? ' 👑' : ''}{state.needsConsent && p.consented ? ' ✅' : ''}
          </div>
        ))}
      </div>

      {needMyConsent && (
        <button className="btn primary" onClick={() => socket.emit('consent')}>This gets spicy — I'm in 🌶️</button>
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

function Round({ state, me, isHost }) {
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
      {players.map((p) => (
        <button key={p.id} className={'pick ' + accent + (value === p.id ? ' on' : '')} onClick={() => onPick(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

function Reveal({ state, me, isHost }) {
  const r = state.reveal;
  const mine = r.results.find((x) => x.id === me);
  const youAreHotSeat = r.targetId === me;
  const maxVotes = Math.max(1, ...r.breakdown.map((b) => b.votes));

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
            <div className="bar-track"><div className="bar-fill" style={{ width: `${(b.votes / maxVotes) * 100}%` }} /></div>
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

function Recap({ recap, leave, isHost }) {
  return (
    <div className="screen">
      <div className="center" style={{ marginTop: 16 }}><Logo small /></div>
      <p className="tagline">{recap.rounds} rounds. Here's the damage.</p>

      <div className="awards">
        {recap.awards.map((a) => (
          <div key={a.title} className="award">
            <span className="award-emoji">{a.emoji}</span>
            <div>
              <strong>{a.title}</strong>
              <div className="award-win">{a.winners.length ? a.winners.join(', ') : '—'}</div>
              <span className="muted">{a.stat}</span>
            </div>
          </div>
        ))}
      </div>

      <table className="score">
        <thead><tr><th>Player</th><th>Reads</th><th>🔥</th><th>🍺</th></tr></thead>
        <tbody>
          {recap.scoreboard.map((s) => (
            <tr key={s.name}><td>{s.name}</td><td>{s.reads}</td><td>{s.hotseat}</td><td>{s.sips}</td></tr>
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

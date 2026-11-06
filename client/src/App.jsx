import { useEffect, useState } from 'react';
import { socket } from './socket.js';
import { LangCtx, useT, LANGS } from './i18n.js';

const MODES = [
  { id: 'chill', emoji: '😎' },
  { id: 'roast', emoji: '🔥' },
  { id: 'spicy', emoji: '🌶️' },
  { id: 'chaos', emoji: '🎲' },
  { id: 'duel', emoji: '⚔️' },
];

const LS = 'hotseat.session';
const LS_LANG = 'hotseat.lang';

export default function App() {
  const [me, setMe] = useState(null);
  const [state, setState] = useState(null);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState(null); // 'traitor' | 'crew' | null
  const [toast, setToast] = useState(null);
  const [lang, setLang] = useState(() => { try { return localStorage.getItem(LS_LANG) || 'en'; } catch { return 'en'; } });

  useEffect(() => {
    socket.on('joined', ({ code, playerId }) => {
      setMe(playerId); setRecap(null);
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

  const pickLang = (l) => { setLang(l); try { localStorage.setItem(LS_LANG, l); } catch { /* ignore */ } };
  const leave = () => {
    socket.emit('leaveRoom');
    localStorage.removeItem(LS);
    setMe(null); setState(null); setRecap(null); setSecret(null);
  };

  // The room's language wins once you're in one; otherwise your local pick.
  const activeLang = state?.lang || lang;

  let content;
  if (!state || !me) {
    content = <Home setError={setError} error={error} lang={lang} setLang={pickLang} />;
  } else {
    const isHost = state.hostId === me;
    let screen;
    if (recap) screen = <Recap recap={recap} leave={leave} />;
    else if (state.phase === 'lobby') screen = <Lobby state={state} me={me} isHost={isHost} leave={leave} />;
    else if (state.phase === 'prompt') screen = state.duel
      ? <DuelRound state={state} me={me} isHost={isHost} leave={leave} />
      : <Round state={state} me={me} isHost={isHost} secret={secret} leave={leave} />;
    else if (state.phase === 'reveal') screen = state.reveal?.duel
      ? <DuelReveal state={state} me={me} isHost={isHost} leave={leave} />
      : <Reveal state={state} me={me} isHost={isHost} leave={leave} />;
    else screen = <Wordmark />;
    content = <>{screen}{toast && <Toast t={toast} />}</>;
  }

  return <LangCtx.Provider value={activeLang}>{content}</LangCtx.Provider>;
}

// In-game top bar: mode emoji left, round centered, Leave right.
function GameBar({ mode, round, totalRounds, leave }) {
  const T = useT();
  const emoji = (MODES.find((m) => m.id === mode) || {}).emoji || '🎮';
  return (
    <div className="gamebar">
      <span className="tb-mode">{emoji}</span>
      <span className="tb-round">{T('round', { n: round })} <span className="muted">/ {totalRounds}</span></span>
      <button className="tb-leave" onClick={leave}>{T('leave')}</button>
    </div>
  );
}

// Shown when you're told to drink — swap the sip for a non-drinking dare.
function DareSwap() {
  const T = useT();
  const [dare, setDare] = useState(null);
  if (dare) return <p className="dare">🎯 {T('dareInstead', { dare })}</p>;
  return (
    <button className="swap-btn" onClick={() => socket.emit('swapDare', {}, (d) => setDare(d))}>
      {T('swap')}
    </button>
  );
}

// The one thing a tipsy player must get instantly: drink (how much) or safe.
function Verdict({ drinker, sips, challenge }) {
  const T = useT();
  if (!drinker) {
    return (
      <div className="verdict-hero safe">
        <div className="vh-emoji">✅</div>
        <div className="vh-big">{T('safeBig')}</div>
      </div>
    );
  }
  return (
    <div className="verdict-hero drink">
      <div className="vh-big">🍺 {T('drinkBig')}{!challenge && sips > 1 ? ` ${sips}` : ''}</div>
      {challenge && <p className="vh-sub">{challenge}</p>}
      <DareSwap />
    </div>
  );
}

function Toast({ t }) {
  const T = useT();
  return (
    <div className="toast">
      <strong>{T('toastRevenge', { from: t.fromName, to: t.toName })}</strong>
      <span>{t.challenge}</span>
    </div>
  );
}

function Wordmark() {
  const T = useT();
  return <div className="screen center"><Logo /><p className="muted">{T('loading')}</p></div>;
}

function Logo({ small }) {
  return <img className={small ? 'logo logo-sm' : 'logo'} src="/logo.webp" alt="HOT SEAT" />;
}

function Home({ setError, error, lang, setLang }) {
  const T = useT();
  const invited = new URLSearchParams(window.location.search).get('c');
  const [tab, setTab] = useState(invited ? 'join' : 'start');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('chill');
  const [joinCode, setJoinCode] = useState((invited || '').toUpperCase().slice(0, 4));

  const create = () => {
    if (!name.trim()) return setError('name');
    socket.emit('createRoom', { name, mode, lang }, (res) => { if (!res?.ok) setError(res?.error || 'generic'); });
  };
  const join = () => {
    if (!name.trim()) return setError('name');
    if (joinCode.trim().length < 4) return setError('code');
    socket.emit('joinRoom', { code: joinCode, name }, (res) => { if (!res?.ok) setError(res?.error || 'join'); });
  };

  return (
    <div className="screen">
      <div className="lang-select-wrap">
        <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={T('language')}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.id.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="center"><Logo /></div>
      <p className="tagline">{T('tagline')}</p>

      <div className="seg" data-active={tab}>
        <span className="seg-ind" aria-hidden="true" />
        <button className="seg-btn" onClick={() => setTab('start')}>{T('startRoom')}</button>
        <button className="seg-btn" onClick={() => setTab('join')}>{T('join')}</button>
      </div>

      <input className="field" placeholder={T('yourName')} maxLength={20} value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }} />

      <div key={tab} className="tab-body">
        {tab === 'start' ? (
          <>
            <div className="modes">
              {MODES.map((m, i) => (
                <button key={m.id} style={{ '--i': i }} className={mode === m.id ? 'mode on' : 'mode'} onClick={() => setMode(m.id)}>
                  <span className="mode-txt">
                    <strong>{m.emoji} {T('mode.' + m.id + '.name')}</strong>
                    <span>{T('mode.' + m.id + '.blurb')}</span>
                  </span>
                  <span className="mode-check" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button className="btn primary" onClick={create}>{T('createRoom')}</button>
          </>
        ) : (
          <>
            <input className="field code-in" placeholder={T('code')} maxLength={4} value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(''); }} />
            <button className="btn primary" onClick={join}>{T('joinRoom')}</button>
          </>
        )}
      </div>

      {error && <p className="error">{T('err.' + error)}</p>}
      <p className="fine">{T('fine18')}</p>
    </div>
  );
}

function Lobby({ state, me, isHost, leave }) {
  const T = useT();
  const [copied, setCopied] = useState(false);
  const you = state.players.find((p) => p.id === me);
  const needMyConsent = state.needsConsent && you && !you.consented;
  const waiting = state.players.filter((p) => p.connected && !p.consented).length;
  const connected = state.players.filter((p) => p.connected).length;
  const enough = connected >= 2;
  const max = state.maxPlayers ?? 20;
  const ceiling = state.duel ? 4 : 20;
  const totalRounds = state.totalRounds ?? 10;

  const share = async () => {
    const url = `${window.location.origin}/?c=${state.code}`;
    const data = { title: 'HOT SEAT', text: `HOT SEAT — ${state.code}`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* dismissed */ }
  };

  return (
    <div className="screen">
      <TopBar leave={leave} />
      <div className="center">
        <p className="muted">{T('roomCode')}</p>
        <button className="bigcode" onClick={share}>{state.code}</button>
        <p className="muted share-hint">
          {copied ? T('copied') : T('tapShare', { mode: T('mode.' + state.mode + '.name').toUpperCase() })}
        </p>
      </div>

      <div className="players">
        {state.players.map((p, i) => (
          <div key={p.id} style={{ '--i': i }} className={'chip' + (p.connected ? '' : ' off')}>
            {p.name}{p.id === state.hostId ? ' 👑' : ''}{state.needsConsent && p.consented ? ' ✅' : ''}
          </div>
        ))}
      </div>

      <div className="maxrow">
        <span className="muted">{T('players', { n: connected, max })}</span>
        {isHost && (
          <div className="stepper">
            <button onClick={() => socket.emit('setMax', { max: max - 1 })} disabled={max <= Math.max(2, connected)}>−</button>
            <span>{T('maxLabel', { n: max })}</span>
            <button onClick={() => socket.emit('setMax', { max: max + 1 })} disabled={max >= ceiling}>+</button>
          </div>
        )}
      </div>

      <div className="maxrow">
        <span className="muted">{T('roundsLabel')}</span>
        {isHost ? (
          <div className="stepper">
            <button onClick={() => socket.emit('setRounds', { rounds: totalRounds - 1 })} disabled={totalRounds <= 3}>−</button>
            <span>{totalRounds}</span>
            <button onClick={() => socket.emit('setRounds', { rounds: totalRounds + 1 })} disabled={totalRounds >= 20}>+</button>
          </div>
        ) : <span className="muted">{totalRounds}</span>}
      </div>

      <Packs packs={state.packs || []} isHost={isHost} />

      {needMyConsent && (
        <button className="btn primary" onClick={() => socket.emit('consent')}>{T('spicyConsent')}</button>
      )}

      {isHost ? (
        <button className="btn primary" disabled={!enough || waiting > 0} onClick={() => socket.emit('start')}>
          {!enough ? T('need2') : waiting > 0 ? T('waitingOptIn', { n: waiting }) : T('startGame')}
        </button>
      ) : (
        <p className="muted center">{T('waitingHost')}</p>
      )}
    </div>
  );
}

function Packs({ packs, isHost }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const enabled = packs.filter((p) => p.enabled);
  if (!isHost) {
    return enabled.length ? (
      <div className="packs-ro">
        <span className="muted">{T('packs')}</span>
        {enabled.map((p) => <span key={p.id} className="chip">{p.emoji} {p.name}</span>)}
      </div>
    ) : null;
  }
  return (
    <div className="packs">
      <button className="packs-toggle" onClick={() => setOpen((o) => !o)}>
        <span>{T('packs')}{enabled.length ? T('packsOn', { n: enabled.length }) : ''}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && packs.map((p, i) => (
        <button key={p.id} style={{ '--i': i }} className={'pack-row' + (p.enabled ? ' on' : '')}
          onClick={() => socket.emit('togglePack', { packId: p.id })}>
          <div className="pack-meta">
            <strong>{p.emoji} {p.name}</strong>
            <span className="muted">{p.blurb}</span>
          </div>
          <span className={'pack-btn' + (p.enabled ? ' on' : '')}>{p.enabled ? T('on') : T('off')}</span>
        </button>
      ))}
      {open && <p className="fine">{T('packsHint')}</p>}
    </div>
  );
}

function DuelRound({ state, me, isHost, leave }) {
  const T = useT();
  const submitted = state.submittedIds.includes(me);
  const pair = state.pair || [];
  const players = state.players.filter((p) => p.connected);
  const done = state.submittedIds.length;

  if (submitted) {
    return (
      <div className="screen center">
        <Logo small />
        <p className="locked">{T('lockedIn')}</p>
        <p className="muted">{T('voted', { done, total: players.length })}</p>
        {isHost && done < players.length && (
          <button className="btn ghost" onClick={() => socket.emit('revealNow')}>{T('skip')}</button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <GameBar mode={state.mode} round={state.round} totalRounds={state.totalRounds} leave={leave} />
      <h2 className="prompt">{state.prompt}</h2>
      <p className="label">{T('tapMoreLikely')}</p>
      <div className="duel">
        {pair.map((p) => (
          <button key={p.id} className="duel-pick" onClick={() => socket.emit('submit', { voteFor: p.id, predict: p.id })}>
            {p.name}{p.id === me ? ` ${T('notYou')}` : ''}
          </button>
        ))}
      </div>
      <p className="muted center">{T('voted', { done, total: players.length })}</p>
    </div>
  );
}

function DuelReveal({ state, me, isHost, leave }) {
  const T = useT();
  const r = state.reveal;
  const youDrink = (r.results.find((x) => x.id === me)?.sips || 0) > 0;
  const maxVotes = Math.max(1, ...r.pair.map((p) => p.votes));

  return (
    <div className="screen">
      <GameBar mode={state.mode} round={r.round} totalRounds={state.totalRounds} leave={leave} />
      <p className="prompt sm">{r.prompt}</p>

      <div className="hotseat-card">
        <p className="muted">{r.tie ? T('tie') : T('moreLikely')}</p>
        <div className="hotseat-name">{(r.tie ? r.drinkers.join(' & ') : r.targetName)} 🔥</div>
      </div>

      <Verdict drinker={youDrink} sips={youDrink ? 1 : 0} challenge={youDrink ? r.challenge : null} />

      <div className="bars small">
        {r.pair.map((p, i) => (
          <div key={i} className="bar-row">
            <span className="bar-name">{p.name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ '--w': p.votes / maxVotes, '--i': i }} /></div>
            <span className="bar-votes">{p.votes}</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <div className="row">
          <button className="btn ghost" onClick={() => socket.emit('end')}>{T('endGame')}</button>
          {r.round >= (state.totalRounds || 0)
            ? <button className="btn primary" onClick={() => socket.emit('end')}>{T('seeResults')}</button>
            : <button className="btn primary" onClick={() => socket.emit('next')}>{T('nextRound')}</button>}
        </div>
      ) : (
        <p className="muted center">{T('waitingHostShort')}</p>
      )}
    </div>
  );
}

function Round({ state, me, isHost, secret, leave }) {
  const T = useT();
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
        <p className="locked">{T('lockedIn')}</p>
        <p className="muted">{T('answered', { done, total })}</p>
        {isHost && done < total && (
          <button className="btn ghost" onClick={() => socket.emit('revealNow')}>{T('skip')}</button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <GameBar mode={state.mode} round={state.round} totalRounds={state.totalRounds} leave={leave} />
      {state.wildcard && <div className="wild-banner">⚡ {state.wildcard.label}</div>}
      {secret === 'traitor' && <div className="traitor-banner">{T('traitorBanner')}</div>}
      <h2 className="prompt">{state.prompt}</h2>

      <p className="label">{T('whoFits')} <span className="muted">{T('notYou')}</span></p>
      <PickGrid players={players.filter((p) => p.id !== me)} value={vote} onPick={setVote} accent="red" />

      <p className="label">{T('whoGroup')}</p>
      <PickGrid players={players} value={predict} onPick={setPredict} accent="cream" />

      <button className="btn primary" disabled={!vote || !predict} onClick={send}>{T('lockIn')}</button>
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

function Reveal({ state, me, isHost, leave }) {
  const T = useT();
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
      <GameBar mode={state.mode} round={r.round} totalRounds={state.totalRounds} leave={leave} />
      <p className="prompt sm">{r.prompt}</p>

      <div className="hotseat-card">
        <p className="muted">{T('hotSeat')}</p>
        <div className="hotseat-name">{r.targetName} 🔥</div>
      </div>

      <Verdict drinker={youAreHotSeat || !!mine?.sips} sips={youAreHotSeat ? 1 : (mine?.sips || 0)}
        challenge={youAreHotSeat ? r.challenge : null} />

      <div className="bars small">
        {r.breakdown.map((b, i) => (
          <div key={i} className="bar-row">
            <span className="bar-name">{b.name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ '--w': b.votes / maxVotes, '--i': i }} /></div>
            <span className="bar-votes">{b.votes}</span>
          </div>
        ))}
      </div>

      {r.traitor && (
        <div className={'traitor-reveal ' + (r.traitor.won ? 'won' : 'caught')}>
          {T(r.traitor.won ? 'traitorWon' : 'traitorBusted', { name: r.traitor.name })}
        </div>
      )}

      {r.exposed && (
        <div className="exposed">
          <div className="exposed-head">{T('exposedHead')}</div>
          <p className="muted">{T('exposedSub')}</p>
          {r.exposed.map((e, i) => (
            <div key={i} className="exposed-row"><span>{e.voter}</span><span className="arrow">→</span><strong>{e.target}</strong></div>
          ))}
        </div>
      )}

      {r.revengeTo === meP?.name && <p className="earned">{T('earnedToken')}</p>}

      {myTokens > 0 && (
        picking ? (
          <div className="spend">
            <p className="label">{T('handChallenge')}</p>
            <PickGrid players={state.players.filter((p) => p.id !== me)} value={null} onPick={spend} accent="red" />
            <button className="btn ghost" onClick={() => setPicking(false)}>{T('cancel')}</button>
          </div>
        ) : (
          <button className="btn ghost" onClick={() => setPicking(true)}>{T('spendToken', { n: myTokens })}</button>
        )
      )}

      {isHost ? (
        <div className="row">
          <button className="btn ghost" onClick={() => socket.emit('end')}>{T('endGame')}</button>
          {r.round >= (state.totalRounds || 0)
            ? <button className="btn primary" onClick={() => socket.emit('end')}>{T('seeResults')}</button>
            : <button className="btn primary" onClick={() => socket.emit('next')}>{T('nextRound')}</button>}
        </div>
      ) : (
        <p className="muted center">{T('waitingHostShort')}</p>
      )}
    </div>
  );
}

function Recap({ recap, leave }) {
  const T = useT();
  return (
    <div className="screen">
      <div className="center" style={{ marginTop: 16 }}><Logo small /></div>
      <p className="tagline">{T(recap.rounds === 1 ? 'damageOne' : 'damage', { rounds: recap.rounds })}</p>

      <div className="awards">
        {recap.awards.map((a, i) => (
          <div key={a.title} style={{ '--i': i }} className="award">
            <span className="award-emoji">{a.emoji}</span>
            <div>
              <strong>{a.title}</strong>
              <div className="award-win">{a.winners.length ? a.winners.join(', ') : T('nobody')}</div>
              <span className="muted">{a.stat}</span>
            </div>
          </div>
        ))}
      </div>

      <table className="score">
        <thead><tr><th>{T('colPlayer')}</th>{!recap.duel && <th>{T('colReads')}</th>}<th>🔥</th><th>🍺</th></tr></thead>
        <tbody>
          {recap.scoreboard.map((s) => (
            <tr key={s.name}><td>{s.name}</td>{!recap.duel && <td>{s.reads}</td>}<td>{s.hotseat}</td><td>{s.sips}</td></tr>
          ))}
        </tbody>
      </table>

      <button className="btn primary" onClick={leave}>{T('newGame')}</button>
      <p className="fine">{T('screenshot')}</p>
    </div>
  );
}

function TopBar({ leave }) {
  const T = useT();
  return (
    <div className="topbar">
      <Logo small />
      <button className="leave" onClick={leave}>{T('leave')}</button>
    </div>
  );
}

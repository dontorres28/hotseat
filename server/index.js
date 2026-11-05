import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { MODES } from './content.js';
import * as game from './game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.get('/health', (_req, res) => res.json({ ok: true }));

// In production, serve the built client from here so it's a single deploy.
const clientDist = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));

// Send the fresh public state to everyone in a room.
function broadcast(room) {
  io.to(room.code).emit('state', game.snapshot(room));
}

// Tell each player, privately, whether they're the Traitor this round.
function sendSecrets(room) {
  const tId = game.traitorId(room);
  for (const p of room.players.values()) {
    if (p.connected && p.socketId) io.to(p.socketId).emit('secret', { role: p.id === tId ? 'traitor' : 'crew' });
  }
}

io.on('connection', (socket) => {
  // Track what this socket is bound to, so disconnect can clean up.
  let bound = null; // { code, playerId }

  const join = (room, player) => {
    bound = { code: room.code, playerId: player.id };
    player.socketId = socket.id;
    socket.join(room.code);
    socket.emit('joined', { code: room.code, playerId: player.id, you: player.id });
    broadcast(room);
  };

  socket.on('createRoom', ({ name, mode }, ack) => {
    if (!MODES.includes(mode)) mode = 'chill';
    const room = game.createRoom(mode);
    const player = game.addPlayer(room, name, { host: true });
    ack?.({ ok: true, code: room.code, playerId: player.id });
    join(room, player);
  });

  socket.on('joinRoom', ({ code, name }, ack) => {
    const room = game.getRoom(code);
    if (!room) return ack?.({ ok: false, error: "That room code doesn't exist." });
    if (room.phase !== 'lobby') return ack?.({ ok: false, error: 'That game already started.' });
    const player = game.addPlayer(room, name);
    ack?.({ ok: true, code: room.code, playerId: player.id });
    join(room, player);
  });

  // Reconnect / rejoin after a refresh.
  socket.on('resume', ({ code, playerId }, ack) => {
    const room = game.getRoom(code);
    const player = room?.players.get(playerId);
    if (!room || !player) return ack?.({ ok: false });
    player.connected = true;
    if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
    ack?.({ ok: true });
    join(room, player);
    // Restore the Traitor secret if a round is live.
    if (room.phase === 'prompt') io.to(socket.id).emit('secret', { role: player.id === game.traitorId(room) ? 'traitor' : 'crew' });
  });

  const hostAction = (fn) => () => {
    if (!bound) return;
    const room = game.getRoom(bound.code);
    if (!room || room.hostId !== bound.playerId) return;
    fn(room);
    broadcast(room);
  };

  socket.on('consent', () => {
    if (!bound) return;
    const room = game.getRoom(bound.code);
    const p = room?.players.get(bound.playerId);
    if (p) { p.consented = true; broadcast(room); }
  });

  socket.on('start', hostAction((room) => {
    if (!game.allConsented(room)) return;
    game.dealPrompt(room);
    sendSecrets(room);
  }));

  socket.on('submit', ({ voteFor, predict }) => {
    if (!bound) return;
    const room = game.getRoom(bound.code);
    if (!room || room.phase !== 'prompt') return;
    game.submit(room, bound.playerId, voteFor, predict);
    if (game.everyoneSubmitted(room)) game.reveal(room);
    broadcast(room);
  });

  socket.on('revealNow', hostAction((room) => { if (room.phase === 'prompt') game.reveal(room); }));
  socket.on('next', hostAction((room) => { game.dealPrompt(room); sendSecrets(room); }));
  socket.on('end', hostAction((room) => io.to(room.code).emit('recap', game.recap(room))));

  socket.on('spendToken', ({ targetId }) => {
    if (!bound) return;
    const room = game.getRoom(bound.code);
    if (!room) return;
    const res = game.spendToken(room, bound.playerId, targetId);
    if (res) { io.to(room.code).emit('revenge', res); broadcast(room); }
  });

  socket.on('disconnect', () => {
    if (!bound) return;
    const room = game.getRoom(bound.code);
    if (room) { game.removePlayer(room, bound.playerId); broadcast(room); }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`HOT SEAT server on :${PORT}`));

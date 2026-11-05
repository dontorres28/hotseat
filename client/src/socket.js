import { io } from 'socket.io-client';

// In dev the client is on :5173 and the server on :3001. In production the
// server serves the built client, so same-origin works.
const URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export const socket = io(URL, { autoConnect: true });

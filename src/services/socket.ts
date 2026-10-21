// ─────────────────────────────────────────────────────────────────────────────
// Sequence Mobile App – Socket Client Service
// Handles connection lifecycle, auto-reconnection, and typed event dispatching.
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../config';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/protocol';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
  }
  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}

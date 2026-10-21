// ─────────────────────────────────────────────────────────────────────────────
// Sequence Multiplayer Server – Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../shared/protocol';
import { registerSocketHandlers } from './socketHandlers';
import { roomManager } from './roomManager';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const rawCorsOrigin = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '*';
const corsOrigin =
  rawCorsOrigin === '*'
    ? '*'
    : rawCorsOrigin.split(',').map((origin) => origin.trim());

const app = express();
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

// ── Health-Check Endpoint ───────────────────────────────────────────────────
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    activeRooms: roomManager.getActiveRoomCount(),
    connectedSockets: roomManager.getConnectedSocketCount(),
    timestamp: Date.now(),
    service: 'Sequence Multiplayer Game Server',
  });
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(`
    <html>
      <head><title>Sequence Multiplayer Server</title></head>
      <body style="font-family: system-ui; background: #071624; color: #fff; padding: 2rem;">
        <h1>👑 Sequence Multiplayer Server</h1>
        <p>Server is running and listening for Socket.io connections.</p>
        <p><strong>Health Check:</strong> <a href="/health" style="color: #F5C84C;">/health</a></p>
        <p><strong>Active Rooms:</strong> ${roomManager.getActiveRoomCount()}</p>
      </body>
    </html>
  `);
});

const httpServer = http.createServer(app);

// ── Socket.io Setup with Shared Typings ─────────────────────────────────────
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

registerSocketHandlers(io);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n👑 ============================================`);
    console.log(`   Sequence Game Server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Listening for connections on 0.0.0.0:${PORT}`);
    console.log(`============================================\n`);
  });
}

export { app, httpServer, io };

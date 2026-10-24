// ─────────────────────────────────────────────────────────────────────────────
// Sequence Server – Socket.io Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../shared/protocol';
import { roomManager } from './roomManager';

export type SequenceServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;
export type SequenceSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Broadcasts player-masked game states to all connected players in a room (full resync)
 */
export function broadcastGameState(io: SequenceServer, roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room || !room.engineState) return;

  for (const player of room.players) {
    if (player.isConnected && player.socketId) {
      const playerState = roomManager.getPlayerGameState(roomCode, player.id);
      if (playerState) {
        io.to(player.socketId).emit('gameStateUpdated', playerState);
      }
    }
  }
}

/**
 * Broadcasts lightweight incremental delta to connected players in a room
 */
export function broadcastIncrementalUpdate(
  io: SequenceServer,
  roomCode: string,
  delta: {
    cell?: [number, number];
    playedCardId?: string;
    playingPlayerId?: string;
    drawnCard?: any;
    isDeadCardDiscard?: boolean;
  }
) {
  const room = roomManager.getRoom(roomCode);
  if (!room || !room.engineState) return;
  const engine = room.engineState;
  const currentTurnPlayer = engine.players[engine.currentPlayerIndex];

  for (const player of room.players) {
    if (player.isConnected && player.socketId) {
      const isMover = player.id === delta.playingPlayerId;
      io.to(player.socketId).emit('gameIncrementalUpdate', {
        roomCode,
        version: room.version,
        lastMove: engine.lastMove,
        turnPlayerId: currentTurnPlayer?.id ?? '',
        currentPlayerIndex: engine.currentPlayerIndex,
        sequenceCounts: engine.sequenceCounts,
        sequencesNeeded: room.settings.teamCount === 3 ? 1 : 2,
        completedSequences: engine.completedSequences,
        winner: engine.winner,
        drawPileCount: engine.drawPile.length,
        reshuffleOccurred: engine.reshuffleOccurred,
        cell: delta.cell,
        playedCardId: delta.playedCardId,
        drawnCard: isMover ? delta.drawnCard : undefined, // Secret: only recipient gets drawn card
        isDeadCardDiscard: delta.isDeadCardDiscard,
        isPaused: room.isPaused,
      });
    }
  }
}

export function registerSocketHandlers(io: SequenceServer) {
  // Wire authoritative state-change callbacks from RoomManager to socket broadcasts
  roomManager.onGameStateChange = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (room && room.engineState) {
      broadcastGameState(io, roomCode);
    }
  };
  roomManager.onIncrementalUpdate = (roomCode: string, delta) => {
    broadcastIncrementalUpdate(io, roomCode, delta);
  };
  roomManager.onRoomStateChange = (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      io.to(`room-${room.roomCode}`).emit('roomUpdated', roomManager.getPublicRoomState(room));
    }
  };

  // Requirement 9: Send periodic lightweight heartbeats so quiet rooms on Render do not time out
  const heartbeatTimer = setInterval(() => {
    io.emit('heartbeat', { timestamp: Date.now() });
  }, 20000);
  if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') {
    heartbeatTimer.unref();
  }


  io.on('connection', (socket: SequenceSocket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── 1. CREATE ROOM ─────────────────────────────────────────────────────────
    socket.on('createRoom', ({ playerName, settings }, callback) => {
      try {
        const { room, playerId, reconnectToken } = roomManager.createRoom(playerName, settings, socket.id);
        socket.data.playerId = playerId;
        socket.data.roomCode = room.roomCode;

        socket.join(`room-${room.roomCode}`);
        callback({ success: true, room, playerId, reconnectToken });

        console.log(`[Room] Created ${room.roomCode} by ${playerName} (${playerId})`);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to create room.' });
      }
    });

    // ── 2. JOIN ROOM ───────────────────────────────────────────────────────────
    socket.on('joinRoom', ({ roomCode, playerName, reconnectToken }, callback) => {
      try {
        const result = roomManager.joinRoom(roomCode, playerName, socket.id, reconnectToken);
        if (!result.success || !result.room) {
          callback({ success: false, error: result.error });
          return;
        }

        socket.data.playerId = result.playerId;
        socket.data.roomCode = result.room.roomCode;
        socket.join(`room-${result.room.roomCode}`);

        callback(result);

        // Notify entire room of updated player list / seating
        io.to(`room-${result.room.roomCode}`).emit('roomUpdated', result.room);
        console.log(`[Room] ${playerName} joined ${result.room.roomCode}`);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to join room.' });
      }
    });

    // ── 2.5 SET TEAM COUNT ─────────────────────────────────────────────────────
    socket.on('setTeamCount', ({ roomCode, playerId, teamCount }, callback) => {
      try {
        const result = roomManager.setTeamCount(roomCode, playerId, teamCount);
        if (!result.success || !result.room) {
          callback({ success: false, error: result.error });
          return;
        }

        callback(result);
        io.to(`room-${result.room.roomCode}`).emit('roomUpdated', result.room);
        console.log(`[Room] ${roomCode} team count updated to ${teamCount}`);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to set team count.' });
      }
    });

    // ── 3. START GAME ──────────────────────────────────────────────────────────
    socket.on('startGame', ({ roomCode, playerId }, callback) => {
      try {
        const result = roomManager.startGame(roomCode, playerId);
        if (!result.success) {
          const errMsg = result.error || 'Failed to start game.';
          socket.emit('error', { message: errMsg, code: 'START_GAME_FAILED' });
          callback({ success: false, error: errMsg });
          return;
        }

        const room = roomManager.getRoom(roomCode);
        if (!room) {
          callback({ success: false, error: 'Room not found.' });
          return;
        }

        callback({ success: true });

        // Update room status
        io.to(`room-${room.roomCode}`).emit('roomUpdated', roomManager.getPublicRoomState(room));

        // Dispatch personalized game state to each player
        broadcastGameState(io, room.roomCode);
        console.log(`[Game] Started match in room ${room.roomCode}`);
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to start game.';
        socket.emit('error', { message: errMsg, code: 'START_GAME_FAILED' });
        callback({ success: false, error: errMsg });
      }
    });

    // ── 4. PLAY MOVE ───────────────────────────────────────────────────────────
    socket.on('playMove', ({ roomCode, playerId, cell, cardId }, callback) => {
      try {
        const result = roomManager.playMove(roomCode, playerId, cell, cardId);
        if (!result.success) {
          const errMsg = result.error || 'Illegal move.';
          socket.emit('error', { message: errMsg, code: 'ILLEGAL_MOVE' });
          callback({ success: false, error: errMsg });
          return;
        }

        callback({ success: true });

        const room = roomManager.getRoom(roomCode);
        if (room && room.status === 'finished') {
          broadcastGameState(io, roomCode);
          io.to(`room-${room.roomCode}`).emit('roomUpdated', roomManager.getPublicRoomState(room));
          console.log(`[Game] Finished match in room ${room.roomCode}! Winner: ${room.engineState?.winner}`);
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Illegal move.';
        socket.emit('error', { message: errMsg, code: 'ILLEGAL_MOVE' });
        callback({ success: false, error: errMsg });
      }
    });

    // ── 5. DISCARD DEAD CARD ───────────────────────────────────────────────────
    socket.on('discardDeadCard', ({ roomCode, playerId, cardId }, callback) => {
      try {
        const result = roomManager.discardDeadCard(roomCode, playerId, cardId);
        if (!result.success) {
          const errMsg = result.error || 'Failed to discard dead card.';
          socket.emit('error', { message: errMsg, code: 'ILLEGAL_DISCARD' });
          callback({ success: false, error: errMsg });
          return;
        }

        callback({ success: true });
        console.log(`[Game] Player ${playerId} discarded dead card in room ${roomCode}`);
      } catch (err: any) {

        const errMsg = err?.message || 'Failed to discard dead card.';
        socket.emit('error', { message: errMsg, code: 'ILLEGAL_DISCARD' });
        callback({ success: false, error: errMsg });
      }
    });

    // ── 6. REJOIN ──────────────────────────────────────────────────────────────
    socket.on('rejoin', ({ roomCode, playerId, reconnectToken }, callback) => {
      try {
        const identifier = reconnectToken || playerId || '';
        const result = roomManager.rejoinRoom(roomCode, identifier, socket.id);
        if (!result.success || !result.room) {
          callback({ success: false, error: result.error });
          return;
        }

        socket.data.playerId = result.playerId;
        socket.data.roomCode = result.room.roomCode;
        socket.join(`room-${result.room.roomCode}`);

        callback(result);

        // Notify room that player reconnected
        io.to(`room-${result.room.roomCode}`).emit('roomUpdated', result.room);
        broadcastGameState(io, result.room.roomCode);
        console.log(`[Room] Player ${result.playerId} reconnected to ${result.room.roomCode}`);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to rejoin.' });
      }
    });

    // ── 6.5 LEAVE ROOM ─────────────────────────────────────────────────────────
    socket.on('leaveRoom', ({ roomCode, playerId }, callback) => {
      try {
        const result = roomManager.leaveRoom(roomCode, playerId);
        if (!result.success) {
          callback({ success: false, error: result.error });
          return;
        }

        socket.leave(`room-${roomCode}`);
        callback({ success: true });

        const message = result.message || 'A player left the match';
        io.to(`room-${roomCode}`).emit('notification', { message });

        if (result.room) {
          io.to(`room-${roomCode}`).emit('roomUpdated', result.room);
          broadcastGameState(io, roomCode);
        }
        console.log(`[Room] Player ${playerId} left room ${roomCode}: ${message}`);
      } catch (err: any) {
        callback({ success: false, error: err?.message || 'Failed to leave room.' });
      }
    });

    // ── 6.75 PRESENCE ACTIVE ──────────────────────────────────────────────────
    socket.on('presence:active', ({ roomCode, playerId }) => {
      try {
        socket.join(`room-${roomCode}`);
        socket.data.roomCode = roomCode;
        socket.data.playerId = playerId;
        roomManager.handlePresenceActive(roomCode, playerId, socket.id);
        console.log(`[Presence] Player ${playerId} is active in ${roomCode}`);
      } catch (err: any) {
        console.warn(`[Presence] Error in presence:active for ${playerId}:`, err?.message);
      }
    });

    // ── 7. DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { roomCode, playerId } = roomManager.handleDisconnect(socket.id);
      console.log(`[Socket] Disconnected: ${socket.id} (Player: ${playerId} in ${roomCode}) - grace period started`);
    });
  });
}

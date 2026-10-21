// ─────────────────────────────────────────────────────────────────────────────
// Sequence Server – In-Memory Authoritative Room Manager
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import type {
  RoomState,
  RoomSettings,
  RoomPlayer,
  PlayerGameState,
  PlayerSummary,
} from '../../shared/protocol';
import {
  setupGame,
  gameEngineReducer,
  GameEngineState,
  requiredSequences,
  VALID_PLAYER_COUNTS,
  TeamId,
  Card,
  chooseMove,
} from '../../shared/engine';

export interface ActiveRoomPlayer extends RoomPlayer {
  reconnectToken: string;
  disconnectedAt?: number;
}

export interface ActiveRoom {
  roomCode: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  players: ActiveRoomPlayer[];
  settings: RoomSettings;
  createdAt: number;
  lastActiveAt: number;
  engineState: GameEngineState | null;
  isPaused?: boolean;
}

export class RoomManager {
  public static readonly INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  public disconnectTimeoutMs: number = 60 * 1000; // 60 seconds
  private rooms: Map<string, ActiveRoom> = new Map();
  // Quick lookup: socketId -> { roomCode, playerId }
  private socketMap: Map<string, { roomCode: string; playerId: string }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  // Callbacks for broadcasting state changes
  public onGameStateChange?: (roomCode: string) => void;
  public onRoomStateChange?: (roomCode: string) => void;

  constructor(enableCleanupInterval: boolean = true) {
    if (enableCleanupInterval && typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanupInactiveRooms();
      }, 60 * 1000);
      if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }

  /**
   * Generate an uppercase 6-character alphanumeric room code
   * Omits confusing/ambiguous characters: O, 0, I, 1
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O, 0, I, 1
    let code = '';
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
      if (attempts > 1000) break;
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new multiplayer room
   * Returns a 6-character room code, public room state, playerId, and a private reconnectToken.
   */
  public createRoom(
    playerName: string,
    customSettings?: Partial<RoomSettings>,
    socketId: string = ''
  ): { room: RoomState; playerId: string; reconnectToken: string } {
    const roomCode = this.generateRoomCode();
    const playerId = `player-${crypto.randomUUID().slice(0, 8)}`;
    const reconnectToken = crypto.randomUUID();

    const requestedMax = customSettings?.maxPlayers;
    const maxPlayers =
      requestedMax !== undefined && VALID_PLAYER_COUNTS.includes(requestedMax as any)
        ? requestedMax
        : 12;

    const teamCount: 2 | 3 = customSettings?.teamCount === 3 ? 3 : 2;

    const settings: RoomSettings = {
      teamCount,
      maxPlayers,
      turnTimeoutSeconds: customSettings?.turnTimeoutSeconds ?? 0,
    };

    const hostPlayer: ActiveRoomPlayer = {
      id: playerId,
      socketId,
      name: playerName.trim() || 'Player 1',
      teamId: 'red',
      seat: 0,
      isHost: true,
      isConnected: true,
      isBotControlled: false,
      reconnectToken,
    };

    const now = Date.now();
    const newRoom: ActiveRoom = {
      roomCode,
      hostId: playerId,
      status: 'lobby',
      players: [hostPlayer],
      settings,
      createdAt: now,
      lastActiveAt: now,
      engineState: null,
      isPaused: false,
    };

    this.rooms.set(roomCode, newRoom);
    if (socketId) {
      this.socketMap.set(socketId, { roomCode, playerId });
    }

    return {
      room: this.getPublicRoomState(newRoom),
      playerId,
      reconnectToken,
    };
  }

  /**
   * Join an existing lobby room by code with player name.
   * If a valid reconnectToken is supplied, reclaims the existing seat.
   * Max players follows allowed counts (2, 3, 4, 6, 8, 9, 10, 12).
   */
  public joinRoom(
    roomCode: string,
    playerName: string,
    socketId: string = '',
    reconnectToken?: string
  ): {
    success: boolean;
    room?: RoomState;
    playerId?: string;
    reconnectToken?: string;
    error?: string;
  } {
    if (!roomCode || typeof roomCode !== 'string') {
      return { success: false, error: 'Room code is required.' };
    }

    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: `Room ${code} does not exist.` };
    }

    room.lastActiveAt = Date.now();

    // Check if player is rejoining using their private reconnect token
    if (reconnectToken) {
      const existing = room.players.find((p) => p.reconnectToken === reconnectToken);
      if (existing) {
        existing.socketId = socketId;
        existing.isConnected = true;
        existing.isBotControlled = false;
        delete existing.disconnectedAt;

        // Clear disconnect timer if active
        const timerKey = `${code}:${existing.id}`;
        const timer = this.disconnectTimers.get(timerKey);
        if (timer) {
          clearTimeout(timer);
          this.disconnectTimers.delete(timerKey);
        }

        if (playerName && playerName.trim()) {
          existing.name = playerName.trim();
        }
        if (socketId) {
          this.socketMap.set(socketId, { roomCode: code, playerId: existing.id });
        }
        return {
          success: true,
          room: this.getPublicRoomState(room),
          playerId: existing.id,
          reconnectToken: existing.reconnectToken,
        };
      }
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Game is already in progress in this room.' };
    }

    if (room.players.length >= room.settings.maxPlayers || room.players.length >= 12) {
      return {
        success: false,
        error: `Room ${code} is full (${room.settings.maxPlayers} max).`,
      };
    }

    const playerId = `player-${crypto.randomUUID().slice(0, 8)}`;
    const newReconnectToken = crypto.randomUUID();
    const seat = room.players.length;

    // Determine alternate seating team so teammates never sit together
    const teams: TeamId[] =
      room.settings.teamCount === 3 ? ['red', 'blue', 'green'] : ['red', 'blue'];
    const teamId = teams[seat % teams.length];

    const newPlayer: ActiveRoomPlayer = {
      id: playerId,
      socketId,
      name: playerName.trim() || `Player ${seat + 1}`,
      teamId,
      seat,
      isHost: false,
      isConnected: true,
      isBotControlled: false,
      reconnectToken: newReconnectToken,
    };

    room.players.push(newPlayer);
    if (socketId) {
      this.socketMap.set(socketId, { roomCode: code, playerId });
    }

    return {
      success: true,
      room: this.getPublicRoomState(room),
      playerId,
      reconnectToken: newReconnectToken,
    };
  }

  /**
   * Host chooses number of teams (2 or 3) and seats are re-assigned in alternating order
   */
  public setTeamCount(
    roomCode: string,
    playerId: string,
    teamCount: 2 | 3
  ): { success: boolean; room?: RoomState; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: `Room ${code} does not exist.` };
    }

    if (room.hostId !== playerId) {
      return { success: false, error: 'Only the room host can change room settings.' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Cannot change team count after match has started.' };
    }

    if (teamCount !== 2 && teamCount !== 3) {
      return { success: false, error: 'Team count must be 2 or 3.' };
    }

    room.settings.teamCount = teamCount;

    // Reassign teams with alternating seating so teammates never sit together
    const teams: TeamId[] =
      teamCount === 3 ? ['red', 'blue', 'green'] : ['red', 'blue'];
    room.players.forEach((player, seat) => {
      player.seat = seat;
      player.teamId = teams[seat % teams.length];
    });

    room.lastActiveAt = Date.now();

    return {
      success: true,
      room: this.getPublicRoomState(room),
    };
  }

  /**
   * Start the match using authoritative game engine.
   * Shuffles deck, cuts the deck to determine dealer and starting player, and deals cards.
   */
  public startGame(
    roomCode: string,
    playerId: string
  ): { success: boolean; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: `Room ${code} does not exist.` };
    }

    if (room.hostId !== playerId) {
      return { success: false, error: 'Only the room host can start the game.' };
    }

    if (room.status !== 'lobby') {
      return { success: false, error: 'Match has already started.' };
    }

    const count = room.players.length;
    if (!VALID_PLAYER_COUNTS.includes(count as any)) {
      return {
        success: false,
        error: `Invalid player count (${count}). Allowed player counts: 2, 3, 4, 6, 8, 9, 10, or 12.`,
      };
    }

    if (count % room.settings.teamCount !== 0) {
      return {
        success: false,
        error: `Cannot start game: ${count} players cannot be evenly divided among ${room.settings.teamCount} teams.`,
      };
    }

    // Ensure alternating seating
    const teams: TeamId[] =
      room.settings.teamCount === 3 ? ['red', 'blue', 'green'] : ['red', 'blue'];
    room.players.forEach((player, seat) => {
      player.seat = seat;
      player.teamId = teams[seat % teams.length];
    });

    // Setup pure TypeScript game engine:
    // shuffles, cuts the deck, sets first player clockwise from dealer, deals hands
    const engineState = setupGame({
      playerNames: room.players.map((p) => p.name),
      teams,
      settings: { mode: 'local' }, // Server handles networking
    });

    // Link engine player IDs to room player IDs
    engineState.players.forEach((ep, idx) => {
      ep.id = room.players[idx].id;
      ep.name = room.players[idx].name;
    });

    room.engineState = engineState;
    room.status = 'playing';
    room.lastActiveAt = Date.now();

    if (this.onGameStateChange) {
      this.onGameStateChange(roomCode);
    }
    if (this.onRoomStateChange) {
      this.onRoomStateChange(roomCode);
    }

    return { success: true };
  }

  /**
   * Execute a move played by an active player.
   * Verifies turn order, legality using the engine, auto-draws, detects sequences,
   * checks for win, and advances turn.
   */
  public playMove(
    roomCode: string,
    playerId: string,
    cell: [number, number],
    cardId: string
  ): { success: boolean; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room || !room.engineState) {
      return { success: false, error: 'Active game not found.' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: 'Game is not in playing phase.' };
    }

    if (room.isPaused) {
      return { success: false, error: 'Game is currently paused.' };
    }

    const currentTurnPlayer = room.engineState.players[room.engineState.currentPlayerIndex];
    if (currentTurnPlayer.id !== playerId) {
      return { success: false, error: 'It is not your turn to play.' };
    }

    try {
      const nextState = gameEngineReducer(room.engineState, {
        type: 'PLAY_MOVE',
        cell,
        cardId,
      });

      room.engineState = nextState;
      room.lastActiveAt = Date.now();
      if (nextState.phase === 'finished') {
        room.status = 'finished';
      }

      if (this.onGameStateChange) {
        this.onGameStateChange(roomCode);
      }
      if (nextState.phase === 'finished' && this.onRoomStateChange) {
        this.onRoomStateChange(roomCode);
      }

      // Check if next turn belongs to an offline bot-controlled player
      if (room.status === 'playing') {
        this.checkNextBotTurn(roomCode);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Illegal move.' };
    }
  }

  /**
   * Discard a dead card and auto-draw replacement
   */
  public discardDeadCard(
    roomCode: string,
    playerId: string,
    cardId: string
  ): { success: boolean; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room || !room.engineState) {
      return { success: false, error: 'Active game not found.' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: 'Game is not in playing phase.' };
    }

    if (room.isPaused) {
      return { success: false, error: 'Game is currently paused.' };
    }

    const currentTurnPlayer = room.engineState.players[room.engineState.currentPlayerIndex];
    if (currentTurnPlayer.id !== playerId) {
      return { success: false, error: 'It is not your turn.' };
    }

    try {
      const nextState = gameEngineReducer(room.engineState, {
        type: 'DISCARD_DEAD_CARD',
        cardId,
      });

      room.engineState = nextState;
      room.lastActiveAt = Date.now();

      if (this.onGameStateChange) {
        this.onGameStateChange(roomCode);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Cannot discard card.' };
    }
  }

  /**
   * If the current turn player is bot-controlled, trigger a move
   */
  public checkNextBotTurn(roomCode: string): void {
    const room = this.rooms.get(roomCode.trim().toUpperCase());
    if (!room || room.status !== 'playing' || !room.engineState || room.isPaused) return;

    const currentTurnPlayerId = room.engineState.players[room.engineState.currentPlayerIndex]?.id;
    if (!currentTurnPlayerId) return;

    const roomPlayer = room.players.find((p) => p.id === currentTurnPlayerId);
    if (roomPlayer && roomPlayer.isBotControlled) {
      // Trigger bot turn after a brief delay
      setTimeout(() => {
        if (room.status === 'playing' && !room.isPaused) {
          this.playBotTurn(roomCode, currentTurnPlayerId);
        }
      }, 200);
    }
  }

  /**
   * Execute an automated bot turn using the shared AI engine
   */
  public playBotTurn(roomCode: string, playerId: string): boolean {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing' || !room.engineState || room.isPaused) return false;

    const currentTurnPlayer = room.engineState.players[room.engineState.currentPlayerIndex];
    if (!currentTurnPlayer || currentTurnPlayer.id !== playerId) return false;

    const botMove = chooseMove(room.engineState, playerId, 'medium');
    if (!botMove) return false;

    if (botMove.type === 'play') {
      const res = this.playMove(code, playerId, botMove.cell, botMove.cardId);
      return res.success;
    } else if (botMove.type === 'discard_dead') {
      const res = this.discardDeadCard(code, playerId, botMove.cardId);
      return res.success;
    }
    return false;
  }

  /**
   * Pause the active game (e.g. while awaiting player reconnect)
   */
  public pauseGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode.trim().toUpperCase());
    if (!room || room.status !== 'playing') return false;
    room.isPaused = true;
    if (this.onGameStateChange) this.onGameStateChange(roomCode);
    return true;
  }

  /**
   * Resume a paused game
   */
  public resumeGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode.trim().toUpperCase());
    if (!room || room.status !== 'playing') return false;
    room.isPaused = false;
    if (this.onGameStateChange) this.onGameStateChange(roomCode);
    this.checkNextBotTurn(roomCode);
    return true;
  }

  /**
   * Rejoin a room using either private reconnectToken or playerId
   * Restores player to the exact same seat and reconnects them, reclaiming bot control
   */
  public rejoinRoom(
    roomCode: string,
    tokenOrPlayerId: string,
    newSocketId: string = ''
  ): {
    success: boolean;
    room?: RoomState;
    gameState?: PlayerGameState;
    playerId?: string;
    reconnectToken?: string;
    error?: string;
  } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: `Room ${code} does not exist.` };
    }

    const player = room.players.find(
      (p) => (p.reconnectToken && p.reconnectToken === tokenOrPlayerId) || p.id === tokenOrPlayerId
    );
    if (!player) {
      return { success: false, error: 'Player not recognized in this room.' };
    }

    // Cancel pending disconnect timer for this player
    const timerKey = `${code}:${player.id}`;
    const pendingTimer = this.disconnectTimers.get(timerKey);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.disconnectTimers.delete(timerKey);
    }

    player.socketId = newSocketId;
    player.isConnected = true;
    player.isBotControlled = false; // Restore player from bot control
    delete player.disconnectedAt;

    if (newSocketId) {
      this.socketMap.set(newSocketId, { roomCode: code, playerId: player.id });
    }
    room.lastActiveAt = Date.now();

    const gameState = room.engineState ? this.getPlayerGameState(code, player.id) : undefined;

    if (this.onRoomStateChange) {
      this.onRoomStateChange(code);
    }
    if (this.onGameStateChange && room.status === 'playing') {
      this.onGameStateChange(code);
    }

    return {
      success: true,
      room: this.getPublicRoomState(room),
      gameState: gameState ?? undefined,
      playerId: player.id,
      reconnectToken: player.reconnectToken,
    };
  }

  /**
   * Player leaves a room
   */
  public leaveRoom(
    roomCode: string,
    playerId: string
  ): { success: boolean; room?: RoomState; error?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { success: false, error: `Room ${code} does not exist.` };

    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return { success: false, error: 'Player not found in room.' };

    const leavingPlayer = room.players[idx];
    if (leavingPlayer.socketId) {
      this.socketMap.delete(leavingPlayer.socketId);
    }
    room.players.splice(idx, 1);
    room.lastActiveAt = Date.now();

    if (room.status === 'lobby') {
      const teams: TeamId[] =
        room.settings.teamCount === 3 ? ['red', 'blue', 'green'] : ['red', 'blue'];
      room.players.forEach((p, seat) => {
        p.seat = seat;
        p.teamId = teams[seat % teams.length];
      });

      if (room.hostId === playerId && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
      }
    }

    return { success: true, room: this.getPublicRoomState(room) };
  }

  /**
   * Handle client socket disconnection.
   * Marks player offline, schedules 60s timeout for bot takeover or pause.
   */
  public handleDisconnect(
    socketId: string
  ): { roomCode?: string; room?: RoomState; playerId?: string } {
    const entry = this.socketMap.get(socketId);
    if (!entry) return {};

    const { roomCode, playerId } = entry;
    this.socketMap.delete(socketId);

    const room = this.rooms.get(roomCode);
    if (!room) return {};

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = false;
      player.disconnectedAt = Date.now();
      room.lastActiveAt = Date.now();

      // If game is playing, schedule 60s timeout for bot takeover
      if (room.status === 'playing') {
        const timerKey = `${roomCode}:${playerId}`;
        const existingTimer = this.disconnectTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          this.handleDisconnectTimeout(roomCode, playerId);
        }, this.disconnectTimeoutMs);

        if (timer && typeof timer.unref === 'function') {
          timer.unref();
        }
        this.disconnectTimers.set(timerKey, timer);
      }
    }

    // In lobby phase, if host disconnects and other players exist, transfer host
    if (room.status === 'lobby' && room.hostId === playerId) {
      const nextConnected = room.players.find((p) => p.isConnected);
      if (nextConnected) {
        nextConnected.isHost = true;
        room.hostId = nextConnected.id;
      }
    }

    if (this.onRoomStateChange) {
      this.onRoomStateChange(roomCode);
    }
    if (this.onGameStateChange && room.status === 'playing') {
      this.onGameStateChange(roomCode);
    }

    return {
      roomCode,
      room: this.getPublicRoomState(room),
      playerId,
    };
  }

  /**
   * Called when a player remains disconnected for >= 60 seconds.
   * Lets a bot take over their seat.
   */
  public handleDisconnectTimeout(roomCode: string, playerId: string): void {
    const code = roomCode.trim().toUpperCase();
    const timerKey = `${code}:${playerId}`;
    this.disconnectTimers.delete(timerKey);

    const room = this.rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.isConnected) return;

    // Disconnected for 60 seconds: bot takes over seat
    player.isBotControlled = true;

    if (this.onRoomStateChange) {
      this.onRoomStateChange(code);
    }
    if (this.onGameStateChange) {
      this.onGameStateChange(code);
    }

    // If it is currently this player's turn, execute a bot turn
    if (
      room.engineState &&
      room.engineState.players[room.engineState.currentPlayerIndex]?.id === playerId
    ) {
      this.playBotTurn(code, playerId);
    }
  }

  /**
   * Check if a room is considered empty (no players or all players disconnected)
   */
  public isRoomEmpty(room: ActiveRoom): boolean {
    return room.players.length === 0 || room.players.every((p) => !p.isConnected);
  }

  /**
   * Remove empty rooms after inactivity timeout (default: 30 minutes)
   */
  public cleanupInactiveRooms(
    now: number = Date.now(),
    timeoutMs: number = RoomManager.INACTIVITY_TIMEOUT_MS
  ): string[] {
    const removedCodes: string[] = [];
    for (const [code, room] of this.rooms.entries()) {
      const isEmpty = this.isRoomEmpty(room);
      const isInactive = now - room.lastActiveAt >= timeoutMs;
      if (isEmpty && isInactive) {
        for (const player of room.players) {
          if (player.socketId) {
            this.socketMap.delete(player.socketId);
          }
        }
        this.rooms.delete(code);
        removedCodes.push(code);
      }
    }
    return removedCodes;
  }

  /**
   * Construct masked, PERSONALISED view of game state for a specific player:
   * - The full board
   * - Authorized player's secret hand ONLY
   * - All public discard piles
   * - Opponents' hands are NEVER included (only cardCount is provided)
   * - Draw pile array is NEVER included (only drawPileCount is provided)
   */
  public getPlayerGameState(
    roomCode: string,
    playerId: string
  ): PlayerGameState | null {
    const code = roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room || !room.engineState) return null;

    const engine = room.engineState;
    const targetPlayer = engine.players.find((p) => p.id === playerId);

    // Secret hand: only provide hand cards to the authorized player
    const hand = targetPlayer ? [...targetPlayer.hand] : [];

    // All public discard piles (face-up for all players)
    const discardPiles: Record<string, Card[]> = {};
    for (const ep of engine.players) {
      discardPiles[ep.id] = [...ep.discardPile];
    }

    // Summarize all players:
    // Opponents' hands are NEVER included. Only cardCount is exposed.
    const players: PlayerSummary[] = room.players.map((rp) => {
      const ep = engine.players.find((p) => p.id === rp.id);
      return {
        id: rp.id,
        name: rp.name,
        teamId: rp.teamId,
        seat: rp.seat,
        cardCount: ep ? ep.hand.length : 0,
        discardPile: ep ? [...ep.discardPile] : [],
        discardPileCount: ep ? ep.discardPile.length : 0,
        isConnected: rp.isConnected,
        isBotControlled: rp.isBotControlled ?? false,
      };
    });

    const currentTurnPlayer = engine.players[engine.currentPlayerIndex];

    return {
      roomCode: code,
      phase: engine.phase === 'finished' ? 'finished' : 'playing',
      board: engine.board,
      currentPlayerIndex: engine.currentPlayerIndex,
      turnPlayerId: currentTurnPlayer?.id ?? '',
      hand, // Only authorized player's cards
      players,
      discardPiles,
      sequenceCounts: engine.sequenceCounts,
      sequencesNeeded: requiredSequences(engine.teams.length),
      completedSequences: engine.completedSequences,
      lastMove: engine.lastMove,
      winner: engine.winner,
      drawPileCount: engine.drawPile.length, // ONLY card count, never cards array
      reshuffleOccurred: engine.reshuffleOccurred,
      dealerIndex: engine.dealerIndex,
      isPaused: room.isPaused,
    };
  }

  public getRoom(roomCode: string): ActiveRoom | undefined {
    return this.rooms.get(roomCode.trim().toUpperCase());
  }

  public getRoomBySocket(socketId: string): ActiveRoom | undefined {
    const entry = this.socketMap.get(socketId);
    return entry ? this.rooms.get(entry.roomCode) : undefined;
  }

  /**
   * Sanitizes the room state for public broadcast:
   * Strips out private reconnectTokens so players cannot impersonate each other.
   */
  public getPublicRoomState(room: ActiveRoom): RoomState {
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      players: room.players.map(({ reconnectToken, ...publicPlayer }) => ({
        ...publicPlayer,
      })),
      settings: { ...room.settings },
      createdAt: room.createdAt,
    };
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  public getConnectedSocketCount(): number {
    return this.socketMap.size;
  }
}

export const roomManager = new RoomManager();
